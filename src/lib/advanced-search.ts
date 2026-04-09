import { fuzzyScore } from './search-utils'

export interface AdvancedSearchOptions {
  query?: string
  minRating?: number
  maxPrice?: number
  radius?: number
  categoryIds?: number[]
  onlyAvailable?: boolean
  sortBy?: 'relevance' | 'rating' | 'price' | 'distance'
  sortOrder?: 'asc' | 'desc'
}

export interface SearchResult<T> {
  item: T
  score: number
  matchedFields: string[]
}

/**
 * Advanced search with scoring and filtering
 */
export function advancedSearch<T extends Record<string, any>>(
  items: T[],
  options: AdvancedSearchOptions,
  searchFields: (keyof T)[] = ['name'],
): SearchResult<T>[] {
  let results = items.map(item => ({
    item,
    score: 0,
    matchedFields: [] as string[],
  }))

  // Apply search query scoring
  if (options.query && options.query.trim()) {
    results = results.map(result => {
      let maxScore = 0
      const matchedFields: string[] = []

      for (const field of searchFields) {
        const value = String(result.item[field] || '')
        const score = fuzzyScore(value, options.query!)

        if (score > 0) {
          matchedFields.push(String(field))
          maxScore = Math.max(maxScore, score)
        }
      }

      return {
        ...result,
        score: maxScore,
        matchedFields,
      }
    })

    // Filter out non-matching items
    results = results.filter(r => r.score > 0)
  }

  // Apply filters
  results = results.filter(result => {
    const item = result.item

    // Rating filter
    if (options.minRating && (item.rating || 0) < options.minRating) {
      return false
    }

    // Price filter
    if (options.maxPrice && (item.hourlyRate || item.price || 0) > options.maxPrice) {
      return false
    }

    // Category filter
    if (options.categoryIds && options.categoryIds.length > 0) {
      const itemCategories = item.categoryIds || item.categories || []
      const hasCategory = options.categoryIds.some(id =>
        itemCategories.includes(id)
      )
      if (!hasCategory) return false
    }

    // Distance filter
    if (options.radius && (item.distanceKm == null || item.distanceKm > options.radius)) {
      return false
    }

    // Availability filter
    if (options.onlyAvailable && !item.available && item.is_available !== true) {
      return false
    }

    return true
  })

  // Sort results
  const sortBy = options.sortBy || 'relevance'
  const sortOrder = options.sortOrder || 'desc'

  results.sort((a, b) => {
    let aVal = 0
    let bVal = 0

    switch (sortBy) {
      case 'relevance':
        aVal = a.score
        bVal = b.score
        break
      case 'rating':
        aVal = a.item.rating || 0
        bVal = b.item.rating || 0
        break
      case 'price':
        aVal = a.item.hourlyRate || a.item.price || 0
        bVal = b.item.hourlyRate || b.item.price || 0
        break
      case 'distance':
        aVal = a.item.distanceKm ?? Infinity
        bVal = b.item.distanceKm ?? Infinity
        break
    }

    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
  })

  return results
}

/**
 * Get search statistics
 */
export function getSearchStats<T extends Record<string, any>>(
  results: SearchResult<T>[],
): {
  total: number
  averageScore: number
  topScore: number
  minScore: number
} {
  if (results.length === 0) {
    return {
      total: 0,
      averageScore: 0,
      topScore: 0,
      minScore: 0,
    }
  }

  const scores = results.map(r => r.score)
  const total = results.length
  const averageScore = scores.reduce((a, b) => a + b, 0) / total
  const topScore = Math.max(...scores)
  const minScore = Math.min(...scores)

  return {
    total,
    averageScore,
    topScore,
    minScore,
  }
}

/**
 * Build a query string from search options
 */
export function buildSearchQuery(options: AdvancedSearchOptions): string {
  const parts: string[] = []

  if (options.query) parts.push(`q:${options.query}`)
  if (options.minRating) parts.push(`rating:${options.minRating}+`)
  if (options.maxPrice) parts.push(`price:${options.maxPrice}-`)
  if (options.radius) parts.push(`radius:${options.radius}km`)
  if (options.categoryIds?.length) parts.push(`cat:${options.categoryIds.join(',')}`)
  if (options.onlyAvailable) parts.push('available:yes')

  return parts.join(' ')
}

/**
 * Parse a query string into search options
 */
export function parseSearchQuery(queryString: string): AdvancedSearchOptions {
  const options: AdvancedSearchOptions = {}
  const tokens = queryString.split(/\s+/)

  for (const token of tokens) {
    if (token.startsWith('q:')) {
      options.query = token.slice(2)
    } else if (token.startsWith('rating:')) {
      options.minRating = parseInt(token.slice(7))
    } else if (token.startsWith('price:')) {
      options.maxPrice = parseInt(token.slice(6))
    } else if (token.startsWith('radius:')) {
      options.radius = parseInt(token.slice(7))
    } else if (token.startsWith('cat:')) {
      options.categoryIds = token.slice(4).split(',').map(Number)
    } else if (token === 'available:yes') {
      options.onlyAvailable = true
    }
  }

  return options
}
