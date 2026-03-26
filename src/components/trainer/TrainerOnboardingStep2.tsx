import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { TrainerProfileEditor } from './TrainerProfileEditor'
import { VerificationDocumentsForm } from './VerificationDocumentsForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import * as apiService from '@/lib/api-service'

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
  const [documentRefreshTrigger, setDocumentRefreshTrigger] = useState(0)

  const checkProfileCompletion = async () => {
    if (!user?.id) return

    try {
      const [profileResponse, categoriesResponse] = await Promise.all([
        apiService.getUserProfile(user.id),
        apiService.getTrainerCategories(user.id),
      ])

      const profileList = Array.isArray(profileResponse)
        ? profileResponse
        : (profileResponse?.data && Array.isArray(profileResponse.data) ? profileResponse.data : [])
      const categoriesList = Array.isArray(categoriesResponse)
        ? categoriesResponse
        : (categoriesResponse?.data && Array.isArray(categoriesResponse.data) ? categoriesResponse.data : [])
      const profileData = profileList[0]
      const hasProfileBasics = Boolean(
        String(profileData?.full_name || profileData?.name || '').trim() &&
        Number(profileData?.hourly_rate) > 0 &&
        String(profileData?.mpesa_number || '').trim() &&
        String(profileData?.area_of_residence || profileData?.location_label || '').trim()
      )

      setProfileCompleted(hasProfileBasics && categoriesList.length > 0)
    } catch (error) {
      console.warn('Failed to determine trainer onboarding step completion:', error)
    }
  }

  // Initialize on component mount
  useEffect(() => {
    // Verify we're a trainer and have the step2 flag
    const hasStep2Flag = localStorage.getItem('trainer_signup_step2') === 'true'

    console.log('TrainerOnboardingStep2 mounted:', { userType, hasStep2Flag, signupData })

    if (userType === 'trainer' && hasStep2Flag) {
      const timer = setTimeout(async () => {
        await checkProfileCompletion()
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
  }, [user?.id, userType])

  const handleProfileSaved = () => {
    // Profile form was saved
    setProfileCompleted(true)
    // Trigger a reload of verification documents to pick up auto-generated proof_of_residence
    setDocumentRefreshTrigger(prev => prev + 1)
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

            {profileCompleted && (
              <Alert className="mb-6 bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 ml-2">
                  Your profile is saved. You can now continue with verification documents.
                </AlertDescription>
              </Alert>
            )}

            <TrainerProfileEditor onSaveSuccess={handleProfileSaved} isNewSignup={true} />
          </CardContent>
        </Card>

        {/* Step 2: Documents Upload */}
        {profileCompleted ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Step 2: Verification Documents</CardTitle>
                  <CardDescription>Upload your ID, proof of residence, and conduct certificate</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <VerificationDocumentsForm onComplete={handleDocumentsComplete} refreshTrigger={documentRefreshTrigger} />

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-medium text-sm">Next steps</span>
                  </div>
                  <ul className="text-sm text-blue-700 space-y-1 ml-2">
                    <li>• Our admin team will review your documents</li>
                    <li>• You'll receive a notification once approved</li>
                    <li>• You can start accepting bookings after approval</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-amber-300 bg-amber-50/40">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Step 2: Verification Documents</CardTitle>
                  <CardDescription>This step unlocks after your profile has been saved.</CardDescription>
                </div>
                <div className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                  Pending Step 1
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 ml-2">
                  Complete and save your trainer profile above to unlock document uploads.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default TrainerOnboardingStep2
