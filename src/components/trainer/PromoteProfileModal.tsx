import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { apiRequest, withAuth } from '@/lib/api'
import * as apiService from '@/lib/api-service'
import { TrendingUp, Zap, Loader2, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface PromoteProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currentPromotionTier?: string
}

const PROMOTION_TIERS = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'Default visibility',
    commissionRate: 25,
    featured: false,
  },
  {
    id: 'promoted',
    name: 'Promoted',
    description: 'Boosted visibility in search results',
    commissionRate: 35,
    featured: true,
    badge: 'Featured',
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Top placement in all search results',
    commissionRate: 40,
    featured: true,
    badge: 'Premium',
  },
]

export const PromoteProfileModal: React.FC<PromoteProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentPromotionTier = 'standard',
}) => {
  const { user } = useAuth()
  const [selectedTier, setSelectedTier] = useState(currentPromotionTier)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSelectedTier(currentPromotionTier)
  }, [currentPromotionTier])

  const handlePromote = async () => {
    if (!user) return

    setLoading(true)
    try {
      // Update trainer profile with new promotion tier
      await apiRequest(
        'profile_update',
        {
          user_id: user.id,
          promotion_tier: selectedTier,
          promoted_at: selectedTier !== 'standard' ? new Date().toISOString() : null,
        },
        { headers: withAuth() }
      )

      const tier = PROMOTION_TIERS.find(t => t.id === selectedTier)
      const message = selectedTier === 'standard'
        ? 'Promotion cancelled. You\'re back to standard visibility.'
        : `Promotion activated! Your profile now appears in ${tier?.name} search results.`

      toast({
        title: 'Profile updated',
        description: message,
      })

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error updating promotion tier:', err)
      toast({
        title: 'Failed to update profile',
        description: 'Please try again or contact support',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const currentTier = PROMOTION_TIERS.find(t => t.id === currentPromotionTier)
  const selectedTierData = PROMOTION_TIERS.find(t => t.id === selectedTier)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Boost Your Visibility
          </DialogTitle>
          <DialogDescription>
            Increase your profile visibility in search results by accepting a higher platform commission
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Status */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <span className="font-semibold">Current Status:</span>{' '}
              {currentTier?.name} ({currentTier?.commissionRate}% platform commission)
            </p>
          </div>

          {/* Tier Selection */}
          <div className="space-y-3">
            <Label className="font-semibold">Choose your visibility level</Label>
            <RadioGroup value={selectedTier} onValueChange={setSelectedTier}>
              {PROMOTION_TIERS.map((tier) => (
                <div key={tier.id} className="relative">
                  <div className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent transition-colors">
                    <RadioGroupItem value={tier.id} id={tier.id} className="mt-1" />
                    <Label
                      htmlFor={tier.id}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{tier.name}</span>
                        {tier.badge && (
                          <Badge variant="default" className="bg-gradient-primary text-white">
                            {tier.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{tier.description}</p>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-foreground font-medium">
                          Platform Commission: <span className="text-lg font-bold">{tier.commissionRate}%</span>
                        </span>
                        <span className="text-muted-foreground">
                          Your Earnings: <span className="font-medium">{100 - tier.commissionRate}%</span>
                        </span>
                      </div>
                    </Label>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Comparison Card */}
          {selectedTier !== currentPromotionTier && (
            <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-600" />
                  Impact on your earnings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Current earnings per booking:</span>
                  <span className="font-semibold">{currentTier?.commissionRate}%</span>
                </div>
                <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                  <span>New earnings per booking:</span>
                  <span>{selectedTierData?.commissionRate}%</span>
                </div>
                <div className="pt-2 border-t border-amber-200 dark:border-amber-800/50">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {selectedTier === 'standard'
                      ? 'You\'ll return to standard visibility with normal commission rates.'
                      : `By choosing ${selectedTierData?.name}, you earn ${selectedTierData?.commissionRate}% on each booking, but get boosted visibility in search results.`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">More visibility</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Appear higher in search results and get discovered by more clients
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Higher conversion</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                More profile views lead to more bookings
              </CardContent>
            </Card>
          </div>

          {/* Note */}
          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              You can change your promotion tier at any time. Changes take effect immediately.
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePromote}
            disabled={loading || selectedTier === currentPromotionTier}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : selectedTier === currentPromotionTier ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Current Tier
              </>
            ) : (
              'Update Promotion'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
