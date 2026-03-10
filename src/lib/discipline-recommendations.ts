/**
 * Discipline Recommendations System
 * 
 * Provides recommendations for:
 * - Disciplines based on popularity, trends, and user interests
 * - Trainers within a discipline based on ratings, experience, proximity
 * - Personalized recommendations based on booking history
 */

export interface Trainer {
  user_id: string
  full_name: string
  email: string
  hourly_rate?: number
  rating?: number
  num_reviews?: number
  disciplines?: string[] | string
  certifications?: string[] | string
  location_lat?: number
  location_lng?: number
  experience_years?: number
  is_approved?: boolean
}

export interface Discipline {
  id: number
  name: string
  icon?: string
  description?: string
  popularity_score?: number
  trainer_count?: number
}

export interface TrainerRecommendation {
  trainer: Trainer
  matchScore: number
  reasons: string[]
}

export interface DisciplineRecommendation {
  discipline: Discipline
  score: number
  reasons: string[]
}

/**
 * Calculate distance between two coordinates
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Normalize discipline name for comparison
 */
function normalizeDisciplineName(name: string): string {
  return name.toLowerCase().trim()
}

/**
 * Check if a trainer offers a specific discipline
 */
function trainerOffersDiscipline(trainer: Trainer, discipline: string): boolean {
  const normalizedDiscipline = normalizeDisciplineName(discipline)
  
  if (!trainer.disciplines) return false
  
  const disciplines = Array.isArray(trainer.disciplines)
    ? trainer.disciplines.map(normalizeDisciplineName)
    : [normalizeDisciplineName(String(trainer.disciplines))]
  
  return disciplines.some(d => 
    d.includes(normalizedDiscipline) || normalizedDiscipline.includes(d)
  )
}

/**
 * Calculate trainer rating score (0-100)
 */
function calculateRatingScore(rating?: number, numReviews?: number): number {
  if (!rating || rating < 0) return 0
  
  // Rating out of 5, convert to 0-100
  const ratingScore = (rating / 5) * 100
  
  // Boost score based on number of reviews (more reviews = more reliable)
  const reviewBoost = Math.min(20, (numReviews || 0) * 2)
  
  return Math.min(100, ratingScore + reviewBoost)
}

/**
 * Recommend trainers within a discipline
 * 
 * Scoring factors:
 * - Rating (40%): Higher ratings get more points
 * - Experience (20%): More years of experience
 * - Price competitiveness (20%): Lower prices than average
 * - Proximity (20%): Closer distance is better
 */
export function recommendTrainersForDiscipline(
  trainers: Trainer[],
  discipline: string,
  userLocation?: { lat: number; lng: number },
  userBudget?: number
): TrainerRecommendation[] {
  // Filter trainers who offer this discipline and are approved
  const candidateTrainers = trainers.filter(
    t => t.is_approved && trainerOffersDiscipline(t, discipline)
  )

  if (candidateTrainers.length === 0) {
    return []
  }

  // Calculate average rate for price comparison
  const rates = candidateTrainers
    .map(t => t.hourly_rate || 0)
    .filter(r => r > 0)
  const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0

  // Score each trainer
  const recommendations = candidateTrainers.map(trainer => {
    const reasons: string[] = []
    let scoreSum = 0
    let weightSum = 0

    // 1. Rating score (40% weight)
    const ratingScore = calculateRatingScore(trainer.rating, trainer.num_reviews)
    if (ratingScore > 0) {
      scoreSum += ratingScore * 0.4
      weightSum += 0.4
      
      if (trainer.rating && trainer.rating >= 4.5) {
        reasons.push(`Excellent rating (${trainer.rating}/5)`)
      } else if (trainer.rating && trainer.rating >= 4) {
        reasons.push(`Good rating (${trainer.rating}/5)`)
      }
    }

    // 2. Experience score (20% weight)
    const expScore = Math.min(100, (trainer.experience_years || 0) * 10)
    if (expScore > 0) {
      scoreSum += expScore * 0.2
      weightSum += 0.2
      
      if (trainer.experience_years && trainer.experience_years > 5) {
        reasons.push(`${trainer.experience_years}+ years experience`)
      }
    }

    // 3. Price competitiveness (20% weight)
    if (trainer.hourly_rate && avgRate > 0) {
      const priceScore = Math.max(0, 100 - ((trainer.hourly_rate / avgRate - 1) * 50))
      scoreSum += priceScore * 0.2
      weightSum += 0.2
      
      if (trainer.hourly_rate <= avgRate * 0.8) {
        reasons.push('Competitive pricing')
      }
      
      if (userBudget && trainer.hourly_rate <= userBudget) {
        reasons.push('Within your budget')
      }
    }

    // 4. Proximity score (20% weight)
    if (userLocation && trainer.location_lat && trainer.location_lng) {
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        trainer.location_lat,
        trainer.location_lng
      )
      
      // Closer is better: 0km = 100, 15km = 0
      const proximityScore = Math.max(0, 100 - (distance / 15) * 100)
      scoreSum += proximityScore * 0.2
      weightSum += 0.2
      
      if (distance < 5) {
        reasons.push(`Very close (${distance.toFixed(1)}km away)`)
      } else if (distance < 15) {
        reasons.push(`Nearby (${distance.toFixed(1)}km away)`)
      }
    } else {
      weightSum += 0.2 // Add weight even if we can't calculate distance
    }

    // Normalize score
    const matchScore = weightSum > 0 ? (scoreSum / weightSum) : 0

    return {
      trainer,
      matchScore,
      reasons: reasons.slice(0, 3), // Top 3 reasons
    }
  })

  // Sort by match score descending
  return recommendations.sort((a, b) => b.matchScore - a.matchScore)
}

