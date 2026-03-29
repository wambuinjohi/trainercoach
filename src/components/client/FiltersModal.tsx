import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import * as apiService from '@/lib/api-service'

export const FiltersModal: React.FC<{ initial?: any, onApply: (f: any) => void, onClose?: () => void }> = ({ initial = {}, onApply, onClose }) => {
  const [minRating, setMinRating] = useState<number>(initial.minRating ?? 0)
  const [maxPrice, setMaxPrice] = useState<number | ''>(initial.maxPrice ?? '')
  const [radius, setRadius] = useState<number | ''>(initial.radius ?? '')
  const [availabilityDays, setAvailabilityDays] = useState<string[] | null>(initial.availabilityDays ?? null)
  const [availabilityStartTime, setAvailabilityStartTime] = useState<string | null>(initial.availabilityStartTime ?? null)
  const [availabilityEndTime, setAvailabilityEndTime] = useState<string | null>(initial.availabilityEndTime ?? null)
  const [hasAvailabilityFilter, setHasAvailabilityFilter] = useState<boolean>(initial.hasAvailabilityFilter ?? false)

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  const handleApply = () => {
    onApply({
      minRating,
      maxPrice,
      radius,
      availabilityDays: hasAvailabilityFilter ? (availabilityDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) : null,
      availabilityStartTime: hasAvailabilityFilter ? (availabilityStartTime || '06:00') : null,
      availabilityEndTime: hasAvailabilityFilter ? (availabilityEndTime || '20:00') : null,
      hasAvailabilityFilter
    })
    onClose?.()
  }

  const handleReset = () => {
    setMinRating(0)
    setMaxPrice('')
    setRadius('')
    setAvailabilityDays(null)
    setAvailabilityStartTime(null)
    setAvailabilityEndTime(null)
    setHasAvailabilityFilter(false)
  }

  const toggleDay = (day: string) => {
    const current = availabilityDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    setAvailabilityDays(
      current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day]
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[100vh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900">
        <Card className="border-0 rounded-t-2xl sm:rounded-2xl h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10 p-3 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">Filters</CardTitle>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex-shrink-0">
              <X className="h-5 w-5" />
            </button>
          </CardHeader>

          <CardContent className="p-3 sm:p-6 flex-1 overflow-y-auto">
            <div className="space-y-6">
              {/* Distance Filter */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Distance</h3>
                <p className="text-xs text-muted-foreground mb-3">Maximum distance from your location</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="e.g., 5"
                    value={String(radius)}
                    onChange={(e) => setRadius(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">km</span>
                </div>
              </div>

              {/* Secondary Filters Section */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-foreground">More Filters</h3>

                {/* Rating Filter */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Minimum Rating</Label>
                    {minRating > 0 && <span className="text-xs text-muted-foreground">{minRating.toFixed(1)} ⭐</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={0.5}
                      value={minRating}
                      onChange={(e) => setMinRating(Number(e.target.value))}
                      className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Price Filter */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Maximum Price</Label>
                    {maxPrice && <span className="text-xs text-muted-foreground">Ksh {maxPrice}/hour</span>}
                  </div>
                  <Input
                    type="number"
                    min={0}
                    placeholder="No limit"
                    value={String(maxPrice)}
                    onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>

                {/* Availability Filter Toggle */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 -m-2 p-2">
                    <input
                      type="checkbox"
                      checked={hasAvailabilityFilter}
                      onChange={(e) => setHasAvailabilityFilter(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 dark:border-slate-600 dark:bg-slate-700"
                    />
                    <span className="text-sm font-medium text-foreground">Filter by Availability</span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1 ml-7">Only show trainers with available slots</p>
                </div>

                {/* Availability Details (only shown if filter is enabled) */}
                {hasAvailabilityFilter && (
                  <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    {/* Days Selection */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Days</p>
                      <div className="grid grid-cols-2 gap-2">
                        {days.map(day => (
                          <label key={day} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700">
                            <input
                              type="checkbox"
                              checked={(availabilityDays || []).includes(day)}
                              onChange={() => toggleDay(day)}
                              className="rounded border-slate-300 text-slate-900 dark:border-slate-600 dark:bg-slate-700"
                            />
                            <span className="text-sm text-foreground">{day.slice(0, 3)}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Time Range */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Time Range</p>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">From</label>
                          <Input
                            type="time"
                            value={availabilityStartTime || '06:00'}
                            onChange={(e) => setAvailabilityStartTime(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">To</label>
                          <Input
                            type="time"
                            value={availabilityEndTime || '20:00'}
                            onChange={(e) => setAvailabilityEndTime(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="flex-1"
                >
                  Reset
                </Button>
                <Button
                  onClick={handleApply}
                  className="flex-1"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
