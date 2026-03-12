import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

export default function ResetPasswordsPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('1234')
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleResetPasswords = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await apiRequest('reset_all_user_passwords', {
        password: password,
      })

      if (response.status === 'success') {
        setResult({
          success: true,
          message: response.message,
          data: response.data,
        })
        toast({
          title: 'Success',
          description: `All passwords reset successfully (${response.data?.updated || 0} users updated)`,
        })
      } else {
        setResult({
          success: false,
          message: response.message,
        })
        toast({
          title: 'Error',
          description: response.message,
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to reset passwords'
      setResult({
        success: false,
        message: errorMessage,
      })
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Reset All Passwords</h1>
        <Button variant="outline" onClick={() => navigate('/admin/settings')} size="sm">
          Back
        </Button>
      </div>

      <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          This action will reset all user passwords to the specified PIN. This is an irreversible action that will affect all accounts.
        </AlertDescription>
      </Alert>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Password Reset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="password">New PIN/Password</Label>
            <Input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-input border-border"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              All users will be able to log in with this PIN
            </p>
          </div>

          {!showConfirm ? (
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={loading || !password.trim()}
              variant="destructive"
              className="w-full"
            >
              Reset All Passwords
            </Button>
          ) : (
            <div className="space-y-3">
              <Alert className="border-red-600 bg-red-50 dark:bg-red-950">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-800 dark:text-red-200">
                  Are you sure? All users will have their passwords reset to "{password}". This cannot be undone.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  onClick={() => setShowConfirm(false)}
                  variant="outline"
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResetPasswords}
                  disabled={loading}
                  variant="destructive"
                  className="flex-1"
                >
                  {loading ? 'Resetting…' : 'Confirm Reset'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className={result.success ? 'border-green-600 bg-green-50 dark:bg-green-950' : 'border-red-600 bg-red-50 dark:bg-red-950'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-green-800 dark:text-green-200">Success</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span className="text-red-800 dark:text-red-200">Error</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
              {result.message}
            </p>
            {result.data?.updated && (
              <p className="text-sm mt-2 opacity-75">
                {result.data.updated} users updated
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
