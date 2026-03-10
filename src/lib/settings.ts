import { apiRequest, withAuth, getApiUrl } from '@/lib/api'
import { getApiBaseUrl } from '@/lib/api-config'

export type MpesaSettings = {
  environment: 'sandbox' | 'production'
  consumerKey: string
  consumerSecret: string
  passkey: string
  paymentType: 'paybill' | 'buygods'
  shortcode: string
  buyGoodsShortCode?: string
  buyGoodsMerchantCode?: string
  initiatorName: string
  securityCredential: string
  resultUrl: string
  queueTimeoutUrl: string
  commandId: string
  transactionType: string
  c2bCallbackUrl: string
  b2cCallbackUrl: string
}

export type PlatformSettings = {
  // Finance
  commissionRate: number
  taxRate: number
  payoutSchedule: 'weekly' | 'biweekly' | 'monthly'
  currency: 'USD' | 'KES' | 'EUR' | 'GBP'
  // Platform charges
  platformChargeTrainerPercent: number
  platformChargeClientPercent: number
  compensationFeePercent: number
  maintenanceFeePercent: number
  // Platform
  platformName: string
  supportEmail: string
  timezone: 'Africa/Nairobi' | 'UTC' | 'America/New_York' | 'Europe/London'
  emailNotifications: boolean
  maintenanceMode: boolean
  // Theme
  theme?: 'light' | 'dark' | 'system'
  // Booking policies
  cancellationHours: number
  rescheduleHours: number
  maxDailySessionsPerTrainer: number
  // M-Pesa Settings
  mpesa?: MpesaSettings
}

const KEY = 'platform_settings_v1'

function getDefaultMpesaCallbackUrls() {
  const baseUrl = getApiBaseUrl();

  // Build callback URLs based on the API base URL
  let callbackBase = baseUrl;
  if (baseUrl.endsWith('/api.php')) {
    callbackBase = baseUrl.replace('/api.php', '');
  } else if (!baseUrl.endsWith('/')) {
    callbackBase = baseUrl + '/';
  }

  const resultUrl = callbackBase.endsWith('/')
    ? callbackBase + 'b2c_callback.php'
    : callbackBase + '/b2c_callback.php';
  const c2bUrl = callbackBase.endsWith('/')
    ? callbackBase + 'c2b_callback.php'
    : callbackBase + '/c2b_callback.php';

  return {
    resultUrl,
    queueTimeoutUrl: resultUrl,
    c2bCallbackUrl: c2bUrl,
    b2cCallbackUrl: resultUrl,
  };
}

export const defaultMpesaSettings: MpesaSettings = {
  environment: 'sandbox',
  consumerKey: '',
  consumerSecret: '',
  passkey: '',
  paymentType: 'paybill',
  shortcode: '',
  buyGoodsShortCode: '',
  buyGoodsMerchantCode: '',
  initiatorName: '',
  securityCredential: '',
  ...getDefaultMpesaCallbackUrls(),
  commandId: 'BusinessPayment',
  transactionType: 'BusinessPayment',
}

export const defaultSettings: PlatformSettings = {
  // Finance
  commissionRate: 15,
  taxRate: 0,
  payoutSchedule: 'monthly',
  currency: 'KES',
  // Platform charges
  platformChargeTrainerPercent: 10,
  platformChargeClientPercent: 15,
  compensationFeePercent: 10,
  maintenanceFeePercent: 15,
  // Platform
  platformName: 'Trainer Coach Connect',
  supportEmail: 'support@wayrus.co.ke',
  timezone: 'Africa/Nairobi',
  emailNotifications: true,
  maintenanceMode: false,
  theme: 'system',
  // Booking policies
  cancellationHours: 24,
  rescheduleHours: 24,
  maxDailySessionsPerTrainer: 8,
  // M-Pesa Settings
  mpesa: { ...defaultMpesaSettings },
}

export function loadSettings(): PlatformSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...defaultSettings }
    const parsed = JSON.parse(raw)
    return { ...defaultSettings, ...parsed }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(s: PlatformSettings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

// Attempt to load settings from PHP API
export async function loadSettingsFromDb(): Promise<PlatformSettings | null> {
  try {
    const apiUrl = getApiUrl()
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'settings_get' })
    })

    if (!response.ok) {
      console.error('Failed to load settings: HTTP', response.status)
      return null
    }

    // Clone response to safely read body
    const clonedResponse = response.clone()
    const responseText = await clonedResponse.text()
    const contentType = response.headers.get('content-type')

    if (contentType?.includes('text/html') || responseText.trim().startsWith('<!')) {
      console.error('API returned HTML instead of JSON:', responseText.substring(0, 500))
      return null
    }

    const data = JSON.parse(responseText)
    if (!data?.data) return null

    // Merge platform settings and M-Pesa settings from the API response
    const platformSettings = data.data?.platformSettings || {}
    const mpesa = data.data?.mpesa || undefined

    const merged = {
      ...defaultSettings,
      ...platformSettings,
      ...(mpesa ? { mpesa } : {})
    }
    return merged
  } catch (err) {
    console.error('Failed to load settings from DB:', err)
    return null
  }
}

export async function saveSettingsToDb(s: PlatformSettings): Promise<boolean> {
  try {
    const apiUrl = getApiUrl()
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'settings_save',
        settings: s
      })
    })

    if (!response.ok) {
      console.error('Failed to save settings: HTTP', response.status)
      return false
    }

    // Clone response to safely read body
    const clonedResponse = response.clone()
    const responseText = await clonedResponse.text()
    const contentType = response.headers.get('content-type')

    if (contentType?.includes('text/html') || responseText.trim().startsWith('<!')) {
      console.error('API returned HTML instead of JSON:', responseText.substring(0, 500))
      return false
    }

    const data = JSON.parse(responseText)
    return data?.status === 'success'
  } catch (err) {
    console.error('Failed to save settings to DB:', err)
    return false
  }
}
