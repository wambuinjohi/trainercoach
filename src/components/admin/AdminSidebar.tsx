import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { APP_LOGO_URL, APP_LOGO_DARK_URL, APP_LOGO_ALT } from '@/lib/branding'
import { ADMIN_SIDEBAR_ITEMS } from '@/lib/admin-config'
import { useTheme } from 'next-themes'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'

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

  const closeMenu = () => setOpen(false)

  return (
    <>
      <style>{`
        @keyframes slideInFromLeft {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOutToLeft {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(-100%);
            opacity: 0;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        .menu-slide-in {
          animation: slideInFromLeft 0.3s ease-out forwards;
        }

        .menu-slide-out {
          animation: slideOutToLeft 0.3s ease-in forwards;
        }

        .overlay-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }

        .overlay-fade-out {
          animation: fadeOut 0.3s ease-in forwards;
        }
      `}</style>

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

      {/* Mobile Menu Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden overlay-fade-in z-40"
          onClick={closeMenu}
        />
      )}

      {/* Mobile Slide Menu Panel */}
      {open && (
        <div
          id="admin-mobile-menu"
          className="fixed left-0 top-24 h-[calc(100vh-6rem)] w-64 bg-card border-r border-border md:hidden menu-slide-in z-50 overflow-y-auto"
        >
          <div className="flex flex-col gap-1 p-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 mb-2"
              onClick={() => { closeMenu(); onSignOut && onSignOut() }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
            <div className="my-1 border-b border-border"></div>

            {ADMIN_SIDEBAR_ITEMS.map(item => {
              const active = currentPage === item.key
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  onClick={() => { handleNavigate(item.key); closeMenu() }}
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

            <div className="mt-3 pt-3 border-t border-border">
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { closeMenu(); onSignOut && onSignOut() }}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 lg:w-72 p-5 gap-4 bg-gradient-to-b from-card to-card/50 border-r border-border/40 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary/10 ring-1 ring-gradient-primary/20 transition-all duration-300 hover:ring-gradient-primary/40">
              <img src={logoSrc} alt={APP_LOGO_ALT} className="h-8 w-auto object-contain" loading="lazy" />
            </div>
            <div>
              <div className="text-base font-bold leading-tight bg-gradient-primary bg-clip-text text-transparent">Admin</div>
              <div className="text-xs font-medium text-muted-foreground">Dashboard</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSignOut && onSignOut()}
            title="Logout"
            className="text-muted-foreground hover:text-foreground hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-border via-border to-transparent"></div>

        <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
          {ADMIN_SIDEBAR_ITEMS.map(item => {
            const active = currentPage === item.key
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => handleNavigate(item.key)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-gradient-primary/10 text-primary shadow-sm ring-1 ring-gradient-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <span className={cn(
                  'transition-colors',
                  active ? 'text-primary' : 'group-hover:text-foreground'
                )}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-border"></div>

        <Button
          variant="outline"
          onClick={() => onSignOut && onSignOut()}
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 border-red-200/40 dark:border-red-900/40 rounded-lg font-medium transition-colors"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </aside>
    </>
  )
}

export default AdminSidebar
