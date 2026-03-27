import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { calculateDynamicPrice, type PriceCalculationInput } from '@/lib/dynamic-price-calculator'

interface PriceCalculationDisplayProps {
  input: PriceCalculationInput
  showBreakdown?: boolean
  showSurgeWarning?: boolean
  currencySymbol?: string
}

export const PriceCalculationDisplay: React.FC<PriceCalculationDisplayProps> = ({
  input,
  showBreakdown = true,
  showSurgeWarning = true,
  currencySymbol = 'Ksh',
}) => {
  const priceResult = useMemo(() => calculateDynamicPrice(input), [input])

  const formatAmount = (amount: number) => {
    return `${currencySymbol} ${amount.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  return (
    <div className="space-y-3">
      {/* Surge Pricing Warning */}
      {showSurgeWarning && priceResult.breakdown.surgeApplied && (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
          <TrendingUp className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Surge pricing applied: +{priceResult.breakdown.surgePercentage}% due to{' '}
            {input.daysUntilBooking && input.daysUntilBooking < 1 ? 'same-day booking' :
             input.daysUntilBooking && input.daysUntilBooking <= 1 ? 'next-day booking' :
             input.bookingTime && ['6', '7', '8', '17', '18'].some(h => input.bookingTime!.startsWith(h)) ? 'peak hours' :
             'weekend'}
          </AlertDescription>
        </Alert>
      )}

      {/* Discount Badge */}
      {priceResult.breakdown.discountApplied && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
          <TrendingDown className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Discount applied: -{priceResult.breakdown.discountPercentage}% = {formatAmount(priceResult.discountAmount)}
          </AlertDescription>
        </Alert>
      )}

      {/* Price Summary Card */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 space-y-2">
          {/* Base Price */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              Base Rate ({priceResult.breakdown.baseRate}/hr) × {priceResult.breakdown.sessions} sessions
            </span>
            <span className="font-medium">{formatAmount(priceResult.breakdown.subtotal)}</span>
          </div>

          {/* Surge Adjustment */}
          {priceResult.breakdown.surgeApplied && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                Surge Pricing (+{priceResult.breakdown.surgePercentage}%)
              </span>
              <span className="font-medium text-amber-600">
                +{formatAmount(priceResult.surgePriceAmount)}
              </span>
            </div>
          )}

          {/* Discount */}
          {priceResult.breakdown.discountApplied && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                Discount (-{priceResult.breakdown.discountPercentage}%)
              </span>
              <span className="font-medium text-green-600">
                -{formatAmount(priceResult.discountAmount)}
              </span>
            </div>
          )}

          {/* Transport Fee */}
          {priceResult.breakdown.transportFee > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Transport Fee</span>
              <span className="font-medium">{formatAmount(priceResult.breakdown.transportFee)}</span>
            </div>
          )}

          {/* VAT Breakdown */}
          {showBreakdown && (
            <>
              <div className="border-t border-border my-2 pt-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">VAT (16%)</span>
                  <span>{formatAmount(priceResult.breakdown.vatAmount)}</span>
                </div>
              </div>
            </>
          )}

          {/* Total */}
          <div className="border-t border-border pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-foreground">You Pay:</span>
              <span className="text-lg font-bold text-primary">
                {formatAmount(priceResult.breakdown.total)}
              </span>
            </div>
          </div>

          {/* Trainer Earnings Info */}
          <div className="bg-muted/50 p-2 rounded text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Trainer earns (after fees):</span>
              <span className="font-medium text-foreground">{formatAmount(priceResult.trainerNetAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Info */}
      {input.distance && input.distance > 0 && (
        <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
          Distance: {input.distance.toFixed(1)} km • Transport fee: {formatAmount(priceResult.breakdown.transportFee)}
        </div>
      )}
    </div>
  )
}
