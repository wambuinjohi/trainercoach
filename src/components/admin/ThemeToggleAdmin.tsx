import React, { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { useTheme } from 'next-themes'

const ThemeToggleAdmin: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const isDark = (theme === 'system' ? resolvedTheme : theme) === 'dark'

  return (
    <Switch checked={isDark} onCheckedChange={(v: boolean) => setTheme(v ? 'dark' : 'light')} />
  )
}

export default ThemeToggleAdmin
