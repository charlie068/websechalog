'use client'

import { useState, ReactNode } from 'react'
import Link from 'next/link'
import LanguageSwitcher from './LanguageSwitcher'
import { Client } from '@/lib/supabase'

interface ResponsiveLayoutProps {
  client: Client
  currentPage: 'dashboard' | 'deliveries' | 'profile'
  safeT: (key: string, fallback?: string) => string
  children: ReactNode
  sidebarContent?: ReactNode
}

export default function ResponsiveLayout({
  client,
  currentPage,
  safeT,
  children,
  sidebarContent
}: ResponsiveLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navigationItems = [
    {
      key: 'dashboard' as const,
      href: '/dashboard',
      icon: '🏠',
      label: safeT('navigation.dashboard', 'Dashboard'),
      color: 'green'
    },
    {
      key: 'deliveries' as const,
      href: '/livraisons',
      icon: '📦',
      label: safeT('navigation.deliveries', 'Deliveries'),
      color: 'indigo'
    },
    {
      key: 'profile' as const,
      href: '/profile',
      icon: '👤',
      label: safeT('navigation.profile', 'Profile'),
      color: 'purple'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Top Header */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white sticky top-0 z-30 w-full">
        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-6 w-full">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md hover:bg-white/20 transition-colors"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <img
                src="/sechalog_logo.png"
                alt="SechaLog Logo"
                className="h-10 lg:h-10 w-auto"
              />
              <div>
                <h1 className="text-2xl lg:text-2xl font-bold">
                  <span className="sm:hidden">SechaLog</span>
                  <span className="hidden sm:inline">SechaLog Portal</span>
                </h1>
                <p className="text-green-100 text-base lg:text-base hidden sm:block">Client: {client.nom_client}</p>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
              <LanguageSwitcher />
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="bg-white/20 hover:bg-white/30 text-white font-medium flex items-center space-x-1 lg:space-x-2 px-2 lg:px-4 py-2 rounded-lg transition-colors text-sm lg:text-base"
                >
                  <span>🚪</span>
                  <span className="hidden sm:inline">{safeT('navigation.logout', 'Logout')}</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Visible on all screen sizes */}
        <div className="border-t border-blue-400/30 w-full">
          <div className="px-4 lg:px-8 py-2 w-full">
            <nav className="flex space-x-2 lg:space-x-4 overflow-x-auto">
              {navigationItems.map((item) => (
                currentPage === item.key ? (
                  <div
                    key={item.key}
                    className="flex items-center space-x-2 px-3 lg:px-4 py-2 rounded-lg bg-white/25 text-white font-medium text-sm lg:text-base whitespace-nowrap shadow-sm"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ) : (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="flex items-center space-x-2 px-3 lg:px-4 py-2 rounded-lg text-blue-100 hover:bg-white/15 font-medium text-sm lg:text-base transition-colors whitespace-nowrap"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                )
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="flex w-full">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 bg-white shadow-sm min-h-screen flex-shrink-0">
          {sidebarContent}
        </div>

        {/* Mobile Sidebar */}
        <div className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <span className="text-lg font-semibold text-gray-900">Menu</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto">
            {sidebarContent}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 lg:p-6 p-4 w-full min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}