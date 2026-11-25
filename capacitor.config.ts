import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Identificador provisório. Deve ser confirmado antes do primeiro envio à loja,
 * pois o applicationId/bundleIdentifier passa a identificar o app publicado.
 */
const config: CapacitorConfig = {
  appId: 'com.despensainteligente.app',
  appName: 'Despensa Inteligente',
  webDir: 'dist',
  backgroundColor: '#f7f7f2',
  ios: {
    contentInset: 'automatic',
  },
}

export default config
