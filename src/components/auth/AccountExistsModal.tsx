import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

interface AccountExistsModalProps {
  phone: string
  onLogin?: () => void
  onResetPin?: () => void
  onCancel?: () => void
}

export const AccountExistsModal: React.FC<AccountExistsModalProps> = ({
  phone,
  onLogin,
  onResetPin,
  onCancel,
}) => {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Account Already Exists</CardTitle>
        <CardDescription>We found an account associated with this phone number</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-400">
              <p className="font-semibold">Phone: {phone}</p>
              <p className="text-xs mt-1">An account with this phone number already exists</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">What would you like to do?</p>

            <Button
              onClick={onLogin}
              className="w-full"
              variant="default"
            >
              Sign In with This Account
            </Button>

            <Button
              onClick={onResetPin}
              variant="outline"
              className="w-full"
            >
              Forgot PIN? Reset It
            </Button>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              onClick={onCancel}
              variant="ghost"
              className="w-full text-muted-foreground"
            >
              Try Different Phone Number
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
