import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { X, Plus } from 'lucide-react'

interface TimeSlot {
  start: string
  end: string
}

interface AvailabilityData {
  [day: string]: string[]
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

interface AvailabilitySelectorProps {
  value?: AvailabilityData | string | null
  onChange: (value: AvailabilityData) => void
}

export const AvailabilitySelector: React.FC<AvailabilitySelectorProps> = ({ value, onChange }) => {
  const [availability, setAvailability] = useState<AvailabilityData>({})
  const [editingSlots, setEditingSlots] = useState<{ [day: string]: TimeSlot[] }>({})

  // Initialize from JSON value
  useEffect(() => {
    let parsed: AvailabilityData = {}
    if (value) {
      if (typeof value === 'string') {
        try {
          parsed = JSON.parse(value)
        } catch {
          parsed = {}
        }
      } else {
        parsed = value as AvailabilityData
      }
    }
    setAvailability(parsed)

    // Convert string slots to TimeSlot objects for editing
    const slots: { [day: string]: TimeSlot[] } = {}
    for (const day of DAYS) {
      slots[day] = []
      if (parsed[day] && Array.isArray(parsed[day])) {
        slots[day] = parsed[day].map((slot: string) => {
          const [start, end] = slot.split('-')
          return { start: start?.trim() || '', end: end?.trim() || '' }
        })
      }
    }
    setEditingSlots(slots)
  }, [value])

  const updateSlot = (day: string, index: number, field: 'start' | 'end', timeValue: string) => {
    const slots = [...(editingSlots[day] || [])]
    if (!slots[index]) slots[index] = { start: '', end: '' }
    slots[index][field] = timeValue
    const updated = { ...editingSlots, [day]: slots }
    setEditingSlots(updated)
    persistChanges(updated)
  }

  const addSlot = (day: string) => {
    const slots = [...(editingSlots[day] || []), { start: '09:00', end: '17:00' }]
    const updated = { ...editingSlots, [day]: slots }
    setEditingSlots(updated)
    persistChanges(updated)
  }

  const removeSlot = (day: string, index: number) => {
    const slots = editingSlots[day]?.filter((_, i) => i !== index) || []
    const updated = { ...editingSlots, [day]: slots }
    setEditingSlots(updated)
    persistChanges(updated)
  }

  const persistChanges = (slots: { [day: string]: TimeSlot[] }) => {
    const result: AvailabilityData = {}
    for (const day of DAYS) {
      const daySlots = slots[day] || []
      const validSlots = daySlots
        .filter(slot => slot.start && slot.end && slot.start < slot.end)
        .map(slot => `${slot.start}-${slot.end}`)
      if (validSlots.length > 0) {
        result[day] = validSlots
      }
    }
    setAvailability(result)
    onChange(result)
  }

  const getDayLabel = (day: string) => {
    return day.charAt(0).toUpperCase() + day.slice(1)
  }

  const hasSlots = (day: string) => {
    return availability[day]?.length > 0
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Set your availability for each day. Time slots help clients know when you're available for sessions.</p>
      
      <div className="space-y-3 border border-border rounded-lg p-4">
        {DAYS.map(day => (
          <div key={day} className="border-b border-border pb-4 last:border-b-0">
            <div className="flex items-center justify-between mb-3">
              <label className="font-medium text-foreground flex items-center gap-2">
                <span className="w-28">{getDayLabel(day)}</span>
                {hasSlots(day) && (
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                    Available
                  </span>
                )}
              </label>
            </div>

            <div className="ml-0 space-y-2">
              {(editingSlots[day] || []).map((slot, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">From</label>
                    <Input
                      type="time"
                      value={slot.start}
                      onChange={(e) => updateSlot(day, idx, 'start', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">To</label>
                    <Input
                      type="time"
                      value={slot.end}
                      onChange={(e) => updateSlot(day, idx, 'end', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSlot(day, idx)}
                    className="text-destructive hover:text-destructive h-9"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => addSlot(day)}
                className="text-sm"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add time slot
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="p-3 text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p className="font-medium">✨ Quick Tips:</p>
          <ul className="text-xs space-y-1 ml-3 list-disc">
            <li>Add multiple time slots per day if you have breaks</li>
            <li>Use 24-hour format (e.g., 09:00 for 9 AM, 17:00 for 5 PM)</li>
            <li>Leave a day empty if you're not available that day</li>
            <li>Set realistic hours to ensure client satisfaction</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
