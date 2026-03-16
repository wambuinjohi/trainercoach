import { getApiUrl as getApiUrlFromConfig, getApiBaseUrl, isCapacitorApp } from './api-config'
import { getMockResponse } from './mock-data'

// Note: Using the unified /api.php at root level
// This consolidates both the root api.php and public/api.php into a single endpoint
// Fallback to /api.php is automatically used if primary endpoint fails
// Supports both local Apache servers and remote Capacitor deployments

// Dynamically get fallback URLs in case they change (e.g., localStorage)
function getCurrentFallbackApiUrls(currentUrl: string): string[] {
  const urls: string[] = [];

  // 1. Primary from config
  const primaryUrl = getApiBaseUrl();
  if (primaryUrl && !urls.includes(primaryUrl)) {
    urls.push(primaryUrl);
  }

  // 2. Relative /api.php as a reliable fallback on web
  if (typeof window !== 'undefined' && !urls.includes('/api.php')) {
    urls.push('/api.php');
  }

  // Filter out the current one we've already tried or are about to try
  return urls.filter(u => u !== currentUrl);
}

let lastSuccessfulApiUrl: string | null = null

export function getApiUrl(): string {
  const url = getApiUrlFromConfig()
  return url
}

export function setApiUrl(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('api_url', url)
    lastSuccessfulApiUrl = null // Reset on manual change
  }
}

export function getLastSuccessfulApiUrl(): string | null {
  return lastSuccessfulApiUrl
}

// Export getter function instead of static constant to respect environment variables and localStorage
export function getAPI_URL(): string {
  return getApiUrl()
}

// For backwards compatibility, also export as a getter property
export const API_URL = getApiUrl()

export type ApiResponse<T = any> = {
  status: 'success' | 'error'
  message: string
  data?: T
  [key: string]: any
}

export async function apiRequest<T = any>(action: string, payload: Record<string, any> = {}, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...withAuth(),
    ...(init.headers as Record<string, string> || {})
  }

  // Try primary API URL first
  let apiUrl = getApiUrl()

  // If we have a previously successful URL in this session, prefer it
  if (lastSuccessfulApiUrl) {
    apiUrl = lastSuccessfulApiUrl
  }

  console.log(`[API] ${action}`, { url: apiUrl, payload });

  try {
    const response = await apiRequest_Internal<T>(apiUrl, action, payload, headers, init)
    lastSuccessfulApiUrl = apiUrl
    return response
  } catch (primaryError) {
    console.error(`[API] ${action} failed with primary URL:`, primaryError, { url: apiUrl })

    // Try fallback URLs if primary fails
    const fallbackUrls = getCurrentFallbackApiUrls(apiUrl)

    // Log detailed error info for debugging
    const errorMsg = primaryError instanceof Error ? primaryError.message : String(primaryError)
    if (errorMsg.includes('Failed to fetch')) {
      console.warn(`[API DEBUG] Network/CORS error detected. API URL: ${apiUrl}`, {
        isProduction: import.meta.env.PROD,
        apiUrl,
        fallbackUrls: fallbackUrls,
      })
    }
    for (const fallbackUrl of fallbackUrls) {
      console.log(`[API] ${action} - trying fallback URL:`, fallbackUrl)
      try {
        const response = await apiRequest_Internal<T>(fallbackUrl, action, payload, headers, init)
        lastSuccessfulApiUrl = fallbackUrl
        console.log(`[API] ${action} - fallback URL succeeded:`, fallbackUrl)
        return response
      } catch (fallbackError) {
        console.error(`[API] ${action} - fallback URL failed:`, fallbackError, { url: fallbackUrl })
        continue
      }
    }

    // All API endpoints failed, try mock data as last resort
    console.log(`[API] ${action} - all real endpoints failed, attempting mock data fallback`)
    const mockResponse = getMockResponse(action, payload)
    if (mockResponse) {
      console.log(`[API] ${action} - using mock data (all real endpoints failed)`)
      const result = mockResponse.data ? mockResponse.data as T : mockResponse as unknown as T
      return result
    }

    // No mock data available either
    console.error(`[API] ${action} - no mock data available, throwing error`)
    throw primaryError
  }
}

async function apiRequest_Internal<T = any>(
  apiUrl: string,
  action: string,
  payload: Record<string, any>,
  headers: Record<string, string>,
  init: RequestInit
): Promise<T> {
  try {
    // Merge headers properly, ensuring our constructed headers (including auth tokens) take precedence
    const mergedHeaders = {
      ...headers,
      ...(init.headers as Record<string, string> || {}),
      ...headers, // Re-apply our headers after init.headers so they take precedence
    }

    const res = await fetch(apiUrl, {
      method: 'POST',
      ...init,
      headers: mergedHeaders,
      body: JSON.stringify({ action, ...payload }),
    })

    let json: ApiResponse<T> | null = null
    try {
      // Clone the response to safely read the body without consuming the original
      const clonedRes = res.clone()
      const text = await clonedRes.text()

      if (!text) {
        throw new Error('Empty response body')
      }

      // Check if response is HTML instead of JSON (common error response)
      if (text.trim().startsWith('<')) {
        throw new Error(`Server returned HTML instead of JSON. Status: ${res.status}. The API endpoint may be down or misconfigured.`)
      }

      json = JSON.parse(text)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error'
      throw new Error(`Invalid API response from ${apiUrl}: ${errorMsg}`)
    }

    if (!json) throw new Error('Empty API response')
    if (json.status === 'error') throw new Error(json.message || `API error: ${res.status}`)
    if (!res.ok && json.status !== 'success') throw new Error(json.message || `API error: ${res.status}`)
    return (json.data as T) ?? (json as unknown as T)
  } catch (error) {
    // Re-throw with more context
    throw error
  }
}

export function withAuth(token?: string): Record<string, string> {
  const t = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') || '' : '')
  return t ? { Authorization: `Bearer ${t}` } : {}
}
