export type BaseUnitPreference = 'g' | 'ml' | 'un'
export type ExpiryAlertDays = 3 | 7 | 15

export type AppPreferences = {
  defaultBaseUnit: BaseUnitPreference
  expiryAlertDays: ExpiryAlertDays
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  defaultBaseUnit: 'un',
  expiryAlertDays: 7,
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

  return { defaultBaseUnit, expiryAlertDays }
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
