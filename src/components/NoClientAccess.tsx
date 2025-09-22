'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/hooks/useTranslations'

export default function NoClientAccess() {
  const router = useRouter()
  const { t, loading: translationsLoading } = useTranslations()

  // Safe translation function
  const safeT = (key: string, fallback?: string): string => {
    if (translationsLoading || typeof t !== 'function') {
      return fallback || key
    }
    return t(key, fallback)
  }

  useEffect(() => {
    const handleLogout = async () => {
      // Sign out the user
      await supabase.auth.signOut()
      // Redirect to login
      router.push('/login')
    }

    // Automatically logout after a short delay to show the message briefly
    const timer = setTimeout(() => {
      handleLogout()
    }, 2000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{safeT('errors.noClientAccess', 'Access denied')}</h1>
        <p className="text-gray-600 mb-4">Aucun client trouvé pour votre compte.</p>
        <p className="text-sm text-gray-500">{safeT('auth.loggingOut', 'Logging out...')}</p>
        <div className="mt-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      </div>
    </div>
  )
}