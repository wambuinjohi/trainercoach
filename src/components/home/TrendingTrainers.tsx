import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Star, CheckCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

interface TrendingTrainersProps {
  trainers: any[]
  categories: any[]
  isLoading?: boolean
  onBookNow?: (trainer: any) => void
}

export const TrendingTrainers: React.FC<TrendingTrainersProps> = ({ trainers, categories, isLoading = false, onBookNow }) => {
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

  // Generate specialty text from bio or categories
  const getSpecialty = (trainer: any, categoryNames: string[]) => {
    if (trainer.bio) return trainer.bio.split('\n')[0]
    return categoryNames.length > 0 ? `${categoryNames[0]} Specialist` : 'Training Specialist'
  }

  const getCategoryName = (categoryId: number) => {
    return categories.find(c => c.id === categoryId)?.name || 'Training'
  }

  if (isLoading) {
    return (
      <section className="py-4 lg:py-6">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 text-foreground">Trending in Nairobi</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            {[1, 2].map(i => (
              <div key={i} className="bg-slate-200 dark:bg-slate-700 rounded-lg h-96 animate-pulse" />
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
    <section className="py-8 lg:py-10 bg-muted/30">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">Trending in Nairobi</h2>
        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground mb-6">
          Connect with our top-rated trainers
        </p>

        <div className="grid grid-cols-2 gap-3 sm:gap-6">
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
                <CardContent className="p-2 sm:p-4 lg:p-6 flex gap-2 sm:gap-4 lg:gap-6 h-full">
                  {/* Left: Profile Image - Circular */}
                  <div className="flex-shrink-0 w-16 h-16 sm:w-24 sm:h-24 lg:w-36 lg:h-36 rounded-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center shadow-md">
                    {showFallback ? (
                      <div className={`w-full h-full ${getAvatarColor(trainer.id)} flex items-center justify-center`}>
                        <span className="text-white text-xl sm:text-3xl lg:text-5xl font-semibold">{getInitials(trainer.name)}</span>
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
                  <div className="flex-1 flex flex-col justify-center gap-1 sm:gap-2 lg:gap-3">
                    {/* Name */}
                    <h3 className="text-xs sm:text-lg lg:text-xl font-bold text-foreground line-clamp-1">
                      {trainer.name}
                    </h3>

                    {/* Specialty */}
                    <p className="text-xs sm:text-sm lg:text-base text-muted-foreground line-clamp-1">
                      {getSpecialty(trainer, categoryNames)}
                    </p>

                    {/* Category Badge */}
                    {categoryNames.length > 0 && (
                      <Badge className="bg-emerald-600 dark:bg-emerald-700 text-white inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5">
                        {categoryNames[0]}
                      </Badge>
                    )}

                    {/* Rating */}
                    {trainer.rating > 0 && (
                      <div className="flex items-center gap-0.5 sm:gap-1 lg:gap-2">
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 ${
                                i < Math.round(trainer.rating)
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'fill-slate-300 text-slate-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs sm:text-sm lg:text-base font-semibold text-foreground">{trainer.rating.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">({trainer.total_reviews || 0})</span>
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

export default TrendingTrainers
