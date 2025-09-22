import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Client, Livraison } from '@/lib/supabase'
import LivraisonsClient from '@/components/LivraisonsClient'
import NoClientAccess from '@/components/NoClientAccess'

export default async function LivraisonsPage() {
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

  // Get all livraisons for this client (last 90 days for initial load)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  
  // Get livraisons for this client (last 90 days)
  const { data: livraisons, error } = await supabase
    .from('livraisons')
    .select('*')
    .eq('client_local_id', client.local_id)
    .gte('date_pesee', ninetyDaysAgo.toISOString().split('T')[0])
    .order('date_pesee', { ascending: false })

  return (
    <LivraisonsClient 
      client={client}
      initialLivraisons={livraisons as Livraison[] || []}
    />
  )
}