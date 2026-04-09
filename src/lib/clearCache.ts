export async function clearAppCache(): Promise<{ cleared: string[]; errors: string[] }> {
  const cleared: string[] = []
  const errors: string[] = []

  try {
    // Local/session storage
    const lsKeys = Object.keys(localStorage)
    localStorage.clear()
    cleared.push(`localStorage:${lsKeys.length}`)
  } catch (e: any) {
    errors.push(`localStorage:${e?.message || String(e)}`)
  }
  try {
    const ssKeys = Object.keys(sessionStorage)
    sessionStorage.clear()
    cleared.push(`sessionStorage:${ssKeys.length}`)
  } catch (e: any) {
    errors.push(`sessionStorage:${e?.message || String(e)}`)
  }

  // Delete caches (service worker/HTTP cache)
  try {
    if (typeof caches !== 'undefined' && caches?.keys) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
      cleared.push(`caches:${keys.length}`)
    }
  } catch (e: any) {
    errors.push(`caches:${e?.message || String(e)}`)
  }

  // IndexedDB databases
  try {
    const anyWindow: any = window as any
    if (anyWindow.indexedDB && anyWindow.indexedDB.databases) {
      const dbs: Array<{ name?: string }> = await anyWindow.indexedDB.databases()
      await Promise.all(
        dbs.map(db => new Promise<void>((resolve) => {
          if (!db?.name) return resolve()
          const req = indexedDB.deleteDatabase(db.name)
          req.onsuccess = () => resolve()
          req.onerror = () => resolve()
          req.onblocked = () => resolve()
        }))
      )
      cleared.push(`indexedDB:${dbs.length}`)
    } else {
      // Best-effort known names
      const known = ['supabase-auth', 'sb-storage']
      await Promise.all(
        known.map(name => new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase(name)
          req.onsuccess = () => resolve()
          req.onerror = () => resolve()
          req.onblocked = () => resolve()
        }))
      )
      cleared.push('indexedDB:best-effort')
    }
  } catch (e: any) {
    errors.push(`indexedDB:${e?.message || String(e)}`)
  }

  return { cleared, errors }
}
