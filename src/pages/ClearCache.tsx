import { useEffect, useState } from 'react'
import { clearAppCache } from '@/lib/clearCache'

const ClearCache = () => {
  const [done, setDone] = useState(false)
  const [details, setDetails] = useState<string>('')

  useEffect(() => {
    (async () => {
      const { cleared, errors } = await clearAppCache()
      setDetails(`${cleared.join(', ')}${errors.length ? ' | errors: ' + errors.join(', ') : ''}`)
      setDone(true)
      // Hard reload to ensure a fresh state
      setTimeout(() => window.location.replace('/'), 600)
    })()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Clearing cache…</h1>
        <p className="text-sm text-muted-foreground">{details}</p>
        {done && <p className="text-sm mt-2">Reloading…</p>}
      </div>
    </div>
  )
}

export default ClearCache
