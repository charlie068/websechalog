# Internationalization (i18n) System

This document explains how to use the internationalization system implemented in the SechaLog Client Portal.

## Supported Languages

- **French (fr)** - Default language
- **English (en)**
- **German (de)**
- **Alsacian (als)** - Regional dialect

## Quick Start

The internationalization system is already set up and ready to use. Here's how to test it:

1. **Visit the profile page**: http://localhost:3001/profile
2. **Look for the language switcher** in the top header (flags dropdown)
3. **Switch languages** by clicking on different flags
4. **Observe the text changes** as you switch between languages

## File Structure

```
src/
├── dictionaries/           # Translation files
│   ├── fr.json            # French translations
│   ├── en.json            # English translations
│   ├── de.json            # German translations
│   └── als.json           # Alsacian translations
├── contexts/
│   └── LanguageContext.tsx # Language state management
├── hooks/
│   └── useTranslations.ts  # Translation hook for components
├── lib/
│   └── translations.ts     # Utility functions
└── components/
    └── LanguageSwitcher.tsx # Language selection component
```

## How to Use Translations

### In Client Components

```tsx
import { useTranslations } from '@/hooks/useTranslations'

export default function MyComponent() {
  const { t } = useTranslations()

  return (
    <div>
      <h1>{t('common.loading')}</h1>
      <button>{t('common.save')}</button>
    </div>
  )
}
```

### In Server Components

```tsx
import { getDictionary, createServerTranslation } from '@/lib/translations'

export default async function ServerComponent() {
  // Get current language from cookies or URL params
  const lang = 'fr' // This should come from your language detection logic
  const dictionary = await getDictionary(lang)
  const t = createServerTranslation(dictionary)

  return (
    <div>
      <h1>{t('common.loading')}</h1>
    </div>
  )
}
```

## Translation Key Structure

Translations are organized hierarchically in JSON files:

```json
{
  "common": {
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "profile": "Profile"
  },
  "profile": {
    "title": "My Profile",
    "personalInfo": "Personal Information"
  }
}
```

Access nested keys with dot notation:
- `t('common.loading')` → "Loading..."
- `t('navigation.dashboard')` → "Dashboard"
- `t('profile.personalInfo')` → "Personal Information"

## Adding New Translations

1. **Add the key to all language files**:
   ```json
   // fr.json
   "mySection": {
     "newKey": "Nouveau texte"
   }

   // en.json
   "mySection": {
     "newKey": "New text"
   }

   // de.json
   "mySection": {
     "newKey": "Neuer Text"
   }

   // als.json
   "mySection": {
     "newKey": "Neie Text"
   }
   ```

2. **Use in your component**:
   ```tsx
   const { t } = useTranslations()
   return <span>{t('mySection.newKey')}</span>
   ```

## Language Switcher

The language switcher is already integrated into the profile page header. To add it to other pages:

```tsx
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function MyPage() {
  return (
    <div>
      <header>
        <LanguageSwitcher />
      </header>
      {/* rest of your content */}
    </div>
  )
}
```

## Current Implementation Status

### ✅ Completed
- Dictionary files for all 4 languages
- Language context and state management
- Translation utilities and hooks
- Language switcher component
- Basic integration in profile page

### 🔄 Partially Completed
- Profile page demonstrates translations
- Navigation menu translated
- Basic UI elements translated

### 📋 To Do
- Translate all remaining components:
  - Dashboard page
  - Deliveries page
  - Login/register pages
  - All form labels and messages
  - Error messages
  - Data table headers
  - Chart labels

## How to Complete the Translation

To fully translate the application, you need to:

1. **Update each component** to use the `useTranslations` hook
2. **Replace hardcoded text** with translation keys
3. **Add missing translation keys** to all language files
4. **Test each language** to ensure proper translations

Example of updating a component:

```tsx
// Before
<button>Sauvegarder</button>

// After
const { t } = useTranslations()
<button>{t('common.save')}</button>
```

## Testing

1. Go to http://localhost:3001/profile
2. Use the language switcher (flags in header)
3. Verify that:
   - Text changes when switching languages
   - All UI elements are translated
   - No translation keys are displayed (like 'common.save')
   - Layout remains correct in all languages

## Browser Storage

The selected language is automatically saved to localStorage and persists across browser sessions.

## Fallback Behavior

- If a translation key is missing, the key itself is displayed
- If a language file is missing, it falls back to French (fr)
- Missing nested keys display the full path (e.g., "common.missing")

## Performance

- Dictionaries are cached after first load
- Only the current language dictionary is loaded
- Language switching triggers a page reload to ensure all translations update