import { useEffect, useState } from 'react'
import { getApiUrl, getLastSuccessfulApiUrl } from '@/lib/api'

export interface ApiStatus {
  primaryUrl: string
  fallbackUrl: string
  currentUrl: string
  activeUrl: string | null
  isFallback: boolean
  hasBeenTested: boolean
}

export function useApiStatus(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>({
    primaryUrl: getApiUrl(),
    fallbackUrl: '/api.php',
    currentUrl: getApiUrl(),
    activeUrl: getLastSuccessfulApiUrl(),
    isFallback: false,
    hasBeenTested: !!getLastSuccessfulApiUrl(),
  })

  useEffect(() => {
    // Update on mount and when API URL changes
    const updateStatus = () => {
      const currentUrl = getApiUrl()
      const activeUrl = getLastSuccessfulApiUrl()
      const isFallback = activeUrl === '/api.php'
      
      setStatus({
        primaryUrl: currentUrl,
        fallbackUrl: '/api.php',
        currentUrl: currentUrl,
        activeUrl: activeUrl,
        isFallback: isFallback,
        hasBeenTested: !!activeUrl,
      })
    }

    updateStatus()

    // Listen for storage changes (API URL changed in another tab/window)
    const handleStorageChange = () => {
      updateStatus()
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return status
}
