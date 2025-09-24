import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(request: NextRequest) {
  try {
    const { parcelles, clientLocalId } = await request.json()

    // Get environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 })
    }

    // Get the current user from the session using SSR client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )
    
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Verify user owns this client using the authenticated client (respects RLS)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('local_id', clientLocalId)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 403 })
    }
    
    // Update each parcelle using authenticated client
    const results = []
    for (const parcelle of parcelles) {
      const { error, data } = await supabase
        .from('parcelles')
        .update({
          nom_parcelle: parcelle.nom_parcelle,
          surface_hectares: parcelle.surface_hectares,
          actif: true,
          last_modified: new Date().toISOString()
        })
        .eq('id', parcelle.id)
        .eq('client_local_id', clientLocalId)
        .select()

      if (error) {
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }

      results.push(data)
    }
    
    return NextResponse.json({ success: true, results })
    
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}