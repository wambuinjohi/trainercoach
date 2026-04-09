import { useState, useEffect, useCallback } from 'react'

const RECENT_SEARCHES_KEY = 'recent_searches'
const SEARCH_HISTORY_LIMIT = 10

export interface UseSearchHistoryOptions {
  trainers?: Array<{ name: string; discipline?: string }>
  limit?: number
}

export function useSearchHistory(options: UseSearchHistoryOptions = {}) {
  const { trainers = [], limit = SEARCH_HISTORY_LIMIT } = options
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [popularSearches, setPopularSearches] = useState<string[]>([])

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setRecentSearches(Array.isArray(parsed) ? parsed.slice(0, limit) : [])
      } catch (err) {
        console.warn('Failed to parse recent searches', err)
        setRecentSearches([])
      }
    }
  }, [limit])

  // Generate popular searches from trainer names
  useEffect(() => {
    const popular = trainers
      .filter((t): t is { name: string; discipline?: string } => Boolean(t.name))
      .map(t => {
        const parts = []
        if (t.name) parts.push(t.name)
        if (t.discipline) parts.push(t.discipline)
        return parts
      })
      .flat()
      .filter((v, i, a) => a.indexOf(v) === i) // unique
      .sort()
      .slice(0, 5)
    setPopularSearches(popular)
  }, [trainers])

  // Add search to history
  const addSearch = useCallback((query: string) => {
    if (!query || query.trim().length === 0) return

    const trimmed = query.trim()
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== trimmed)
      const updated = [trimmed, ...filtered].slice(0, limit)
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
      return updated
    })
  }, [limit])

  // Clear search history
  const clearHistory = useCallback(() => {
    setRecentSearches([])
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  }, [])

  return {
    recentSearches,
    popularSearches,
    addSearch,
    clearHistory,
  }
}
