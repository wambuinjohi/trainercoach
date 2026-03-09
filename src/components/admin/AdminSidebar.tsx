import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { APP_LOGO_URL, APP_LOGO_DARK_URL, APP_LOGO_ALT } from '@/lib/branding'
import { ADMIN_SIDEBAR_ITEMS } from '@/lib/admin-config'
import { useTheme } from 'next-themes'
import { useNavigate, useLocation } from 'react-router-dom'

type MenuItem = { key: string; label: string; icon: React.ComponentType<{ className?: string }> }

interface AdminSidebarProps {
  value?: string
  onChange?: (v: string) => void
  onSignOut?: () => void
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ value, onChange, onSignOut }) => {
  const [open, setOpen] = useState(false)
  const { resolvedTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const logoSrc = resolvedTheme === 'dark' ? APP_LOGO_DARK_URL : APP_LOGO_URL

  // Extract current page from URL if value not provided
  const currentPage = value || location.pathname.split('/admin/')[1] || 'overview'

  const handleNavigate = (key: string) => {
    navigate(`/admin/${key}`)
    if (onChange) onChange(key)
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-card ring-1 ring-border/60 transition-colors duration-300 dark:bg-white">
            <img src={logoSrc} alt={APP_LOGO_ALT} className="h-16 w-auto object-contain" loading="lazy" />
          </div>
          <div className="text-left">
            <div className="text-base font-semibold">Admin</div>
            <div className="text-xs text-muted-foreground">Dashboard</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="admin-mobile-menu">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </Button>
      </div>

      {/* Mobile collapsible menu */}
      <div id="admin-mobile-menu" className={cn('md:hidden overflow-hidden transition-all', open ? 'max-h-screen' : 'max-h-0')}>
        <div className="flex flex-col gap-1 p-3 border-b border-border bg-card">
          {ADMIN_SIDEBAR_ITEMS.map(item => {
            const active = currentPage === item.key
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => { handleNavigate(item.key); setOpen(false) }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md flex items-center gap-3 text-sm',
                  active ? 'bg-background text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="opacity-80"><Icon className="h-4 w-4" /></span>
                <span>{item.label}</span>
              </button>
            )
          })}

          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={() => { setOpen(false); onSignOut && onSignOut() }}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 lg:w-72 p-4 gap-3 bg-card border-r border-border">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-white shadow-card ring-1 ring-border/60 transition-colors duration-300 dark:bg-white">
            <img src={logoSrc} alt={APP_LOGO_ALT} className="h-20 w-auto object-contain" loading="lazy" />
          </div>
          <div>
            <div className="text-lg font-semibold leading-tight">Admin</div>
            <div className="text-sm text-muted-foreground">Dashboard</div>
          </div>
        </div>
        <nav className="flex-1 flex flex-col gap-1">
          {ADMIN_SIDEBAR_ITEMS.map(item => {
            const active = currentPage === item.key
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => handleNavigate(item.key)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md flex items-center gap-3 text-sm',
                  active ? 'bg-background text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="opacity-90"><Icon className="h-4 w-4" /></span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onSignOut && onSignOut()} className="w-full">Sign Out</Button>
        </div>
      </aside>
    </>
  )
}

export default AdminSidebar
