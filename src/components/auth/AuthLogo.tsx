import React, { memo } from 'react'
import { useTheme } from 'next-themes'
import { APP_LOGO_URL, APP_LOGO_ALT, APP_LOGO_DARK_URL } from '@/lib/branding'

const AuthLogoComponent: React.FC<{ className?: string; containerClassName?: string; compact?: boolean }> = ({ className = '', containerClassName = '', compact = false }) => {
  console.log('[AuthLogo] Rendering logo')
  const { resolvedTheme } = useTheme()
  const logoSrc = resolvedTheme === 'dark' ? APP_LOGO_DARK_URL : APP_LOGO_URL

  if (compact) {
    return (
      <div className={`flex items-center ${containerClassName ? '' : ''}`}>
        <div className={`flex items-center justify-center overflow-hidden rounded-md bg-transparent ${containerClassName}`}>
          <img
            src={logoSrc}
            alt={APP_LOGO_ALT}
            className={`w-auto object-contain drop-shadow-none dark:brightness-110 ${className || 'h-6'}`}
            loading="eager"
          />
        </div>
      </div>
    )
  }

  return (
    <div className={`relative flex flex-col items-center justify-center gap-4 text-center ${containerClassName ? '' : ''}`}>
      <div className={`flex h-64 w-64 sm:h-72 sm:w-72 md:h-80 md:w-80 items-center justify-center overflow-hidden rounded-3xl bg-white/95 shadow-card ring-1 ring-border/60 transition-all duration-500 dark:bg-transparent dark:ring-transparent dark:shadow-none ${containerClassName}`}>
        <img
          src={logoSrc}
          alt={APP_LOGO_ALT}
          className={`h-48 w-auto object-contain sm:h-56 md:h-64 drop-shadow-[0_18px_32px_rgba(28,28,28,0.15)] dark:brightness-110 dark:drop-shadow-[0_22px_35px_rgba(0,0,0,0.65)] ${className}`}
          loading="eager"
        />
      </div>
      <div className="space-y-1 leading-tight">
        <span className="text-lg font-semibold tracking-wide text-foreground">Trainer</span>
      </div>
    </div>
  )
}

export const AuthLogo = memo(AuthLogoComponent)

export default AuthLogo