/**
 * Recommend disciplines based on popularity and trends
 * 
 * Factors:
 * - Trainer availability in discipline
 * - Search popularity
 * - Average rating
 */
export function recommendDisciplines(
  disciplines: Discipline[],
  trainersByDiscipline?: Record<number, number>,
  userSearchHistory?: string[]
): DisciplineRecommendation[] {
  const recommendations = disciplines
    .filter(d => d.id) // Must have valid ID
    .map(discipline => {
      const reasons: string[] = []
      let score = 0

      // Base score from popularity
      const popularityScore = discipline.popularity_score || 50
      score += popularityScore * 0.5
      reasons.push('Popular discipline')

      // Score from trainer availability
      const trainerCount = trainersByDiscipline?.[discipline.id] || 0
      const trainerScore = Math.min(100, (trainerCount / 10) * 100)
      score += trainerScore * 0.3
      if (trainerCount > 5) {
        reasons.push(`Many trainers available (${trainerCount}+)`)
      }

      // Score from search history match
      if (userSearchHistory && userSearchHistory.length > 0) {
        const matchesHistory = userSearchHistory.some(search =>
          normalizeDisciplineName(search).includes(normalizeDisciplineName(discipline.name)) ||
          normalizeDisciplineName(discipline.name).includes(normalizeDisciplineName(search))
        )
        if (matchesHistory) {
          score += 20
          reasons.push('Matches your interests')
        }
      }

      return {
        discipline,
        score: Math.min(100, score),
        reasons,
      }
    })

  // Sort by score descending
  return recommendations.sort((a, b) => b.score - a.score)
}

/**
 * Get personalized trainer recommendations for a user
 * Based on their search history and preferences
 */
export function getPersonalizedRecommendations(
  allTrainers: Trainer[],
  allDisciplines: Discipline[],
  userPreferences?: {
    favoredDisciplines?: string[]
    location?: { lat: number; lng: number }
    budget?: number
    preferredRating?: number // minimum rating (out of 5)
    maxDistance?: number // in kilometers
  }
): {
  recommendedDisciplines: DisciplineRecommendation[]
  topTrainers: TrainerRecommendation[]
} {
  // Filter trainers based on preferences
  let filteredTrainers = allTrainers.filter(t => t.is_approved)

  if (userPreferences?.preferredRating) {
    filteredTrainers = filteredTrainers.filter(
      t => !t.rating || t.rating >= userPreferences.preferredRating!
    )
  }

  if (userPreferences?.maxDistance && userPreferences?.location) {
    filteredTrainers = filteredTrainers.filter(t => {
      if (!t.location_lat || !t.location_lng) return true
      const distance = calculateDistance(
        userPreferences.location!.lat,
        userPreferences.location!.lng,
        t.location_lat,
        t.location_lng
      )
      return distance <= userPreferences.maxDistance!
    })
  }

  // Get discipline recommendations
  const recommendedDisciplines = recommendDisciplines(
    allDisciplines,
    undefined,
    userPreferences?.favoredDisciplines
  ).slice(0, 5) // Top 5

  // Get top trainers across disciplines
  let topTrainers: TrainerRecommendation[] = []
  for (const discipline of allDisciplines.slice(0, 3)) {
    const disciplineRecommendations = recommendTrainersForDiscipline(
      filteredTrainers,
      discipline.name,
      userPreferences?.location,
      userPreferences?.budget
    ).slice(0, 3)
    topTrainers = topTrainers.concat(disciplineRecommendations)
  }

  // Remove duplicates and sort
  const seen = new Set<string>()
  topTrainers = topTrainers
    .filter(rec => {
      if (seen.has(rec.trainer.user_id)) return false
      seen.add(rec.trainer.user_id)
      return true
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10) // Top 10

  return {
    recommendedDisciplines,
    topTrainers,
  }
}

/**
 * Search and filter trainers by multiple criteria
 */
export function searchTrainers(
  allTrainers: Trainer[],
  filters: {
    discipline?: string
    minRating?: number
    maxPrice?: number
    location?: { lat: number; lng: number }
    maxDistance?: number
    searchTerm?: string
  }
): Trainer[] {
  let results = allTrainers.filter(t => t.is_approved)

  // Filter by discipline
  if (filters.discipline) {
    results = results.filter(t => trainerOffersDiscipline(t, filters.discipline!))
  }

  // Filter by rating
  if (filters.minRating) {
    results = results.filter(t => !t.rating || t.rating >= filters.minRating!)
  }

  // Filter by price
  if (filters.maxPrice) {
    results = results.filter(t => !t.hourly_rate || t.hourly_rate <= filters.maxPrice!)
  }

  // Filter by distance
  if (filters.location && filters.maxDistance) {
    results = results.filter(t => {
      if (!t.location_lat || !t.location_lng) return true
      const distance = calculateDistance(
        filters.location!.lat,
        filters.location!.lng,
        t.location_lat,
        t.location_lng
      )
      return distance <= filters.maxDistance!
    })
  }

  // Filter by search term (name or discipline)
  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase()
    results = results.filter(t => {
      const nameMatch = (t.full_name || '').toLowerCase().includes(term)
      const disciplineMatch = (Array.isArray(t.disciplines) ? t.disciplines : [String(t.disciplines || '')]).some(
        d => String(d).toLowerCase().includes(term)
      )
      return nameMatch || disciplineMatch
    })
  }

  return results
}
