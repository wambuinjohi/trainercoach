import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Users, Calendar, BarChart3, UserCheck, AlertCircle, Settings, TrendingUp, CheckCircle, MessageSquare, DollarSign, Plus, Trash2, Database, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_LOGO_URL, APP_LOGO_DARK_URL, APP_LOGO_ALT } from '@/lib/branding'
import { useTheme } from 'next-themes'

type MenuItem = { key: string; label: string; icon?: React.ReactNode }

interface AdminSidebarProps {
  value: string
  onChange: (v: string) => void
  onSignOut?: () => void
}

const ITEMS: MenuItem[] = [
  { key: 'overview', label: 'Overview', icon: <Users className="h-4 w-4" /> },
  { key: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { key: 'approvals', label: 'Approvals', icon: <UserCheck className="h-4 w-4" /> },
  { key: 'disputes', label: 'Disputes', icon: <AlertCircle className="h-4 w-4" /> },
  { key: 'issues', label: 'Issues', icon: <MessageSquare className="h-4 w-4" /> },
  { key: 'contacts', label: 'Contacts', icon: <MessageSquare className="h-4 w-4" /> },
  { key: 'analytics', label: 'Analytics', icon: <TrendingUp className="h-4 w-4" /> },
  { key: 'promotions', label: 'Promotions', icon: <MessageSquare className="h-4 w-4" /> },
  { key: 'payouts', label: 'Payouts', icon: <DollarSign className="h-4 w-4" /> },
  { key: 'sms', label: 'SMS Manager', icon: <MessageSquare className="h-4 w-4" /> },
  { key: 'categories', label: 'Categories', icon: <Plus className="h-4 w-4" /> },
  { key: 'waitlist', label: 'Waiting List', icon: <Clock className="h-4 w-4" /> },
  { key: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
]

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ value, onChange, onSignOut }) => {
  const [open, setOpen] = useState(false)
  const { resolvedTheme } = useTheme()
  const logoSrc = resolvedTheme === 'dark' ? APP_LOGO_DARK_URL : APP_LOGO_URL

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
          {ITEMS.map(item => {
            const active = value === item.key
            return (
              <button
                key={item.key}
                onClick={() => { onChange(item.key); setOpen(false) }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md flex items-center gap-3 text-sm',
                  active ? 'bg-background text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="opacity-80">{item.icon}</span>
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
          {ITEMS.map(item => {
            const active = value === item.key
            return (
              <button
                key={item.key}
                onClick={() => onChange(item.key)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md flex items-center gap-3 text-sm',
                  active ? 'bg-background text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="opacity-90">{item.icon}</span>
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
