import React, { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export interface CategoryTiming {
  categoryId: string
  categoryName: string
  hourlyRate: number
  date: string
  time: string
}

interface CategoryTimingSelectorProps {
  selectedCategories: Array<{ id: string; name: string; hourlyRate: number }>
  trainerAvailability?: Record<string, string[]>
  onTimingsChange: (timings: CategoryTiming[]) => void
  onValidationChange?: (isValid: boolean) => void
}

export const CategoryTimingSelector: React.FC<CategoryTimingSelectorProps> = ({
  selectedCategories,
  trainerAvailability = {},
  onTimingsChange,
  onValidationChange,
}) => {
  const [timings, setTimings] = useState<Map<string, CategoryTiming>>(new Map())
  const [availabilityErrors, setAvailabilityErrors] = useState<Map<string, string>>(new Map())

  const today = new Date().toISOString().split('T')[0]

  // Initialize timings for each category
  useEffect(() => {
    const newTimings = new Map(timings)
    selectedCategories.forEach((category) => {
      if (!newTimings.has(category.id)) {
        newTimings.set(category.id, {
          categoryId: category.id,
          categoryName: category.name,
          hourlyRate: category.hourlyRate,
          date: '',
          time: '',
        })
      }
    })
    setTimings(newTimings)
  }, [selectedCategories])

  const updateCategoryTiming = (categoryId: string, field: 'date' | 'time', value: string) => {
    const newTimings = new Map(timings)
    const timing = newTimings.get(categoryId)
    if (timing) {
      timing[field] = value
      newTimings.set(categoryId, { ...timing })
      setTimings(newTimings)
      validateCategoryAvailability(categoryId, timing.date, timing.time)
      notifyParent(newTimings)
    }
  }

  const validateCategoryAvailability = (categoryId: string, date: string, time: string) => {
    if (!date || !time) {
      const newErrors = new Map(availabilityErrors)
      newErrors.delete(categoryId)
      setAvailabilityErrors(newErrors)
      return
    }

    const selectedDate = new Date(`${date}T00:00:00`)
    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const workingSlots = trainerAvailability[dayName] || []

    const newErrors = new Map(availabilityErrors)
    const [hours, minutes] = time.split(':').map(Number)

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      newErrors.set(categoryId, 'Invalid time format')
      setAvailabilityErrors(newErrors)
      return
    }

    const selectedTimeMinutes = hours * 60 + minutes
    const durationMinutes = 60 // 1 hour default

    if (workingSlots.length === 0) {
      newErrors.set(categoryId, `Trainer is not available on ${dayName}. Please select a different date.`)
    } else {
      const isAvailable = workingSlots.some((slot) => {
        const [start, end] = slot.split('-')
        const [startH, startM] = start.split(':').map(Number)
        const [endH, endM] = end.split(':').map(Number)
        const startMinutes = startH * 60 + startM
        const endMinutes = endH * 60 + endM
        return selectedTimeMinutes >= startMinutes && selectedTimeMinutes + durationMinutes <= endMinutes
      })

      if (!isAvailable) {
        const availableSlots = workingSlots.map((slot) => {
          const [start, end] = slot.split('-')
          const formatTime12hr = (timeStr: string): string => {
            const [h, m] = timeStr.split(':').map(Number)
            const period = h >= 12 ? 'PM' : 'AM'
            const displayH = h % 12 || 12
            return `${displayH}:${String(m).padStart(2, '0')} ${period}`
          }
          return `${formatTime12hr(start)} - ${formatTime12hr(end)}`
        }).join(', ')
        newErrors.set(categoryId, `Not available. Available slots: ${availableSlots}`)
      } else {
        newErrors.delete(categoryId)
      }
    }

    setAvailabilityErrors(newErrors)
  }

  const notifyParent = (newTimings: Map<string, CategoryTiming>) => {
    const timingArray = Array.from(newTimings.values())
    const allFilled = timingArray.every((t) => t.date && t.time)
    const noErrors = availabilityErrors.size === 0

    onTimingsChange(timingArray)
    onValidationChange?.(allFilled && noErrors)
  }

  const formatTime12hr = (timeStr: string): string => {
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Schedule Each Category</Label>
        <CardDescription>
          Set different dates and times for each selected service category below.
        </CardDescription>
      </div>

      <Card className="bg-blue-50/5 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/50">
        <CardHeader>
          <CardTitle className="text-sm">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from(timings.values()).map((timing) => {
              const hasError = availabilityErrors.has(timing.categoryId)
              return (
                <div key={timing.categoryId} className="flex items-center justify-between p-2 rounded border border-border bg-background">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{timing.categoryName}</div>
                    <div className="text-xs text-muted-foreground">
                      {timing.date && timing.time
                        ? `${new Date(`${timing.date}T00:00:00`).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })} • ${formatTime12hr(timing.time)}`
                        : 'Not scheduled'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm">Ksh {timing.hourlyRate}/hr</div>
                    {hasError && <Badge variant="destructive" className="mt-1 text-xs">Error</Badge>}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 border border-border rounded-md p-4 bg-muted/5">
        {Array.from(timings.values()).map((timing) => {
          const error = availabilityErrors.get(timing.categoryId)
          return (
            <div
              key={timing.categoryId}
              className={`space-y-3 p-4 rounded-md border-2 ${error ? 'border-red-200 dark:border-red-800 bg-red-50/20 dark:bg-red-950/20' : 'border-border bg-background'}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{timing.categoryName}</h3>
                <Badge variant="secondary" className="text-xs">
                  Ksh {timing.hourlyRate}/hr
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`date-${timing.categoryId}`} className="text-xs">
                    Date
                  </Label>
                  <Input
                    id={`date-${timing.categoryId}`}
                    type="date"
                    value={timing.date}
                    min={today}
                    onChange={(e) => updateCategoryTiming(timing.categoryId, 'date', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`time-${timing.categoryId}`} className="text-xs">
                    Time
                  </Label>
                  <Input
                    id={`time-${timing.categoryId}`}
                    type="time"
                    step={1800}
                    value={timing.time}
                    onChange={(e) => updateCategoryTiming(timing.categoryId, 'time', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {trainerAvailability[new Date(`${timing.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()] && (
                <div className="text-xs text-muted-foreground">
                  Trainer available: {trainerAvailability[new Date(`${timing.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()]?.join(', ')}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30 p-2 rounded">
                  <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {timing.date && timing.time && !error && (
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                  <span className="text-lg">✓</span>
                  <span>Available at this time</span>
                </div>
              )}

              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                ⚠️ Times are displayed in 12-hour format. Please ensure you select the correct AM or PM time.
              </div>
            </div>
          )
        })}
      </div>

      <Card className="bg-blue-50/5 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/50">
        <CardHeader>
          <CardTitle className="text-sm">How This Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <ul className="text-xs space-y-1 ml-3 list-disc">
            <li>Each service category can have its own date and time</li>
            <li>For example: Karate on Monday 10am, Taekwondo on Wednesday 3pm</li>
            <li>All categories will be booked in a single transaction</li>
            <li>The trainer's availability is checked for each category independently</li>
            <li>You'll see confirmation of all bookings on the next page</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
