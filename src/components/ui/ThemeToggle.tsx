import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const current = theme === 'system' ? resolvedTheme : theme

  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(current === 'dark' ? 'light' : 'dark')}
      className="absolute -top-2 right-0 p-3 rounded-md bg-transparent hover:bg-muted/20"
    >
      {current === 'dark' ? <Sun className="h-8 w-8 text-foreground" /> : <Moon className="h-8 w-8 text-foreground" />}
    </button>
  )
}

export default ThemeToggle
