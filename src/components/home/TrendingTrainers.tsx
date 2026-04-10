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
      <section className="py-20 lg:py-32">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">Trending in Nairobi</h2>
          <div className="grid sm:grid-cols-2 gap-6">
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
    <section className="py-20 lg:py-32">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">Trending in Nairobi</h2>
        <p className="text-lg text-muted-foreground mb-12">
          Connect with our top-rated trainers
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
                <div className="flex flex-col h-full">
                  {/* Image or Fallback */}
                  <div className="relative w-full h-32 sm:h-48 lg:h-72 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center overflow-hidden">
                    {showFallback ? (
                      <div className={`w-full h-full ${getAvatarColor(trainer.id)} flex items-center justify-center`}>
                        <span className="text-white text-4xl sm:text-6xl lg:text-7xl font-semibold">{getInitials(trainer.name)}</span>
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

                    {/* Verified Badge */}
                    {trainer.verified && (
                      <div className="absolute top-4 right-4 bg-green-500 dark:bg-green-600 rounded-full p-2 shadow-md">
                        <CheckCircle className="w-6 h-6 text-white fill-current" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <CardContent className="flex-1 p-2 sm:p-4 lg:p-6 flex flex-col justify-between">
                    {/* Category Badge and Name */}
                    <div className="mb-2 sm:mb-3 lg:mb-4">
                      {categoryNames.length > 0 && (
                        <Badge className="mb-1 sm:mb-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs inline-block w-fit font-medium">
                          {categoryNames[0]}
                        </Badge>
                      )}

                      {/* Trainer Name */}
                      <h3 className="text-sm sm:text-lg lg:text-xl font-bold text-foreground mb-0.5 sm:mb-1 line-clamp-2">
                        {trainer.name}
                      </h3>

                      {/* Specialty */}
                      <p className="text-xs sm:text-sm lg:text-base text-muted-foreground line-clamp-1">
                        {getSpecialty(trainer, categoryNames)}
                      </p>
                    </div>

                    {/* Rating */}
                    {trainer.rating > 0 && (
                      <div className="flex items-center gap-1 sm:gap-2 mb-2 sm:mb-4">
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
                      </div>
                    )}

                    {/* Book Now Button */}
                    <Button
                      onClick={() => onBookNow?.(trainer)}
                      className="w-full bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white font-semibold py-1.5 sm:py-2 lg:py-3 text-xs sm:text-sm lg:text-base"
                    >
                      Book Now
                    </Button>
                  </CardContent>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default TrendingTrainers
