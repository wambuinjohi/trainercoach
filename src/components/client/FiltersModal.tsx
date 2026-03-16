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
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(initial.onlyAvailable ?? false)
  const [radius, setRadius] = useState<number | ''>(initial.radius ?? '')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(initial.categoryIds ?? [])
  const [categories, setCategories] = useState<any[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await apiService.getCategories()
        if (data?.data) {
          setCategories(data.data)
        }
      } catch (err) {
        console.warn('Failed to load categories', err)
      } finally {
        setCategoriesLoading(false)
      }
    }
    loadCategories()
  }, [])

  const handleApply = () => {
    onApply({
      minRating,
      maxPrice,
      onlyAvailable,
      radius,
      categoryIds: selectedCategoryIds
    })
    onClose?.()
  }

  const handleReset = () => {
    setMinRating(0)
    setMaxPrice('')
    setOnlyAvailable(false)
    setRadius('')
    setSelectedCategoryIds([])
  }

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900">
        <Card className="border-0 rounded-t-2xl sm:rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <CardTitle className="text-xl">Filters</CardTitle>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </CardHeader>

          <CardContent className="pt-6 flex-1 overflow-y-auto">
            <div className="space-y-6">
              {/* Primary Filters Section */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Disciplines</h3>
                <p className="text-xs text-muted-foreground mb-3">Select one or more types of training</p>
                {categoriesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading disciplines...</div>
                ) : categories.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No disciplines available</div>
                ) : (
                  <div className="space-y-2">
                    {categories.map((cat) => (
                      <label key={cat.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedCategoryIds.includes(cat.id)}
                          onChange={() => toggleCategory(cat.id)}
                          className="rounded border-slate-300 text-slate-900 dark:border-slate-600 dark:bg-slate-700"
                        />
                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                          {cat.icon && <span>{cat.icon}</span>}
                          {cat.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {selectedCategoryIds.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {selectedCategoryIds.map(id => {
                      const cat = categories.find(c => c.id === id)
                      return (
                        <Badge key={id} variant="secondary" className="gap-1">
                          {cat?.icon && <span>{cat.icon}</span>}
                          {cat?.name}
                          <button
                            onClick={() => toggleCategory(id)}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                )}
              </div>

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

                {/* Availability Filter */}
                <div>
                  <Label className="text-sm block mb-2">Availability</Label>
                  <select
                    value={onlyAvailable ? 'yes' : 'no'}
                    onChange={(e) => setOnlyAvailable(e.target.value === 'yes')}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm"
                  >
                    <option value="no">All trainers</option>
                    <option value="yes">Available only</option>
                  </select>
                </div>
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
