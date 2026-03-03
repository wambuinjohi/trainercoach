/**
 * Centralized API Configuration
 * Handles environment detection and endpoint selection for web and native apps
 */

// Detect if running in Capacitor (native Android/iOS app)
export function isCapacitorApp(): boolean {
  try {
    return typeof (window as any).Capacitor !== 'undefined';
  } catch {
    return false;
  }
}

// Detect if running on Android specifically
export function isAndroidApp(): boolean {
  if (!isCapacitorApp()) return false;
  try {
    return (window as any).Capacitor?.isNativeAndroid?.() === true ||
           (window as any).Capacitor?.platform === 'android';
  } catch {
    return false;
  }
}

/**
 * Get the uploads base URL
 * This is used for displaying images and files uploaded to the server
 */
export function getUploadsBaseUrl(): string {
  return 'https://trainercoachconnect.com/uploads';
}

/**
 * Get the base API URL based on environment
 * Priority order:
 * 1. Stored preference in localStorage
 * 2. Environment variable (for deployment configuration)
 * 3. For native apps: https://trainercoachconnect.com
 * 4. For web apps: relative /api.php (local endpoint)
 * 5. Fallback: mock data (when no API is available)
 */
export function getApiBaseUrl(): string {
  // Check if user has manually set an API URL
  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('api_url') : null;
  // Basic validation: must be a valid URL string or relative path
  if (storedUrl && storedUrl.length > 5 && (storedUrl.startsWith('/') || storedUrl.includes('://'))) {
    if (typeof window !== 'undefined') {
      console.log('[API Config] Using URL from localStorage:', storedUrl);
    }
    return storedUrl;
  }

  // Check environment variable
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    if (typeof window !== 'undefined') {
      console.log('[API Config] Using URL from VITE_API_URL environment variable:', envUrl);
    }
    return envUrl;
  }

  // For native Capacitor apps, use the remote server
  if (isCapacitorApp()) {
    // Only use remote URL if we're actually on a native platform or explicitly told to
    const isNative = (window as any).Capacitor?.isNative || (window as any).Capacitor?.platform !== 'web';
    if (isNative) {
      const nativeUrl = 'https://trainercoachconnect.com/api.php';
      if (typeof window !== 'undefined') {
        console.log('[API Config] Using native app URL:', nativeUrl);
      }
      return nativeUrl;
    }
  }

  // For web apps, default to relative path (works with local/deployed servers)
  const defaultUrl = '/api.php';
  if (typeof window !== 'undefined') {
    console.log('[API Config] Using default relative path:', defaultUrl);
    console.warn('[API Config] In production, set VITE_API_URL environment variable to your backend server');
  }
  return defaultUrl;
}

/**
 * Get the full API endpoint URL
 */
export function getApiUrl(): string {
  let baseUrl = getApiBaseUrl();

  // Convert relative path to absolute URL in browser environment
  if (typeof window !== 'undefined' && baseUrl.startsWith('/')) {
    const origin = window.location.origin;
    baseUrl = origin + baseUrl;
  }

  // If it already ends with api.php, return as-is
  if (baseUrl.endsWith('/api.php')) {
    return baseUrl;
  }

  // If it's a domain without api.php, append it
  if (baseUrl.includes('://')) {
    return baseUrl.endsWith('/') ? baseUrl + 'api.php' : baseUrl + '/api.php';
  }

  // If it's a relative path like /api.php (and we're not in a browser), return as-is
  return baseUrl;
}

/**
 * Set API URL manually (e.g., from settings UI)
 */
export function setApiUrl(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('api_url', url);
  }
}

/**
 * Clear the stored API URL to go back to defaults
 */
export function clearApiUrl(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('api_url');
  }
}

/**
 * API Configuration object with common settings
 */
export const API_CONFIG = {
  getUrl: getApiUrl,
  getBaseUrl: getApiBaseUrl,
  getUploadsUrl: getUploadsBaseUrl,
  setUrl: setApiUrl,
  clearUrl: clearApiUrl,
  timeout: 30000,
  isNativeApp: isCapacitorApp,
  isAndroid: isAndroidApp,
};

export default API_CONFIG;
