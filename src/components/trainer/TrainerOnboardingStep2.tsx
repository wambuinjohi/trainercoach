import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { TrainerProfileEditor } from './TrainerProfileEditor'
import { VerificationDocumentsForm } from './VerificationDocumentsForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

/**
 * Step 2 of trainer onboarding after personal details signup.
 * Full page layout with:
 * 1. Profile Form - pre-filled with signup data (bio, rates, categories, location, etc.)
 * 2. Documents Upload - verification documents
 *
 * After both are completed, redirects to trainer dashboard.
 */
export const TrainerOnboardingStep2: React.FC = () => {
  const { user, userType, signupData } = useAuth()
  const [profileCompleted, setProfileCompleted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize on component mount
  useEffect(() => {
    // Verify we're a trainer and have the step2 flag
    const hasStep2Flag = localStorage.getItem('trainer_signup_step2') === 'true'

    console.log('TrainerOnboardingStep2 mounted:', { userType, hasStep2Flag, signupData })

    if (userType === 'trainer' && hasStep2Flag) {
      // Small delay to ensure auth context is ready
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 300)
      return () => clearTimeout(timer)
    } else if (userType === 'trainer') {
      // If no step2 flag, redirect to dashboard
      console.log('No step2 flag, redirecting to trainer dashboard')
      window.location.href = '/trainer'
    } else {
      // Not a trainer, redirect to appropriate page
      console.log('Not a trainer, redirecting to home')
      window.location.href = '/'
    }
  }, [userType])

  const handleProfileSaved = () => {
    // Profile form was saved
    setProfileCompleted(true)
  }

  const handleDocumentsComplete = () => {
    // Clear the step2 flag and redirect to trainer dashboard
    console.log('Documents completed, redirecting to trainer dashboard')
    localStorage.removeItem('trainer_signup_step2')
    setTimeout(() => {
      window.location.href = '/trainer'
    }, 1000)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-primary mx-auto mb-4 animate-pulse"></div>
          <p className="text-muted-foreground">Preparing your onboarding...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Progress indicator */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Complete Your Trainer Profile</h1>
          <p className="text-muted-foreground">
            We're almost there! Complete the following steps to get your account ready.
          </p>
        </div>

        {/* Step 1: Profile Form */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Step 1: Complete Your Details</CardTitle>
                <CardDescription>Bio, service rates, categories, and location</CardDescription>
              </div>
              {profileCompleted && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            </div>
          </CardHeader>
          <CardContent>
            {/* Show signup data loaded notification */}
            {signupData && (
              <Alert className="mb-6 bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 ml-2">
                  <strong>Profile Data Loaded</strong><br />
                  Name: {signupData.full_name}<br />
                  Area: {signupData.location_label || 'Location pending'}
                </AlertDescription>
              </Alert>
            )}

            {/* Inline Profile Editor Form */}
            <TrainerProfileEditor onClose={handleProfileSaved} isNewSignup={true} />
          </CardContent>
        </Card>

        {/* Step 2: Documents Upload */}
        <Card className={profileCompleted ? '' : 'opacity-50 pointer-events-none'}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Step 2: Verification Documents</CardTitle>
                <CardDescription>Upload your ID, proof of residence, and conduct certificate</CardDescription>
              </div>
              {!profileCompleted && (
                <div className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                  Complete Step 1 first
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!profileCompleted && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 ml-2">
                    Please complete and save your profile in Step 1 before uploading verification documents.
                  </AlertDescription>
                </Alert>
              )}

              {profileCompleted && <VerificationDocumentsForm onComplete={handleDocumentsComplete} />}

              {/* Info box */}
              {profileCompleted && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-medium text-sm">💡 Next Steps:</span>
                  </div>
                  <ul className="text-sm text-blue-700 space-y-1 ml-2">
                    <li>• Our admin team will review your documents (24-48 hours)</li>
                    <li>• You'll receive a notification once approved</li>
                    <li>• You can start accepting bookings after approval</li>
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default TrainerOnboardingStep2
