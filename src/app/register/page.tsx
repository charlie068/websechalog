'use client'

import Link from 'next/link'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-yellow-100">
            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Inscription désactivée
          </h2>
          <div className="mt-4 p-6 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-700 mb-4">
              L'inscription de nouveaux comptes doit être effectuée via l&apos;application SechaLog Desktop.
            </p>
            <div className="text-left space-y-2">
              <p className="text-sm font-medium text-gray-900">Pour créer un compte :</p>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                <li>Ouvrez l&apos;application SechaLog Desktop</li>
                <li>Contactez votre administrateur pour créer votre compte</li>
                <li>Une fois créé, utilisez vos identifiants pour vous connecter ici</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Link
            href="/login"
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Se connecter avec un compte existant
          </Link>
          
          <Link
            href="/forgot-password"
            className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500 mt-4">
            Besoin d'aide ? Contactez votre administrateur SechaLog
          </p>
        </div>
      </div>
    </div>
  )
}