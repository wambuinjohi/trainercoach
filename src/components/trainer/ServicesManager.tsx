import { useState, useEffect } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { Loader2, Save, Users } from 'lucide-react'
import * as apiService from '@/lib/api-service'
import { GroupTrainingManager } from './GroupTrainingManager'

type ServiceCategory = { id: number; name: string; icon?: string; description?: string }

interface ServicesManagerProps { onClose?: () => void }

const ServicesManager = ({ onClose }: ServicesManagerProps) => {
  const { user } = useAuth()
  const userId = user?.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [baseRate, setBaseRate] = useState<string>('')
  const [allCategories, setAllCategories] = useState<ServiceCategory[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [categoryPricing, setCategoryPricing] = useState<Record<number, string>>({})
  const [groupTrainingModalOpen, setGroupTrainingModalOpen] = useState(false)
  const [selectedCategoryForGroupTraining, setSelectedCategoryForGroupTraining] = useState<{ id: number; name: string } | null>(null)
  const [groupTrainingEnabledByCategory, setGroupTrainingEnabledByCategory] = useState<Record<number, boolean>>({})
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Load available data
  useEffect(() => {
    if (!userId) return
    let active = true
    setLoading(true)

    const load = async () => {
      try {
        // Fetch all available categories
        const categoriesData = await apiService.getCategories()
        if (active && categoriesData?.data) {
          setAllCategories(categoriesData.data)
        }

        // Fetch trainer profile
        const profileData = await apiService.getUserProfile(userId).catch(() => ({ data: [] }))
        if (!active) return

        // Handle both direct array response and wrapped response with .data property
        const profileList = Array.isArray(profileData) ? profileData : (profileData?.data && Array.isArray(profileData.data) ? profileData.data : [])
        if (profileList.length > 0) {
          const profile = profileList[0]

          // Set base rate
          setBaseRate(profile?.hourly_rate != null ? String(profile.hourly_rate) : '')
        }

        // Load selected service categories
        const selectedCats = await apiService.getTrainerCategories(userId).catch(() => ({ data: [] }))

        // Handle both direct array response and wrapped response with .data property
        const selectedCatsList = Array.isArray(selectedCats) ? selectedCats : (selectedCats?.data && Array.isArray(selectedCats.data) ? selectedCats.data : [])
        if (active && selectedCatsList.length > 0) {
          const catIds = selectedCatsList.map((sc: any) => Number(sc.category_id || sc.cat_id))
          setSelectedCategoryIds(catIds)

          const pricing: Record<number, string> = {}
          selectedCats.data.forEach((sc: any) => {
            if (sc.hourly_rate != null) {
              pricing[Number(sc.category_id || sc.cat_id)] = String(sc.hourly_rate)
            }
          })
          setCategoryPricing(pricing)

          // Load group training status for each category
          const groupTrainingStatus: Record<number, boolean> = {}
          for (const catId of catIds) {
            try {
              const groupPricingData = await apiService.getTrainerGroupPricing(userId, catId)
              groupTrainingStatus[catId] = !!(groupPricingData?.data && groupPricingData.data.length > 0)
            } catch {
              groupTrainingStatus[catId] = false
            }
          }
          if (active) {
            setGroupTrainingEnabledByCategory(groupTrainingStatus)
          }
        }
      } catch (err) {
        console.warn('Failed to load data', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [userId])

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const updateCategoryPrice = (categoryId: number, price: string) => {
    setCategoryPricing(prev => ({ ...prev, [categoryId]: price }))
  }

  const openGroupTrainingManager = (categoryId: number, categoryName: string) => {
    setSelectedCategoryForGroupTraining({ id: categoryId, name: categoryName })
    setGroupTrainingModalOpen(true)
  }

  const closeGroupTrainingManager = () => {
    setGroupTrainingModalOpen(false)
    setSelectedCategoryForGroupTraining(null)
  }

  const handleGroupTrainingModalSave = async () => {
    // Refresh group training status for the updated category
    if (selectedCategoryForGroupTraining && userId) {
      try {
        const groupPricingData = await apiService.getTrainerGroupPricing(userId, selectedCategoryForGroupTraining.id)
        const isEnabled = !!(groupPricingData?.data && groupPricingData.data.length > 0)
        setGroupTrainingEnabledByCategory(prev => ({
          ...prev,
          [selectedCategoryForGroupTraining.id]: isEnabled
        }))
      } catch {
        // Ignore errors
      }
    }
    closeGroupTrainingManager()
  }

  const savePricing = async () => {
    if (!userId) return
    setSaving(true)

    try {
      // Validate inputs
      if (!baseRate || isNaN(Number(baseRate))) {
        toast({ title: 'Invalid base rate', variant: 'destructive' })
        setSaving(false)
        return
      }

      if (selectedCategoryIds.length === 0) {
        toast({ title: 'Select at least one service category', variant: 'destructive' })
        setSaving(false)
        return
      }

      // Save base rate to profile
      await apiService.updateUserProfile(userId, {
        hourly_rate: Number(baseRate)
      })

      // Get previous categories to determine what changed
      const previousCategoriesData = await apiService.getTrainerCategories(userId)
      const previousCategoryIds = previousCategoriesData?.data?.map((cat: any) => cat.category_id || cat.cat_id) || []

      // Determine which categories to add and remove
      const categoriesToAdd = selectedCategoryIds.filter(id => !previousCategoryIds.includes(id))
      const categoriesToRemove = previousCategoryIds.filter(id => !selectedCategoryIds.includes(id))

      // Save category changes
      for (const categoryId of categoriesToAdd) {
        try {
          await apiService.addTrainerCategory(userId, categoryId)
        } catch (catErr) {
          console.warn(`Failed to add category ${categoryId}:`, catErr)
        }
      }

      for (const categoryId of categoriesToRemove) {
        try {
          await apiService.removeTrainerCategory(userId, categoryId)
        } catch (catErr) {
          console.warn(`Failed to remove category ${categoryId}:`, catErr)
        }
      }

      // Save category pricing for all selected categories
      for (const categoryId of selectedCategoryIds) {
        const price = categoryPricing[categoryId]
        if (price && Number(price) > 0) {
          try {
            await apiService.setTrainerCategoryPricing(userId, categoryId, Number(price))
          } catch (pricingErr) {
            console.warn(`Failed to save pricing for category ${categoryId}:`, pricingErr)
          }
        }
      }

      toast({ title: 'Success', description: 'Pricing and services updated' })
      onClose?.()
    } catch (err: any) {
      const description = err?.message || 'Failed to save'
      toast({ title: 'Error saving pricing', description, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const selectedCategories = allCategories.filter(c => selectedCategoryIds.includes(c.id))

  const filteredCategories = allCategories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />
      <div className="relative w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto" onClick={event => event.stopPropagation()}>
        <Card>
          <CardHeader>
            <CardTitle>Pricing & Service Categories</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select service categories you offer and set your base pricing. Adjust pricing by distance if needed.
            </p>
          </CardHeader>
          {loading ? (
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          ) : (
            <CardContent className="space-y-8">
              {/* Base Pricing Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Base Pricing</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="base-rate">Default hourly rate (Ksh)</Label>
                    <Input
                      id="base-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={baseRate}
                      onChange={event => setBaseRate(event.target.value)}
                      placeholder="e.g., 1000"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Your default rate for all selected service categories.</p>
                  </div>
                </div>
              </section>

              {/* Service Categories Section */}
              <section className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Service Categories</h3>
                <p className="text-sm text-muted-foreground">Select one or more service categories you offer.</p>

                <div className="space-y-3">
                  <Input
                    type="text"
                    placeholder="Search categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-input border-border"
                  />
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto border border-border rounded-lg p-4">
                  {allCategories.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">No categories available</div>
                  ) : filteredCategories.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">No categories match your search</div>
                  ) : (
                    filteredCategories.map(category => (
                      <label key={category.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-muted rounded">
                        <Checkbox
                          checked={selectedCategoryIds.includes(category.id)}
                          onCheckedChange={() => toggleCategory(category.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            {category.icon && <span>{category.icon}</span>}
                            <span>{category.name}</span>
                          </div>
                          {category.description && (
                            <p className="text-xs text-muted-foreground">{category.description}</p>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </section>

              {/* Per-Category Pricing (if multiple categories selected) */}
              {selectedCategories.length > 0 && (
                <section className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Category-Specific Pricing</h3>
                  <p className="text-sm text-muted-foreground">
                    Optionally set different rates for specific categories or manage group training. Leave empty to use base rate.
                  </p>

                  <div className="space-y-3">
                    {selectedCategories.map(category => (
                      <div key={category.id} className="rounded-md border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-semibold">
                              {category.icon && <span className="mr-2">{category.icon}</span>}
                              {category.name}
                            </Label>
                            {groupTrainingEnabledByCategory[category.id] && (
                              <Badge variant="secondary" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                Group Training
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                              Hourly rate (Ksh)
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={categoryPricing[category.id] || ''}
                              onChange={event => updateCategoryPrice(category.id, event.target.value)}
                              placeholder={`Leave empty for base rate (Ksh ${baseRate})`}
                              className="text-sm mt-1"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openGroupTrainingManager(category.id, category.name)}
                              className="gap-2"
                            >
                              <Users className="h-4 w-4" />
                              Group Training
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </CardContent>
          )}
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onClose?.()}>Close</Button>
            <Button onClick={savePricing} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save pricing
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Group Training Manager Modal */}
      {groupTrainingModalOpen && selectedCategoryForGroupTraining && userId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
          <div className="relative w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto" onClick={event => event.stopPropagation()}>
            <GroupTrainingManager
              trainerId={userId}
              categoryId={selectedCategoryForGroupTraining.id}
              categoryName={selectedCategoryForGroupTraining.name}
              onClose={closeGroupTrainingManager}
              onSave={handleGroupTrainingModalSave}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export { ServicesManager }
