import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, AlertCircle } from 'lucide-react'

export interface FeeBreakdown {
  baseServiceAmount: number
  platformChargeClient?: number // DEPRECATED: Always 0 now
  platformChargeTrainer?: number // DEPRECATED: Always 0 now
  compensationFee?: number // DEPRECATED: Always 0 now
  maintenanceFee?: number // DEPRECATED: Always 0 now
  transportFee: number
  vat?: number
  vatAmount?: number
  commissionAmount?: number // DEPRECATED: Use platformFeeAmount instead
  platformFeeAmount?: number // NEW: 25% deducted from trainer
  clientTotal: number
  trainerNetAmount?: number
}

interface FeeBreakdownModalProps {
  breakdown: FeeBreakdown
  onClose?: () => void
}

export const FeeBreakdownModal: React.FC<FeeBreakdownModalProps> = ({
  breakdown,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative w-full max-w-lg rounded-lg">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <CardHeader>
          <CardTitle className="text-lg">Fee Breakdown</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* What you pay section */}
          <div className="space-y-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100 flex items-center gap-2">
              <span className="w-5 h-5 flex items-center justify-center bg-blue-500 text-white rounded-full text-xs">💳</span>
              What you pay (Client)
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">Service Amount</span>
                <span className="font-medium">Ksh {breakdown.baseServiceAmount}</span>
              </div>
              {breakdown.transportFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">Transport Fee</span>
                  <span className="font-medium">Ksh {breakdown.transportFee}</span>
                </div>
              )}
              {(breakdown.vatAmount ?? breakdown.vat) && (breakdown.vatAmount ?? breakdown.vat) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">VAT (16%)</span>
                  <span className="font-medium">Ksh {breakdown.vatAmount ?? breakdown.vat}</span>
                </div>
              )}
              <div className="border-t border-blue-200 dark:border-blue-700 my-2 pt-2 flex justify-between font-bold text-base">
                <span>Your Total</span>
                <span className="text-blue-600 dark:text-blue-400">Ksh {breakdown.clientTotal}</span>
              </div>
            </div>
          </div>

          {/* What trainer earns section */}
          {breakdown.trainerNetAmount !== undefined && (
            <div className="space-y-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <h3 className="font-semibold text-sm text-green-900 dark:text-green-100 flex items-center gap-2">
                <span className="w-5 h-5 flex items-center justify-center bg-green-500 text-white rounded-full text-xs">✓</span>
                What trainer earns
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">Service Amount</span>
                  <span className="font-medium">Ksh {breakdown.baseServiceAmount}</span>
                </div>
                {(breakdown.platformFeeAmount ?? breakdown.commissionAmount) && (breakdown.platformFeeAmount ?? breakdown.commissionAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Less: Platform Fee (25%)</span>
                    <span className="font-medium text-red-600">- Ksh {breakdown.platformFeeAmount ?? breakdown.commissionAmount}</span>
                  </div>
                )}
                {breakdown.transportFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Transport Fee</span>
                    <span className="font-medium">Ksh {breakdown.transportFee}</span>
                  </div>
                )}
                <div className="border-t border-green-200 dark:border-green-700 my-2 pt-2 flex justify-between font-bold text-base">
                  <span>Trainer Gets</span>
                  <span className="text-green-600 dark:text-green-400">Ksh {breakdown.trainerNetAmount}</span>
                </div>
              </div>
            </div>
          )}

          {/* Info message */}
          <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <p className="font-medium">Note:</p>
              <p className="text-xs mt-1">Transport fee is calculated based on the distance between your location and the trainer's location. It will be added at checkout.</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={onClose} className="bg-gradient-primary text-white">
              Got it
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
