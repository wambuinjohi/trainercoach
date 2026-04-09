import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import * as apiService from '@/lib/api-service'

type DayConfig = { key: DayKey; label: string }
type DayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

type Slot = { id: string; start: string; end: string }
type ScheduleState = Record<DayKey, Slot[]>

type AvailabilityEditorProps = { onClose?: () => void }

type AvailabilityPayload = Record<DayKey, string[]>

const DAYS: readonly DayConfig[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

const createId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

const createEmptySchedule = (): ScheduleState => {
  const empty: Partial<ScheduleState> = {}
  DAYS.forEach(day => {
    empty[day.key] = []
  })
  return empty as ScheduleState
}

const normalizeTime = (value: unknown): string => {
  const stringValue = typeof value === 'string' ? value : (value == null ? '' : String(value))
  const trimmed = stringValue.trim()
  if (trimmed === '') return ''

  const match = trimmed.match(/^(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return ''

  const hours = Number(match[1])
  const minutes = Number(match[2] ?? '0')

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return ''
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return ''

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const isValidTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)

const createSlot = (start = '09:00', end = '11:00'): Slot => {
  const normalizedStart = normalizeTime(start) || '09:00'
  const normalizedEnd = normalizeTime(end) || '11:00'
  return {
    id: createId('slot'),
    start: normalizedStart,
    end: normalizedEnd > normalizedStart ? normalizedEnd : incrementTime(normalizedStart, 1),
  }
}

const cloneSlots = (slots: Slot[]): Slot[] => slots.map(slot => ({ id: createId('slot'), start: slot.start, end: slot.end }))

const incrementTime = (time: string, hours = 1): string => {
  if (!isValidTime(time)) return '11:00'
  const [h, m] = time.split(':').map(Number)
  const totalMinutes = Math.min(h * 60 + m + hours * 60, 23 * 60 + 45)
  const nextHours = Math.floor(totalMinutes / 60)
  const nextMinutes = totalMinutes % 60
  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`
}

const parseAvailability = (raw: unknown): ScheduleState => {
  if (typeof raw === 'string') {
    try {
      return parseAvailability(JSON.parse(raw))
    } catch {
      return createEmptySchedule()
    }
  }

  const schedule = createEmptySchedule()
  if (!raw || typeof raw !== 'object') return schedule

  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    const dayKey = key.toLowerCase() as DayKey
    if (!schedule[dayKey]) return
    if (!Array.isArray(value)) {
      schedule[dayKey] = []
      return
    }

    const slots: Slot[] = []
    value.forEach((entry, index) => {
      if (typeof entry === 'string') {
        const [start, end] = entry.split('-')
        const normalizedStart = normalizeTime(start)
        const normalizedEnd = normalizeTime(end)
        if (normalizedStart && normalizedEnd) slots.push({ id: createId(`${dayKey}-${index}`), start: normalizedStart, end: normalizedEnd })
        return
      }
      if (entry && typeof entry === 'object') {
        const normalizedStart = normalizeTime((entry as any).start ?? (entry as any).from)
        const normalizedEnd = normalizeTime((entry as any).end ?? (entry as any).to)
        if (normalizedStart && normalizedEnd) slots.push({ id: createId(`${dayKey}-${index}`), start: normalizedStart, end: normalizedEnd })
      }
    })

    slots.sort((a, b) => a.start.localeCompare(b.start))
    schedule[dayKey] = slots
  })

  return schedule
}

const buildPayload = (schedule: ScheduleState): AvailabilityPayload => {
  const payload: Partial<AvailabilityPayload> = {}
  DAYS.forEach(day => {
    const slots = schedule[day.key]
      .filter(slot => isValidTime(slot.start) && isValidTime(slot.end) && slot.start < slot.end)
      .sort((a, b) => a.start.localeCompare(b.start))
      .map(slot => `${slot.start}-${slot.end}`)
    payload[day.key] = slots
  })
  return payload as AvailabilityPayload
}

const validateSchedule = (schedule: ScheduleState): string | null => {
  for (const day of DAYS) {
    const slots = schedule[day.key]
    if (!Array.isArray(slots)) continue
    const normalized = slots
      .map(slot => ({ start: slot.start, end: slot.end }))
      .filter(slot => slot.start || slot.end)
      .sort((a, b) => a.start.localeCompare(b.start))

    for (let i = 0; i < normalized.length; i += 1) {
      const slot = normalized[i]
      if (!isValidTime(slot.start) || !isValidTime(slot.end)) {
        return `Enter valid times for ${day.label}.`
      }
      if (slot.start >= slot.end) {
        return `The end time must be after the start time on ${day.label}.`
      }
      if (i > 0) {
        const previous = normalized[i - 1]
        if (previous.end > slot.start) {
          return `Time slots overlap on ${day.label}.`
        }
      }
    }
  }
  return null
}

const AvailabilityEditor: React.FC<AvailabilityEditorProps> = ({ onClose }) => {
  const { user } = useAuth()
  const userId = user?.id

  const [schedule, setSchedule] = useState<ScheduleState>(() => createEmptySchedule())
  const [initialPayload, setInitialPayload] = useState<AvailabilityPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showValidationError, setShowValidationError] = useState(false)

  useEffect(() => {
    if (!userId) return
    let active = true
    setLoading(true)

    const loadAvailability = async () => {
      try {
        const profileData = await apiService.getUserProfile(userId)
        if (!active) return

        if (profileData?.data && profileData.data.length > 0) {
          const data = profileData.data[0]
          const parsed = parseAvailability(data?.availability)
          setSchedule(parsed)
          setInitialPayload(buildPayload(parsed))
        } else {
          // Fallback to localStorage if API returns empty
          const savedProfile = localStorage.getItem(`trainer_profile_${userId}`)
          if (savedProfile) {
            const data = JSON.parse(savedProfile)
            const parsed = parseAvailability(data.availability)
            setSchedule(parsed)
            setInitialPayload(buildPayload(parsed))
          } else {
            setSchedule(createEmptySchedule())
            setInitialPayload(buildPayload(createEmptySchedule()))
          }
        }
      } catch (error: any) {
        if (!active) return
        console.warn('Failed to load availability', error)

        // Fallback to localStorage on error
        try {
          const savedProfile = localStorage.getItem(`trainer_profile_${userId}`)
          if (savedProfile) {
            const data = JSON.parse(savedProfile)
            const parsed = parseAvailability(data.availability)
            setSchedule(parsed)
            setInitialPayload(buildPayload(parsed))
          } else {
            setSchedule(createEmptySchedule())
            setInitialPayload(buildPayload(createEmptySchedule()))
          }
        } catch {
          setSchedule(createEmptySchedule())
          setInitialPayload(buildPayload(createEmptySchedule()))
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadAvailability()

    return () => {
      active = false
    }
  }, [userId])

  const hasChanges = useMemo(() => {
    if (!initialPayload) return false
    return JSON.stringify(buildPayload(schedule)) !== JSON.stringify(initialPayload)
  }, [schedule, initialPayload])

  const totalSlots = useMemo(() => Object.values(schedule).reduce((sum, slots) => sum + slots.length, 0), [schedule])

  const validationMessage = useMemo(() => validateSchedule(schedule), [schedule])

  const toggleDay = (day: DayKey, available: boolean) => {
    setSchedule(prev => ({
      ...prev,
      [day]: available ? prev[day].length ? prev[day] : [createSlot()] : [],
    }))
  }

  const updateSlot = (day: DayKey, slotId: string, field: 'start' | 'end', value: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: prev[day].map(slot => (slot.id === slotId ? { ...slot, [field]: value } : slot)),
    }))
  }

  const addSlot = (day: DayKey) => {
    setSchedule(prev => {
      const current = prev[day]
      const reference = current[current.length - 1]
      const defaultStart = reference ? reference.end : '09:00'
      const defaultEnd = incrementTime(defaultStart, 1)
      return {
        ...prev,
        [day]: [...current, createSlot(defaultStart, defaultEnd)],
      }
    })
  }

  const removeSlot = (day: DayKey, slotId: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: prev[day].filter(slot => slot.id !== slotId),
    }))
  }

  const copyDayToTargets = (source: DayKey, targets: DayKey[]) => {
    setSchedule(prev => {
      const sourceSlots = cloneSlots(prev[source])
      const next = { ...prev }
      targets.forEach(target => {
        if (target === source) return
        next[target] = cloneSlots(sourceSlots)
      })
      return next
    })
    toast({ title: 'Availability copied', description: 'Your schedule has been duplicated.' })
  }

  const clearAll = () => {
    setSchedule(createEmptySchedule())
  }

  const handleSave = async () => {
    if (!userId) return
    const message = validateSchedule(schedule)
    if (message) {
      setShowValidationError(true)
      toast({ title: 'Check availability', description: message, variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const payload = buildPayload(schedule)
      await apiService.updateUserProfile(userId, {
        availability: JSON.stringify(payload),
      })

      setInitialPayload(payload)
      setShowValidationError(false)
      toast({ title: 'Availability saved', description: 'Your timetable is updated for clients.' })
      onClose?.()
    } catch (error) {
      const description = (error as any)?.message || 'Failed to save availability. Please try again.'
      toast({ title: 'Error saving availability', description, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />
      <div className="relative w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto" onClick={event => event.stopPropagation()}>
        <Card>
          <CardHeader>
            <CardTitle>Availability & Schedule</CardTitle>
            <p className="text-sm text-muted-foreground">
              Set the hours you are available each day. Clients will only see open slots.
            </p>
          </CardHeader>
          {loading ? (
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          ) : (
            <CardContent className="space-y-6">
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-medium">ℹ️ Time Format:</span> All times use 24-hour format (00:00 - 23:59). For example: 09:00 = 9 AM, 14:00 = 2 PM, 17:30 = 5:30 PM.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Weekly summary</p>
                  <p className="text-xs text-muted-foreground">
                    {totalSlots > 0 ? `${totalSlots} time slot${totalSlots === 1 ? '' : 's'} configured across the week.` : 'No availability set yet.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyDayToTargets('monday', ['tuesday', 'wednesday', 'thursday', 'friday'])} className="text-xs sm:text-sm">
                    <span className="hidden sm:inline">Copy Monday to weekdays</span>
                    <span className="sm:hidden">Mon → Weekdays</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyDayToTargets('saturday', ['sunday'])} className="text-xs sm:text-sm">
                    <span className="hidden sm:inline">Copy Saturday to Sunday</span>
                    <span className="sm:hidden">Sat → Sun</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs sm:text-sm">
                    Clear all
                  </Button>
                </div>
              </div>

              {showValidationError && validationMessage && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {validationMessage}
                </div>
              )}

              <div className="space-y-4">
                {DAYS.map(day => {
                  const slots = schedule[day.key]
                  const isAvailable = slots.length > 0
                  return (
                    <div key={day.key} className="space-y-3 rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-foreground">{day.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {isAvailable ? `${slots.length} slot${slots.length === 1 ? '' : 's'} configured` : 'Marked as unavailable'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{isAvailable ? 'Available' : 'Off'}</span>
                          <Switch checked={isAvailable} onCheckedChange={checked => toggleDay(day.key, Boolean(checked))} />
                        </div>
                      </div>

                      {isAvailable && (
                        <div className="space-y-2">
                          {slots.map(slot => (
                            <div key={slot.id} className="grid items-center gap-3 md:grid-cols-[minmax(0,160px)_auto_minmax(0,160px)_auto]">
                              <div>
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Start</Label>
                                <Input
                                  type="time"
                                  value={slot.start}
                                  onChange={event => updateSlot(day.key, slot.id, 'start', event.target.value)}
                                />
                              </div>
                              <div className="hidden justify-center md:flex">—</div>
                              <div>
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">End</Label>
                                <Input
                                  type="time"
                                  value={slot.end}
                                  onChange={event => updateSlot(day.key, slot.id, 'end', event.target.value)}
                                />
                              </div>
                              <div className="flex items-end justify-end">
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeSlot(day.key, slot.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => addSlot(day.key)}>
                            <Plus className="h-4 w-4" /> Add time slot
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          )}
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onClose?.()}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || loading || !hasChanges} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save availability
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export { AvailabilityEditor }
