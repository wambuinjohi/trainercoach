import { Geolocation } from '@capacitor/geolocation';

// Check if running in Capacitor (native app)
function isCapacitorApp(): boolean {
  try {
    return typeof (window as any).Capacitor !== 'undefined';
  } catch {
    return false;
  }
}

export type ApproxLocation = {
  label?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  ip?: string | null;
  source?: 'capacitor-geolocation' | 'geolocation' | 'ipapi' | 'unknown';
};

const clampCoord = (n: any) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  if (v > 90) return 90;
  if (v < -90) return -90;
  return v;
};

async function requestLocationPermission(): Promise<boolean> {
  try {
    const permission = await Geolocation.requestPermissions();
    return permission.location === 'granted';
  } catch (err) {
    return false;
  }
}

async function checkLocationPermission(): Promise<boolean> {
  try {
    const permission = await Geolocation.checkPermissions();
    return permission.location === 'granted';
  } catch (err) {
    return false;
  }
}

async function getLocationViaCapacitor(timeoutMs = 4000): Promise<ApproxLocation | null> {
  // Skip Capacitor if not running in native app
  if (!isCapacitorApp()) {
    return null;
  }

  try {
    // Check and request permissions
    let hasPermission = await checkLocationPermission();
    if (!hasPermission) {
      hasPermission = await requestLocationPermission();
    }

    if (!hasPermission) {
      return null;
    }

    const coordinates = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 60000,
    });

    const lat = clampCoord(coordinates.coords.latitude);
    const lng = clampCoord(coordinates.coords.longitude);

    if (lat != null && lng != null) {
      return {
        lat,
        lng,
        label: 'My location',
        source: 'capacitor-geolocation',
      };
    }
  } catch (err) {
    // Silent fail - we'll fall back to browser geolocation
  }

  return null;
}

function getLocationViaBrowser(timeoutMs = 4000): Promise<ApproxLocation | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return resolve(null);
    }

    const t = window.setTimeout(() => resolve(null), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(t);
        const lat = clampCoord(pos.coords.latitude);
        const lng = clampCoord(pos.coords.longitude);
        resolve({ lat, lng, label: 'My location', source: 'geolocation' });
      },
      () => {
        window.clearTimeout(t);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

async function getLocationViaIPAPI(timeoutMs = 4000): Promise<ApproxLocation | null> {
  try {
    const ctrl = new AbortController();
    const abortT = window.setTimeout(() => ctrl.abort(), timeoutMs);

    const res = await fetch('https://ipapi.co/json/', {
      signal: ctrl.signal,
      mode: 'cors',
    });

    window.clearTimeout(abortT);

    if (!res.ok) {
      return null;
    }

    const j = await res.json();
    const city = (j.city as string) || null;
    const region = (j.region as string) || null;
    const country = (j.country_name as string) || null;
    const ip = (j.ip as string) || null;
    const lat = j.latitude != null ? clampCoord(j.latitude) : null;
    const lng = j.longitude != null ? clampCoord(j.longitude) : null;
    const parts = [city, region, country].filter(Boolean) as string[];
    const label = parts.join(', ') || null;

    return { city, region, country, ip, lat, lng, label, source: 'ipapi' };
  } catch (err) {
    // Silently fail - IP-based geolocation is optional fallback
    return null;
  }
}

export async function searchLocations(query: string, timeoutMs = 3000): Promise<Array<{ label: string; lat: number; lng: number }> | null> {
  if (!query || query.trim().length < 2) {
    return null;
  }

  try {
    if (typeof window === 'undefined') return null;

    const ctrl = new AbortController();
    const abortT = window.setTimeout(() => ctrl.abort(), timeoutMs);

    const encodedQuery = encodeURIComponent(query);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=10&addressdetails=1&countrycodes=ke`,
      {
        signal: ctrl.signal,
        headers: { 'Accept-Language': 'en' },
      }
    );

    window.clearTimeout(abortT);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      return null;
    }

    return data
      .filter((item: any) => item.lat && item.lon)
      .map((item: any) => ({
        label: item.display_name || item.name || '',
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }))
      .slice(0, 10);
  } catch (err) {
    // Silently fail - search is optional
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number, timeoutMs = 3000): Promise<{ city?: string; region?: string; country?: string; label?: string } | null> {
  try {
    if (typeof window === 'undefined') return null;

    const ctrl = new AbortController();
    const abortT = window.setTimeout(() => ctrl.abort(), timeoutMs);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        signal: ctrl.signal,
        headers: { 'Accept-Language': 'en' },
      }
    );

    window.clearTimeout(abortT);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const address = data.address || {};

    const city = address.city || address.town || address.village || null;
    const region = address.state || address.region || null;
    const country = address.country || null;

    const parts = [city, region, country].filter(Boolean) as string[];
    const label = parts.join(', ') || null;

    return { city, region, country, label };
  } catch (err) {
    // Silently fail - reverse geocoding is optional
    return null;
  }
}

export async function getApproxLocation(timeoutMs = 4000): Promise<ApproxLocation | null> {
  try {
    if (typeof window === 'undefined') return null;

    // Try Capacitor geolocation first (native, more accurate)
    try {
      const capacitorLoc = await getLocationViaCapacitor(timeoutMs);
      if (capacitorLoc && capacitorLoc.lat != null && capacitorLoc.lng != null) {
        return capacitorLoc;
      }
    } catch (err) {
      // Continue to next method
    }

    // Fall back to browser geolocation
    try {
      const browserLoc = await getLocationViaBrowser(timeoutMs);
      if (browserLoc && browserLoc.lat != null && browserLoc.lng != null) {
        return browserLoc;
      }
    } catch (err) {
      // Continue to next method
    }

    // Final fallback to IP-based lookup (optional, may fail due to CORS)
    try {
      const ipLoc = await getLocationViaIPAPI(timeoutMs);
      if (ipLoc && ipLoc.lat != null && ipLoc.lng != null) {
        return ipLoc;
      }
    } catch (err) {
      // Silently ignore IP API errors
    }

    // No location available
    return null;
  } catch (err) {
    // Final safety catch to prevent unhandled errors
    return null;
  }
}
