import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import {
  getDefaultGroupTiers,
  validateTierStructure,
  formatGroupPricingDisplay,
  type GroupTier,
  type GroupPricingConfig,
} from '@/lib/group-pricing-utils'

interface GroupTrainingManagerProps {
  trainerId: string
  categoryId: number
  categoryName: string
  onClose?: () => void
  onSave?: () => void
}

export const GroupTrainingManager: React.FC<GroupTrainingManagerProps> = ({
  trainerId,
  categoryId,
  categoryName,
  onClose,
  onSave,
}) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [groupPricing, setGroupPricing] = useState<GroupPricingConfig | null>(null)
  const [isEnabled, setIsEnabled] = useState(false)
  const [pricingModel, setPricingModel] = useState<'fixed' | 'per_person'>('fixed')
  const [tiers, setTiers] = useState<GroupTier[]>(getDefaultGroupTiers())

  // Load existing group pricing
  useEffect(() => {
    const loadGroupPricing = async () => {
      try {
        setLoading(true)
        const response = await apiService.getTrainerGroupPricing(trainerId, categoryId)

        // Handle both direct array response and wrapped response with .data property
        const pricingList = Array.isArray(response) ? response : (response?.data && Array.isArray(response.data) ? response.data : [])
        if (pricingList.length > 0) {
          const pricing = pricingList[0]
          setGroupPricing(pricing)
          setIsEnabled(true)
          setPricingModel(pricing.pricing_model as 'fixed' | 'per_person')
          setTiers(Array.isArray(pricing.tiers) ? pricing.tiers : getDefaultGroupTiers())
        } else {
          setGroupPricing(null)
          setIsEnabled(false)
          setTiers(getDefaultGroupTiers())
        }
      } catch (error) {
        console.error('Failed to load group pricing:', error)
        toast({
          title: 'Error',
          description: 'Failed to load group pricing configuration',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    loadGroupPricing()
  }, [trainerId, categoryId])

  const handleTierChange = (index: number, field: keyof GroupTier, value: any) => {
    const newTiers = [...tiers]
    if (field === 'rate') {
      newTiers[index] = { ...newTiers[index], [field]: Number(value) }
    } else {
      newTiers[index] = { ...newTiers[index], [field]: value }
    }
    setTiers(newTiers)
  }

  const handleAddTier = () => {
    // Add a new tier after the last one
    const minSize = tiers.length > 0 ? tiers[tiers.length - 1].max_size + 1 : 1
    const newTier: GroupTier = {
      group_size_name: 'New Tier',
      min_size: minSize,
      max_size: Math.max(minSize + 99, 999), // Ensure max_size >= min_size, create ~100-person range by default
      rate: 0,
    }
    setTiers([...tiers, newTier])
  }

  const handleRemoveTier = (index: number) => {
    if (tiers.length <= 1) {
      toast({
        title: 'Cannot remove',
        description: 'At least one tier is required',
        variant: 'destructive',
      })
      return
    }
    setTiers(tiers.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    try {
      // Validate tiers
      const validation = validateTierStructure(tiers)
      if (!validation.valid) {
        toast({
          title: 'Invalid tiers',
          description: validation.errors.join('; '),
          variant: 'destructive',
        })
        return
      }

      setSaving(true)

      if (isEnabled) {
        // Save group pricing
        await apiService.setTrainerGroupPricing(
          trainerId,
          categoryId,
          pricingModel,
          tiers
        )
        toast({
          title: 'Saved',
          description: 'Group training pricing updated successfully',
        })
      } else if (groupPricing) {
        // Delete group pricing if disabling
        await apiService.deleteTrainerGroupPricing(trainerId, categoryId)
        toast({
          title: 'Disabled',
          description: 'Group training disabled for this category',
        })
      }

      onSave?.()
    } catch (error) {
      console.error('Failed to save group pricing:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save group pricing',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Group Training for {categoryName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Enable group training for this category</Label>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
          <p className="text-sm text-muted-foreground">
            {isEnabled ? 'Group training enabled' : 'Group training disabled'}
          </p>
        </div>

        {isEnabled && (
          <>
            {/* Pricing Model Selection */}
            <div className="space-y-3">
              <Label>Pricing model</Label>
              <p className="text-sm text-muted-foreground">
                Choose how you want to charge for group training
              </p>

              <RadioGroup value={pricingModel} onValueChange={(val) => setPricingModel(val as 'fixed' | 'per_person')}>
                <div className="space-y-3 border border-border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="fixed" id="fixed" />
                    <div className="flex-1">
                      <Label htmlFor="fixed" className="font-medium cursor-pointer">
                        Fixed rate per group
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Charge a flat rate regardless of group size within the tier
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="per_person" id="per_person" />
                    <div className="flex-1">
                      <Label htmlFor="per_person" className="font-medium cursor-pointer">
                        Per-person rate
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Charge per person (e.g., Ksh 1,500 per person for 2-20 group)
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Tiers Configuration */}
            <div className="space-y-3">
              <Label>Group size tiers</Label>
              <p className="text-sm text-muted-foreground">
                Set rates for different group sizes. {pricingModel === 'per_person' ? 'Rates are per person.' : 'Rates are flat for the entire group.'}
              </p>

              <div className="space-y-3 border border-border rounded-lg p-4">
                {tiers.map((tier, idx) => (
                  <div key={idx} className="flex gap-3 pb-3 border-b border-border last:border-b-0 last:pb-0">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Tier name</Label>
                        <Input
                          value={tier.group_size_name}
                          onChange={(e) =>
                            handleTierChange(idx, 'group_size_name', e.target.value)
                          }
                          placeholder="e.g., 2-20"
                          className="text-sm mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Min size</Label>
                        <Input
                          type="number"
                          min="1"
                          value={tier.min_size}
                          onChange={(e) =>
                            handleTierChange(idx, 'min_size', parseInt(e.target.value))
                          }
                          className="text-sm mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Max size</Label>
                        <Input
                          type="number"
                          min="1"
                          value={tier.max_size}
                          onChange={(e) =>
                            handleTierChange(idx, 'max_size', parseInt(e.target.value))
                          }
                          className="text-sm mt-1"
                        />
                      </div>
                    </div>

                    <div className="w-40">
                      <Label className="text-xs text-muted-foreground">
                        Rate (Ksh) {pricingModel === 'per_person' ? '/ person' : ''}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        value={tier.rate}
                        onChange={(e) =>
                          handleTierChange(idx, 'rate', parseFloat(e.target.value))
                        }
                        className="text-sm mt-1"
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveTier(idx)}
                        disabled={tiers.length === 1}
                        className="h-10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddTier}
                  className="w-full mt-3"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add tier
                </Button>
              </div>

              {/* Pricing Preview */}
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-2">Pricing preview:</p>
                <div className="space-y-1">
                  {tiers.map((tier, idx) => (
                    <div key={idx} className="text-sm text-foreground">
                      <span className="font-medium">{tier.group_size_name}</span>
                      {' — '}
                      <span>{formatGroupPricingDisplay(tier.rate, pricingModel)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default GroupTrainingManager
