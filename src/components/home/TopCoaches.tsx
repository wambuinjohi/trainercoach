import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Star, Trophy, Award } from 'lucide-react'

interface TopCoachesProps {
  trainers: any[]
  categories: any[]
  isLoading?: boolean
  onBookNow?: (trainer: any) => void
}

export const TopCoaches: React.FC<TopCoachesProps> = ({ trainers, categories, isLoading = false, onBookNow }) => {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const handleImageError = (trainerId: string) => {
    setImageErrors(prev => new Set([...prev, trainerId]))
  }

  // Get initials from trainer name
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // Generate a consistent avatar color based on trainer ID
  const getAvatarColor = (id: string) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-green-500',
      'bg-amber-500',
      'bg-cyan-500',
      'bg-red-500',
      'bg-indigo-500'
    ]
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  // Determine badge type based on experience level
  const getExperienceBadge = (experienceLevel?: string) => {
    if (!experienceLevel) return null

    if (experienceLevel.toLowerCase().includes('pro')) {
      return (
        <Badge className="bg-purple-600 dark:bg-purple-700 text-white inline-flex items-center gap-1">
          <Award className="h-3 w-3" />
          Pro Trainer
        </Badge>
      )
    }

    if (experienceLevel.toLowerCase().includes('certified')) {
      return (
        <Badge className="bg-blue-600 dark:bg-blue-700 text-white inline-flex items-center gap-1">
          <Trophy className="h-3 w-3" />
          Certified Coach
        </Badge>
      )
    }

    if (experienceLevel.toLowerCase().includes('new')) {
      return (
        <Badge className="bg-green-600 dark:bg-green-700 text-white inline-flex items-center gap-1">
          New
        </Badge>
      )
    }

    return (
      <Badge className="bg-slate-600 dark:bg-slate-700 text-white" variant="secondary">
        {experienceLevel}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <section className="py-20 lg:py-32 bg-muted/30 dark:bg-slate-900/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">Top Coaches This Week</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[1, 2].map(i => (
              <div key={i} className="bg-slate-200 dark:bg-slate-700 rounded-lg h-48 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (!trainers || trainers.length === 0) {
    return null
  }

  return (
    <section className="py-20 lg:py-32 bg-muted/30">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">Top Coaches This Week</h2>
        <p className="text-lg text-muted-foreground mb-12">
          Meet our most-reviewed and highest-rated coaches
        </p>

        <div className="grid sm:grid-cols-2 gap-6">
          {trainers.map((trainer) => {
            const categoryNames = trainer.categoryIds
              ? trainer.categoryIds
                  .map((id: number) => categories.find(c => c.id === id)?.name)
                  .filter(Boolean)
              : []
            
            const hasImageError = imageErrors.has(trainer.id)
            const showFallback = !trainer.image_url || hasImageError

            return (
              <Card
                key={trainer.id}
                className="overflow-hidden hover:shadow-xl transition-all duration-300 bg-white dark:bg-slate-800 border-0 rounded-lg"
              >
                <CardContent className="p-4 sm:p-6 flex gap-4 sm:gap-6 h-full">
                  {/* Left: Profile Image - Circular */}
                  <div className="flex-shrink-0 w-24 h-24 sm:w-36 sm:h-36 rounded-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center shadow-md">
                    {showFallback ? (
                      <div className={`w-full h-full ${getAvatarColor(trainer.id)} flex items-center justify-center`}>
                        <span className="text-white text-3xl sm:text-5xl font-semibold">{getInitials(trainer.name)}</span>
                      </div>
                    ) : (
                      <img
                        src={trainer.image_url}
                        alt={trainer.name}
                        onError={() => handleImageError(trainer.id)}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>

                  {/* Right: Content */}
                  <div className="flex-1 flex flex-col justify-center gap-2 sm:gap-3">
                    {/* Name */}
                    <h3 className="text-lg sm:text-xl font-bold text-foreground line-clamp-1">
                      {trainer.name}
                    </h3>

                    {/* Specialty */}
                    <p className="text-sm sm:text-base text-muted-foreground line-clamp-1">
                      {trainer.bio ? trainer.bio.split('\n')[0] : `${categoryNames[0] || 'Training'} Specialist`}
                    </p>

                    {/* Experience Badge */}
                    {trainer.experience_level && (
                      <div className="mb-1">
                        {getExperienceBadge(trainer.experience_level)}
                      </div>
                    )}

                    {/* Rating */}
                    {trainer.rating > 0 && (
                      <div className="flex items-center gap-1 sm:gap-2">
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 sm:h-5 sm:w-5 ${
                                i < Math.round(trainer.rating)
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'fill-slate-300 text-slate-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm sm:text-base font-semibold text-foreground">{trainer.rating.toFixed(1)}</span>
                        <span className="text-xs sm:text-sm text-muted-foreground">({trainer.total_reviews || 0})</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default TopCoaches
