import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Client, Parcelle, Livraison } from '@/lib/supabase'
import DashboardClient from '@/components/DashboardClient'

export default async function DashboardPage() {
  const cookieStore = cookies()
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
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // Get client data based on authenticated user
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('supabase_user_id', session.user.id)

  const client = clients?.[0] as Client | undefined

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Accès refusé</h1>
          <p className="text-gray-600">Aucun client trouvé pour votre compte.</p>
        </div>
      </div>
    )
  }

  // Get parcelles for this client
  const { data: parcelles } = await supabase
    .from('parcelles')
    .select('*')
    .eq('client_local_id', client.local_id)

  // Get recent livraisons for this client (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const { data: livraisons } = await supabase
    .from('livraisons')
    .select('*')
    .eq('client_local_id', client.local_id)
    .gte('date_livraison', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date_livraison', { ascending: false })

  return (
    <DashboardClient 
      client={client}
      initialParcelles={parcelles as Parcelle[] || []}
      initialLivraisons={livraisons as Livraison[] || []}
    />
  )
}