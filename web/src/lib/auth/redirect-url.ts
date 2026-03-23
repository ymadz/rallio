const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, '')
}

function isLocalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return LOCAL_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export function getClientAuthBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
    ? normalizeUrl(process.env.NEXT_PUBLIC_APP_URL)
    : ''

  if (envUrl && !isLocalUrl(envUrl)) {
    return envUrl
  }

  if (typeof window === 'undefined') {
    return envUrl || 'http://localhost:3000'
  }

  const browserOrigin = normalizeUrl(window.location.origin)

  if (
    browserOrigin &&
    !browserOrigin.startsWith('capacitor://') &&
    !isLocalUrl(browserOrigin)
  ) {
    return browserOrigin
  }

  return browserOrigin || envUrl || 'http://localhost:3000'
}

export function getServerAuthBaseUrl(requestUrl: string): string {
  const requestOrigin = normalizeUrl(new URL(requestUrl).origin).replace('0.0.0.0', 'localhost')
  
  // If we have a request origin that isn't local, use it
  if (requestOrigin && !isLocalUrl(requestOrigin)) {
    return requestOrigin
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL
    ? normalizeUrl(process.env.NEXT_PUBLIC_APP_URL)
    : ''

  if (envUrl && !isLocalUrl(envUrl)) {
    return envUrl
  }

  return requestOrigin || 'http://localhost:3000'
}

export function buildAuthRedirectUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getClientAuthBaseUrl()}${normalizedPath}`
}
