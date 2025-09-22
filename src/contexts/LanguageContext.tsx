'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Language = 'fr' | 'en' | 'de' | 'als'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  availableLanguages: { code: Language; name: string; flag: string }[]
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const STORAGE_KEY = 'sechalog-language'

export const availableLanguages = [
  { code: 'fr' as Language, name: 'Français', flag: '🇫🇷' },
  { code: 'en' as Language, name: 'English', flag: '🇬🇧' },
  { code: 'de' as Language, name: 'Deutsch', flag: '🇩🇪' },
  { code: 'als' as Language, name: 'Elsässisch', flag: '🥨' }
]

interface LanguageProviderProps {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>('fr')

  // Load language from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem(STORAGE_KEY) as Language
      if (savedLanguage && availableLanguages.some(lang => lang.code === savedLanguage)) {
        setLanguageState(savedLanguage)
      }
    }
  }, [])

  // Save language to localStorage when it changes
  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang)
    }
  }

  const value: LanguageContextType = {
    language,
    setLanguage,
    availableLanguages
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}