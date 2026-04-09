/**
 * Simple fuzzy search algorithm
 * Returns a score between 0 and 1 where 1 is a perfect match
 */
export function fuzzyScore(haystack: string, needle: string): number {
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()

  if (n === h) return 1
  if (!h.includes(n)) return 0

  let score = 0
  const matchStart = h.indexOf(n)

  // Exact substring match gets a high score
  if (matchStart === 0) score = 0.9
  else if (matchStart > 0) score = 0.7

  // Bonus for shorter matches (more specific)
  score *= 1 / (1 + n.length / h.length)

  return Math.min(1, score)
}

/**
 * Filter and rank trainers based on search query
 */
export interface SearchableTrainer {
  id: string
  name: string
  discipline?: string
  [key: string]: any
}

export function searchTrainers(
  trainers: SearchableTrainer[],
  query: string,
  options = { fuzzy: true, limit: 10 }
): SearchableTrainer[] {
  if (!query || query.trim().length === 0) {
    return trainers
  }

  const q = query.toLowerCase()
  const scored = trainers.map(trainer => {
    const nameScore = fuzzyScore(trainer.name || '', query)
    const disciplineScore = fuzzyScore(trainer.discipline || '', query)
    const score = Math.max(nameScore, disciplineScore)

    return {
      trainer,
      score,
    }
  })

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit)
    .map(item => item.trainer)
}

/**
 * Extract unique suggestions from trainers
 */
export function generateSuggestions(
  trainers: SearchableTrainer[],
  query: string,
  limit = 5
): string[] {
  if (!query || query.trim().length === 0) {
    return trainers
      .map(t => t.name)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, limit)
  }

  const matching = trainers
    .map(t => t.name)
    .filter(name => name.toLowerCase().includes(query.toLowerCase()))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, limit)

  return matching
}

/**
 * Highlight search query in text
 */
export function highlightQuery(text: string, query: string): { text: string; highlighted: boolean }[] {
  if (!query) {
    return [{ text, highlighted: false }]
  }

  const parts: { text: string; highlighted: boolean }[] = []
  const regex = new RegExp(`(${query})`, 'gi')
  const split = text.split(regex)

  for (const part of split) {
    if (part) {
      parts.push({
        text: part,
        highlighted: regex.test(part),
      })
    }
  }

  return parts
}
