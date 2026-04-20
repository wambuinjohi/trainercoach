import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Star } from 'lucide-react'

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


  if (isLoading) {
    return (
      <section className="py-8 lg:py-10 bg-muted/30 dark:bg-slate-900/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 text-foreground">Top Coaches This Week</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
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
    <section className="py-8 lg:py-10 bg-muted/30">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">Top Coaches This Week</h2>
        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground mb-6">
          Meet our most-reviewed and highest-rated coaches
        </p>

        <div className="space-y-3 md:space-y-4">
          {trainers.map((trainer) => {
            const categoryNames = trainer.categoryIds
              ? trainer.categoryIds
                  .map((id: number) => categories.find(c => c.id === id)?.name)
                  .filter(Boolean)
              : []
            const displayCategory = categoryNames[0]

            const hasImageError = imageErrors.has(trainer.id)
            const showFallback = !trainer.image_url || hasImageError

            // Format hourly rate
            const formatHourlyRate = (rate: number | null | undefined): string => {
              if (rate == null || rate === 0) return '0'
              const num = Number(rate)
              if (!Number.isFinite(num)) return '0'
              if (num % 1 === 0) {
                return num.toLocaleString()
              }
              return num.toFixed(2).replace(/\.?0+$/, '')
            }

            return (
              <Card
                key={trainer.id}
                className="bg-card border-border hover:border-muted-foreground/50 transition-colors"
              >
                <CardContent className="p-3 md:p-4">
                  <div className="flex gap-2 md:gap-4">
                    {/* Trainer Image - Left */}
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-primary flex items-center justify-center text-xl md:text-2xl overflow-hidden">
                        {showFallback ? (
                          '👤'
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
                    </div>

                    {/* Content - Right */}
                    <div className="flex-1 min-w-0 space-y-1 md:space-y-2">
                      {/* Name and Category Badge */}
                      <div className="flex items-start gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground text-base md:text-lg break-words line-clamp-2">
                              {trainer.name}
                            </h3>
                            {trainer.rating >= 4.8 && (
                              <Badge className="bg-blue-600 text-white text-xs flex-shrink-0 whitespace-nowrap">
                                Pro Trainer
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                            {trainer.bio ? trainer.bio.split('\n')[0] : `${displayCategory || 'Training'} Specialist`}
                          </p>
                        </div>
                        {displayCategory && (
                          <Badge className="bg-emerald-600 text-white text-xs flex-shrink-0 whitespace-nowrap">
                            {displayCategory}
                          </Badge>
                        )}
                      </div>

                      {/* Rating and Experience */}
                      <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm flex-wrap">
                        <div className="flex items-center gap-1">
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 md:h-4 md:w-4 ${
                                  i < Math.floor(trainer.rating || 0)
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-muted-foreground'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="font-semibold text-foreground text-xs md:text-sm">
                            {trainer.rating?.toFixed(1) || '0.0'}
                          </span>
                          <span className="text-muted-foreground text-xs hidden sm:inline">
                            ({trainer.total_reviews || 0})
                          </span>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-xs md:text-sm">
                        <span className="font-semibold text-foreground">Ksh {formatHourlyRate(trainer.hourlyRate || 0)}</span>
                        <span className="text-muted-foreground">/hr</span>
                      </div>
                    </div>
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
