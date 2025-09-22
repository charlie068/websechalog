'use client'

import { useLanguage } from '@/contexts/LanguageContext'
import { getDictionary, getTranslation } from '@/lib/translations'

export function useTranslations() {
  const { language } = useLanguage()

  // Direct synchronous approach - load dictionary immediately
  let dictionary = null
  try {
    dictionary = getDictionary(language)
  } catch (error) {
    // Silently fallback to null dictionary
  }

  const t = (path: string, fallback?: string): string => {
    if (!dictionary) {
      return fallback || path
    }
    const translation = getTranslation(dictionary, path)
    return translation !== path ? translation : (fallback || path)
  }

  return { t, loading: false, language, dictionary }
}