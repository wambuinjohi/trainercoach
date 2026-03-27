import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Trash2 } from 'lucide-react'
import { BookingSession } from '@/types'

interface TimeSlot {
  start: string
  end: string
}

interface SessionSelectionData {
  [dayOfWeek: string]: string[] // e.g., { monday: ["09:00-12:00", "14:00-17:00"] }
}

interface MultiSessionSelectorProps {
  trainerAvailability?: Record<string, string[]> // e.g., { monday: ["09:00-17:00"] }
  onSelectionChange: (sessions: BookingSession[]) => void
  minSessions?: number
  maxSessions?: number
  weeksToShow?: number
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function getDayLabel(dayOfWeek: string): string {
  return dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)
}

function getDayOfWeekName(date: Date): string {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return dayNames[date.getDay()]
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function calculateDurationHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  return (endMinutes - startMinutes) / 60
}

function convertToSessionsArray(
  dayMap: SessionSelectionData,
  baseDate: Date
): BookingSession[] {
  const sessions: BookingSession[] = []

  // For each day of the week
  for (const dayOfWeek of DAYS_OF_WEEK) {
    const slots = dayMap[dayOfWeek] || []
    if (slots.length === 0) continue

    // Find the next occurrence of this day
    let currentDate = new Date(baseDate)
    const targetDayIndex = DAYS_OF_WEEK.indexOf(dayOfWeek)
    const currentDayIndex = getDayOfWeekName(currentDate) === 'sunday' ? 0 : DAYS_OF_WEEK.indexOf(getDayOfWeekName(currentDate))

    // Calculate days to add
    let daysToAdd = targetDayIndex - currentDayIndex
    if (daysToAdd < 0) daysToAdd += 7 // Next week if day has passed

    currentDate.setDate(currentDate.getDate() + daysToAdd)

    // Add each slot as a session
    for (const slot of slots) {
      const [start, end] = slot.split('-')
      const durationHours = calculateDurationHours(start, end)

      sessions.push({
        date: currentDate.toISOString().split('T')[0],
        start_time: start,
        end_time: end,
        duration_hours: durationHours,
      })
    }
  }

  // Sort sessions chronologically by date and start_time
  sessions.sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
    if (dateCompare !== 0) return dateCompare
    return a.start_time.localeCompare(b.start_time)
  })

  return sessions
}

