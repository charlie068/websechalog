import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Client, Parcelle, Livraison } from '@/lib/supabase'
import DashboardClient from '@/components/DashboardClient'
import NoClientAccess from '@/components/NoClientAccess'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Get client data based on authenticated user
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('supabase_user_id', user.id)

  const client = clients?.[0] as Client | undefined

  if (!client) {
    return <NoClientAccess />
  }

  // Get parcelles for this client (only active ones)
  const { data: parcelles } = await supabase
    .from('parcelles')
    .select('*')
    .eq('client_local_id', client.local_id)
    .eq('actif', true)

  // Get recent livraisons for this client (last 90 days for product filtering)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: livraisons } = await supabase
    .from('livraisons')
    .select('*')
    .eq('client_local_id', client.local_id)
    .gte('date_pesee', ninetyDaysAgo.toISOString().split('T')[0])
    .order('date_pesee', { ascending: false })

  return (
    <DashboardClient 
      client={client}
      initialParcelles={parcelles as Parcelle[] || []}
      initialLivraisons={livraisons as Livraison[] || []}
    />
  )
}