import { Language } from '@/contexts/LanguageContext'

// Dictionary cache to avoid repeated imports
const dictionaryCache: { [key in Language]?: any } = {}

// Static imports for all dictionaries
import enDict from '@/dictionaries/en.json'
import frDict from '@/dictionaries/fr.json'
import deDict from '@/dictionaries/de.json'
import alsDict from '@/dictionaries/als.json'

// Dictionary mapping
const dictionaries = {
  en: enDict,
  fr: frDict,
  de: deDict,
  als: alsDict
}

// Get dictionary for a specific language (synchronous)
export function getDictionary(lang: Language) {
  if (dictionaryCache[lang]) {
    return dictionaryCache[lang]
  }

  try {
    const dictionary = dictionaries[lang]
    if (!dictionary) {
      throw new Error(`Dictionary for language ${lang} not found`)
    }
    dictionaryCache[lang] = dictionary
    return dictionary
  } catch (error) {
    // Silently fallback to French if language not found
    if (lang !== 'fr') {
      return getDictionary('fr')
    }
    throw new Error(`Dictionary for language ${lang} not found`)
  }
}

// Get nested translation value from path (e.g., "common.loading")
export function getTranslation(dictionary: any, path: string): string {
  return path.split('.').reduce((obj, key) => obj?.[key], dictionary) || path
}

// Translation hook for client components
export function createTranslationHook(dictionary: any) {
  return function useTranslation() {
    const t = (path: string, fallback?: string): string => {
      const translation = getTranslation(dictionary, path)
      return translation !== path ? translation : (fallback || path)
    }

    return { t, dictionary }
  }
}

// Server-side translation function
export function createServerTranslation(dictionary: any) {
  return function t(path: string, fallback?: string): string {
    const translation = getTranslation(dictionary, path)
    return translation !== path ? translation : (fallback || path)
  }
}