export const MultiSessionSelector: React.FC<MultiSessionSelectorProps> = ({
  trainerAvailability = {},
  onSelectionChange,
  minSessions = 1,
  maxSessions = 20,
  weeksToShow = 2,
}) => {
  const [selection, setSelection] = useState<SessionSelectionData>({})
  const [editingSlots, setEditingSlots] = useState<{ [dayOfWeek: string]: TimeSlot[] }>({})

  // Initialize editing slots from trainer availability
  useEffect(() => {
    const slots: { [dayOfWeek: string]: TimeSlot[] } = {}
    for (const day of DAYS_OF_WEEK) {
      slots[day] = []
    }
    setEditingSlots(slots)
  }, [])

  const updateSlot = (dayOfWeek: string, index: number, field: 'start' | 'end', timeValue: string) => {
    const slots = [...(editingSlots[dayOfWeek] || [])]
    if (!slots[index]) slots[index] = { start: '', end: '' }
    slots[index][field] = timeValue
    const updated = { ...editingSlots, [dayOfWeek]: slots }
    setEditingSlots(updated)
    persistChanges(updated)
  }

  const addSlot = (dayOfWeek: string) => {
    const slots = [...(editingSlots[dayOfWeek] || []), { start: '09:00', end: '12:00' }]
    const updated = { ...editingSlots, [dayOfWeek]: slots }
    setEditingSlots(updated)
    persistChanges(updated)
  }

  const removeSlot = (dayOfWeek: string, index: number) => {
    const slots = editingSlots[dayOfWeek]?.filter((_, i) => i !== index) || []
    const updated = { ...editingSlots, [dayOfWeek]: slots }
    setEditingSlots(updated)
    persistChanges(updated)
  }

  const persistChanges = (slots: { [dayOfWeek: string]: TimeSlot[] }) => {
    const result: SessionSelectionData = {}
    for (const day of DAYS_OF_WEEK) {
      const daySlots = slots[day] || []
      const validSlots = daySlots
        .filter(slot => slot.start && slot.end && slot.start < slot.end)
        .map(slot => `${slot.start}-${slot.end}`)
      if (validSlots.length > 0) {
        result[day] = validSlots
      }
    }
    setSelection(result)

    // Convert to sessions array and notify parent
    const sessions = convertToSessionsArray(result, new Date())
    onSelectionChange(sessions)
  }

  const clearAll = () => {
    const empty: { [dayOfWeek: string]: TimeSlot[] } = {}
    for (const day of DAYS_OF_WEEK) {
      empty[day] = []
    }
    setEditingSlots(empty)
    persistChanges(empty)
  }

  const getTotalSessions = (): number => {
    let total = 0
    for (const slots of Object.values(selection)) {
      total += slots.length
    }
    return total
  }

  const getTotalHours = (): number => {
    let total = 0
    for (const slots of Object.values(selection)) {
      for (const slot of slots) {
        const [start, end] = slot.split('-')
        total += calculateDurationHours(start, end)
      }
    }
    return total
  }

  const isTrainerAvailable = (dayOfWeek: string, startTime: string, endTime: string): boolean => {
    const trainerSlots = trainerAvailability[dayOfWeek] || []
    if (trainerSlots.length === 0) return true // No availability info

    // Check if the selected time falls within any trainer availability slot
    const [selStart] = startTime.split(':').map(Number)
    const [selEnd] = endTime.split(':').map(Number)

    return trainerSlots.some(slot => {
      const [availStart, availEnd] = slot.split('-').map(t => {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
      })
      const selStartMin = selStart * 60
      const selEndMin = selEnd * 60

      return selStartMin >= availStart && selEndMin <= availEnd
    })
  }

  const totalSessions = getTotalSessions()
  const totalHours = getTotalHours()
  const isValid = totalSessions >= minSessions && totalSessions <= maxSessions

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Select multiple days and times for your sessions. All selected times will be booked together.
        </p>
        <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <div className="space-y-1">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {totalSessions} sessions selected • {totalHours.toFixed(1)} total hours
            </div>
            {!isValid && totalSessions > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400">
                {totalSessions < minSessions
                  ? `Need at least ${minSessions} session(s)`
                  : `Maximum ${maxSessions} sessions allowed`}
              </div>
            )}
          </div>
          {totalSessions > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3 border border-border rounded-lg p-4">
        {DAYS_OF_WEEK.map(dayOfWeek => (
          <div key={dayOfWeek} className="border-b border-border pb-4 last:border-b-0">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium text-foreground">
                {getDayLabel(dayOfWeek)}
              </label>
              {selection[dayOfWeek]?.length > 0 && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {selection[dayOfWeek].length} slot{selection[dayOfWeek].length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="ml-0 space-y-2">
              {(editingSlots[dayOfWeek] || []).map((slot, idx) => {
                const isAvailable = isTrainerAvailable(dayOfWeek, slot.start, slot.end)
                return (
                  <div
                    key={idx}
                    className={`flex items-end gap-2 p-2 rounded ${
                      !isAvailable
                        ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
                        : ''
                    }`}
                  >
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">From</label>
                      <Input
                        type="time"
                        value={slot.start}
                        onChange={(e) => updateSlot(dayOfWeek, idx, 'start', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">To</label>
                      <Input
                        type="time"
                        value={slot.end}
                        onChange={(e) => updateSlot(dayOfWeek, idx, 'end', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSlot(dayOfWeek, idx)}
                      className="text-destructive hover:text-destructive h-9"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => addSlot(dayOfWeek)}
                className="text-sm"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add time slot
              </Button>
            </div>

            {trainerAvailability[dayOfWeek] && (
              <div className="text-xs text-muted-foreground mt-2 ml-0">
                Trainer available: {trainerAvailability[dayOfWeek].join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="p-3 text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p className="font-medium">📅 Session Selection Tips:</p>
          <ul className="text-xs space-y-1 ml-3 list-disc">
            <li>Select multiple days and times for recurring sessions</li>
            <li>Times must fall within the trainer's availability</li>
            <li>All sessions will be booked with the same trainer</li>
            <li>Use 24-hour format (e.g., 09:00 for 9 AM, 17:00 for 5 PM)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
