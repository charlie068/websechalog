'use client'

import Link from 'next/link'
import LanguageSwitcher from './LanguageSwitcher'
import { Client } from '@/lib/supabase'

interface SharedHeaderProps {
  client: Client
  currentPage: 'dashboard' | 'deliveries' | 'profile'
  safeT: (key: string, fallback?: string) => string
}

export default function SharedHeader({ client, currentPage, safeT }: SharedHeaderProps) {
  return (
    <>
      {/* Top Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <img
                src="/sechalog_logo.png"
                alt="SechaLog Logo"
                className="h-10 w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold">SechaLog Portal</h1>
                <p className="text-green-100">Client: {client.nom_client}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="bg-white/20 hover:bg-white/30 text-white font-medium flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors"
                >
                  <span>🚪</span>
                  <span>{safeT('navigation.logout', 'Logout')}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Top Navigation Menu */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {currentPage === 'dashboard' ? (
              <div className="py-4 px-1 border-b-2 border-green-500 text-green-600 font-medium text-sm flex items-center space-x-2">
                <span>🏠</span>
                <span>{safeT('navigation.dashboard', 'Dashboard')}</span>
              </div>
            ) : (
              <Link
                href="/dashboard"
                className="py-4 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium text-sm transition-colors flex items-center space-x-2"
              >
                <span>🏠</span>
                <span>{safeT('navigation.dashboard', 'Dashboard')}</span>
              </Link>
            )}

            {currentPage === 'deliveries' ? (
              <div className="py-4 px-1 border-b-2 border-indigo-500 text-indigo-600 font-medium text-sm flex items-center space-x-2">
                <span>📦</span>
                <span>{safeT('navigation.deliveries', 'Deliveries')}</span>
              </div>
            ) : (
              <Link
                href="/livraisons"
                className="py-4 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium text-sm transition-colors flex items-center space-x-2"
              >
                <span>📦</span>
                <span>{safeT('navigation.deliveries', 'Deliveries')}</span>
              </Link>
            )}

            {currentPage === 'profile' ? (
              <div className="py-4 px-1 border-b-2 border-purple-500 text-purple-600 font-medium text-sm flex items-center space-x-2">
                <span>👤</span>
                <span>{safeT('navigation.profile', 'Profile')}</span>
              </div>
            ) : (
              <Link
                href="/profile"
                className="py-4 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium text-sm transition-colors flex items-center space-x-2"
              >
                <span>👤</span>
                <span>{safeT('navigation.profile', 'Profile')}</span>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </>
  )
}