import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Star, MapPin, DollarSign, TrendingUp } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import {
  recommendDisciplines,
  recommendTrainersForDiscipline,
  getPersonalizedRecommendations,
  type DisciplineRecommendation,
  type TrainerRecommendation,
} from '@/lib/discipline-recommendations'

interface DisciplineRecommendationsProps {
  onDisciplineSelect?: (disciplineName: string) => void
  onTrainerSelect?: (trainerId: string) => void
  showTopTrainers?: boolean
  userLocation?: { lat: number; lng: number }
  userBudget?: number
}

export const DisciplineRecommendations: React.FC<DisciplineRecommendationsProps> = ({
  onDisciplineSelect,
  onTrainerSelect,
  showTopTrainers = true,
  userLocation,
  userBudget,
}) => {
  const [loading, setLoading] = useState(true)
  const [disciplines, setDisciplines] = useState<DisciplineRecommendation[]>([])
  const [topTrainers, setTopTrainers] = useState<TrainerRecommendation[]>([])
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null)
  const [disciplineTrainers, setDisciplineTrainers] = useState<TrainerRecommendation[]>([])
  const [trainerLoading, setTrainerLoading] = useState(false)

  // Load disciplines on mount
  useEffect(() => {
    loadRecommendations()
  }, [])

  const loadRecommendations = async () => {
    try {
      setLoading(true)

      // Fetch all data needed
      const [categoriesRes, usersRes] = await Promise.all([
        apiService.getCategories(),
        apiService.getUsers(),
      ])

      const categories = Array.isArray(categoriesRes) ? categoriesRes : categoriesRes?.data || []
      const users = Array.isArray(usersRes) ? usersRes : usersRes?.data || []

      // Get trainers only
      const trainers = users.filter((u: any) => u.user_type === 'trainer' && u.is_approved)

      // Calculate trainer counts per discipline
      const trainersByDiscipline: Record<number, number> = {}
      categories.forEach((cat: any) => {
        trainersByDiscipline[cat.id] = trainers.filter((t: any) => {
          const disciplines = Array.isArray(t.disciplines) ? t.disciplines : [t.disciplines]
          return disciplines.some((d: string) => d.toLowerCase().includes(cat.name.toLowerCase()))
        }).length
      })

      // Get recommendations
      const recs = recommendDisciplines(categories, trainersByDiscipline)
      setDisciplines(recs)

      // Get top trainers
      if (showTopTrainers) {
        const personalized = getPersonalizedRecommendations(trainers, categories, {
          location: userLocation,
          budget: userBudget,
        })
        setTopTrainers(personalized.topTrainers)
      }
    } catch (error) {
      console.error('Failed to load recommendations:', error)
      toast({
        title: 'Error',
        description: 'Failed to load recommendations',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDisciplineSelect = async (discipline: string) => {
    try {
      setSelectedDiscipline(discipline)
      setTrainerLoading(true)

      // Fetch trainers and filter for this discipline
      const usersRes = await apiService.getUsers()
      const users = Array.isArray(usersRes) ? usersRes : usersRes?.data || []
      const trainers = users.filter((u: any) => u.user_type === 'trainer' && u.is_approved)

      // Get recommendations for this discipline
      const recs = recommendTrainersForDiscipline(trainers, discipline, userLocation, userBudget)
      setDisciplineTrainers(recs)

      onDisciplineSelect?.(discipline)
    } catch (error) {
      console.error('Failed to load trainers:', error)
      toast({
        title: 'Error',
        description: 'Failed to load trainers for this discipline',
        variant: 'destructive',
      })
    } finally {
      setTrainerLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Recommended Disciplines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recommended Disciplines
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {disciplines.length === 0 ? (
            <p className="text-muted-foreground text-sm">No disciplines available</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {disciplines.slice(0, 6).map((rec) => (
                <Card
                  key={rec.discipline.id}
                  className="cursor-pointer hover:border-primary transition border-border"
                  onClick={() => handleDisciplineSelect(rec.discipline.name)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{rec.discipline.name}</h4>
                        {rec.discipline.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {rec.discipline.description}
                          </p>
                        )}
                      </div>
                      {rec.discipline.icon && (
                        <span className="text-2xl ml-2">{rec.discipline.icon}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {rec.reasons.map((reason, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {reason}
                        </Badge>
                      ))}
                    </div>

                    <div className="mt-3">
                      <Button
                        size="sm"
                        className="w-full bg-gradient-primary text-white"
                        onClick={() => handleDisciplineSelect(rec.discipline.name)}
                      >
                        View Trainers
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Discipline Trainers */}
      {selectedDiscipline && (
        <Card>
          <CardHeader>
            <CardTitle>Trainers for {selectedDiscipline}</CardTitle>
          </CardHeader>
          <CardContent>
            {trainerLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : disciplineTrainers.length === 0 ? (
              <Alert>
                <AlertDescription>No trainers found for this discipline</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {disciplineTrainers.map((rec) => (
                  <Card key={rec.trainer.user_id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">
                            {rec.trainer.full_name || rec.trainer.email}
                          </h4>
                          <p className="text-xs text-muted-foreground">{rec.trainer.email}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {(rec.matchScore).toFixed(0)}% match
                          </div>
                          <div className="w-full bg-muted rounded h-1.5 mt-1">
                            <div
                              className="bg-gradient-primary h-full rounded"
                              style={{ width: `${rec.matchScore}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                        {rec.trainer.hourly_rate && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Ksh {rec.trainer.hourly_rate}/hr</span>
                          </div>
                        )}

                        {rec.trainer.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-muted-foreground">
                              {rec.trainer.rating.toFixed(1)} ({rec.trainer.num_reviews || 0})
                            </span>
                          </div>
                        )}

                        {rec.trainer.experience_years && (
                          <div className="text-muted-foreground">
                            {rec.trainer.experience_years}+ years exp.
                          </div>
                        )}
                      </div>

                      {rec.reasons.length > 0 && (
                        <div className="mb-3 space-y-1">
                          {rec.reasons.map((reason, idx) => (
                            <div key={idx} className="text-xs text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-950/20 p-1.5 rounded">
                              ✓ {reason}
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        className="w-full bg-gradient-primary text-white"
                        onClick={() => onTrainerSelect?.(rec.trainer.user_id)}
                      >
                        View Profile & Book
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top Trainers */}
      {showTopTrainers && topTrainers.length > 0 && !selectedDiscipline && (
        <Card>
          <CardHeader>
            <CardTitle>Top Recommended Trainers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topTrainers.slice(0, 4).map((rec) => (
                <Card key={rec.trainer.user_id} className="border-border hover:border-primary transition">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-foreground mb-1">
                      {rec.trainer.full_name || rec.trainer.email}
                    </h4>

                    <div className="flex items-center gap-4 mb-2 text-sm">
                      {rec.trainer.hourly_rate && (
                        <span className="text-muted-foreground">Ksh {rec.trainer.hourly_rate}/hr</span>
                      )}
                      {rec.trainer.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span>{rec.trainer.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    {rec.reasons.length > 0 && (
                      <div className="mb-3">
                        {rec.reasons.map((reason, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground">
                            • {reason}
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      size="sm"
                      className="w-full bg-gradient-primary text-white"
                      onClick={() => onTrainerSelect?.(rec.trainer.user_id)}
                    >
                      Book Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
