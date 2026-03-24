import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { TrainerProfileEditor } from './TrainerProfileEditor'
import { VerificationDocumentsForm } from './VerificationDocumentsForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Loader2 } from 'lucide-react'

/**
 * Step 2 of trainer onboarding after personal details signup.
 * Full page layout with:
 * 1. Edit Modal - triggered for trainer details (bio, rates, categories, location, etc.)
 * 2. Main page - for verification documents upload and onboarding info
 *
 * After both are completed, redirects to trainer dashboard.
 */
export const TrainerOnboardingStep2: React.FC = () => {
  const { user, userType } = useAuth()
  const [showEditModal, setShowEditModal] = useState(false)
  const [editModalCompleted, setEditModalCompleted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize on component mount
  useEffect(() => {
    // Verify we're a trainer and have the step2 flag
    const hasStep2Flag = localStorage.getItem('trainer_signup_step2') === 'true'

    console.log('TrainerOnboardingStep2 mounted:', { userType, hasStep2Flag })

    if (userType === 'trainer' && hasStep2Flag) {
      // Small delay to ensure auth context is ready
      const timer = setTimeout(() => {
        setIsLoading(false)
        // Auto-open edit modal on first load
        setShowEditModal(true)
      }, 500)
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

  const handleEditModalClose = () => {
    setShowEditModal(false)
    setEditModalCompleted(true)
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
      <div className="max-w-2xl mx-auto">
        {/* Progress indicator */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Complete Your Trainer Profile</h1>
          <p className="text-muted-foreground">
            We're almost there! Complete the following steps to get your account ready.
          </p>
        </div>

        {/* Step 1: Profile Details */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Step 1: Profile Details</CardTitle>
                <CardDescription>Bio, rates, categories, and location</CardDescription>
              </div>
              {editModalCompleted && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            </div>
          </CardHeader>
          <CardContent>
            {editModalCompleted ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>✓ Your profile details have been saved</p>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="text-trainer-primary hover:underline font-medium"
                >
                  Edit profile
                </button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p className="mb-3">Click the button below to complete your profile information</p>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-4 py-2 bg-trainer-primary text-white rounded-lg hover:bg-trainer-primary/90 font-medium"
                >
                  Complete Your Details
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Documents Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 2: Verification Documents</CardTitle>
            <CardDescription>ID, proof of residence, and conduct certificate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <VerificationDocumentsForm onComplete={handleDocumentsComplete} />

              {/* Info box */}
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        if (!open) {
          handleEditModalClose()
        }
      }}>
        <DialogContent className="w-full rounded-none sm:rounded-lg max-w-full sm:max-w-2xl max-h-[100vh] sm:max-h-[90vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
            <DialogTitle className="text-lg sm:text-2xl">Complete Your Details</DialogTitle>
            <DialogDescription className="text-xs sm:text-base mt-1">
              Add your bio, service rates, categories, and service location
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 sm:mt-6">
            <TrainerProfileEditor
              onClose={handleEditModalClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TrainerOnboardingStep2
