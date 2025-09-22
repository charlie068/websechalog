import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Client } from '@/lib/supabase'
import ProfileClient from '@/components/ProfileClient'
import NoClientAccess from '@/components/NoClientAccess'

export default async function ProfilePage() {
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

  return (
    <ProfileClient 
      client={client}
      user={user}
    />
  )
}