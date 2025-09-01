import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Client, Livraison } from '@/lib/supabase'
import LivraisonsClient from '@/components/LivraisonsClient'

export default async function LivraisonsPage() {
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
    redirect('/login')
  }

  // Get all livraisons for this client (last 90 days for initial load)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  
  const { data: livraisons } = await supabase
    .from('livraisons')
    .select('*')
    .eq('client_local_id', client.local_id)
    .gte('date_livraison', ninetyDaysAgo.toISOString().split('T')[0])
    .order('date_livraison', { ascending: false })

  return (
    <LivraisonsClient 
      client={client}
      initialLivraisons={livraisons as Livraison[] || []}
    />
  )
}