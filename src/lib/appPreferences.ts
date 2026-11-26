export type BaseUnitPreference = 'g' | 'ml' | 'un'
export type ExpiryAlertDays = 3 | 7 | 15
export type ThemePreference = 'light' | 'dark' | 'system'

export type AppPreferences = {
  defaultBaseUnit: BaseUnitPreference
  expiryAlertDays: ExpiryAlertDays
  theme: ThemePreference
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  defaultBaseUnit: 'un',
  expiryAlertDays: 7,
  theme: 'light',
}

const STORAGE_KEY = 'despensa-inteligente.app-preferences.v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeAppPreferences(value: unknown): AppPreferences {
  if (!isRecord(value)) return DEFAULT_APP_PREFERENCES

  const defaultBaseUnit = value.defaultBaseUnit === 'g' || value.defaultBaseUnit === 'ml' || value.defaultBaseUnit === 'un'
    ? value.defaultBaseUnit
    : DEFAULT_APP_PREFERENCES.defaultBaseUnit
  const expiryAlertDays = value.expiryAlertDays === 3 || value.expiryAlertDays === 7 || value.expiryAlertDays === 15
    ? value.expiryAlertDays
    : DEFAULT_APP_PREFERENCES.expiryAlertDays
  const theme = value.theme === 'light' || value.theme === 'dark' || value.theme === 'system'
    ? value.theme
    : DEFAULT_APP_PREFERENCES.theme

  return { defaultBaseUnit, expiryAlertDays, theme }
}

export function readAppPreferences(userMetadata?: unknown): AppPreferences {
  if (isRecord(userMetadata) && 'app_preferences' in userMetadata) {
    return normalizeAppPreferences(userMetadata.app_preferences)
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? normalizeAppPreferences(JSON.parse(stored) as unknown) : DEFAULT_APP_PREFERENCES
  } catch {
    return DEFAULT_APP_PREFERENCES
  }
}

export function persistAppPreferences(preferences: AppPreferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Preferências continuam disponíveis em memória caso o navegador bloqueie o armazenamento local.
  }
}

export function applyTheme(theme: ThemePreference) {
  if (typeof document === 'undefined') return
  const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#101612' : '#203c32')
}
