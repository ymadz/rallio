import type { CapacitorConfig } from '@capacitor/cli'

const serverUrl = process.env.CAPACITOR_SERVER_URL
const usesLocalServer =
  typeof serverUrl === 'string' &&
  (serverUrl.startsWith('http://') ||
    serverUrl.includes('localhost') ||
    serverUrl.includes('127.0.0.1') ||
    serverUrl.includes('192.168.'))

const config: CapacitorConfig = {
  appId: 'com.rallio.player',
  appName: 'Rallio',
  webDir: 'out',
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: usesLocalServer,
        androidScheme: usesLocalServer ? 'http' : 'https',
        allowNavigation: [
          'checkout.paymongo.com',
          '*.paymongo.com',
          '*.gcash.com'
        ]
      }
    : undefined,
  android: {
    allowMixedContent: usesLocalServer,
  },
}

export default config