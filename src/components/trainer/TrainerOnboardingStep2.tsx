import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { TrainerProfileEditor } from './TrainerProfileEditor'
import { VerificationDocumentsForm } from './VerificationDocumentsForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Loader2 } from 'lucide-react'

/**
 * Step 2 of trainer onboarding after personal details signup.
 * Shows a page with two sequential modals:
 * 1. Edit Modal - for trainer details (bio, rates, categories, location, etc.)
 * 2. Upload Documents Modal - for verification documents
 * 
 * After both modals are completed, redirects to trainer dashboard.
 */
export const TrainerOnboardingStep2: React.FC = () => {
  const { user, userType } = useAuth()
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [editModalCompleted, setEditModalCompleted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Auto-open edit modal on component mount
  useEffect(() => {
    // Verify we're a trainer and have the step2 flag
    const hasStep2Flag = localStorage.getItem('trainer_signup_step2') === 'true'
    
    if (userType === 'trainer' && hasStep2Flag) {
      // Small delay to ensure auth context is ready
      const timer = setTimeout(() => {
        setShowEditModal(true)
        setIsLoading(false)
      }, 500)
      return () => clearTimeout(timer)
    } else if (userType === 'trainer') {
      // If no step2 flag, redirect to dashboard
      window.location.href = '/trainer'
    } else {
      // Not a trainer, redirect to appropriate page
      window.location.href = '/'
    }
  }, [userType])

  const handleEditModalClose = () => {
    setShowEditModal(false)
    setEditModalCompleted(true)
    // Auto-open documents modal after a brief delay
    setTimeout(() => {
      setShowDocumentsModal(true)
    }, 300)
  }

  const handleDocumentsModalClose = () => {
    setShowDocumentsModal(false)
    // Clear the step2 flag and redirect to trainer dashboard
    localStorage.removeItem('trainer_signup_step2')
    setTimeout(() => {
      window.location.href = '/trainer'
    }, 500)
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
    <>
      {/* Edit Details Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        if (!open) {
          handleEditModalClose()
        }
      }}>
        <DialogContent className="w-full rounded-none sm:rounded-lg max-w-full sm:max-w-2xl max-h-[100vh] sm:max-h-[90vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
            <DialogTitle className="text-lg sm:text-2xl">Step 1: Complete Your Details</DialogTitle>
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

      {/* Upload Documents Modal */}
      <Dialog open={showDocumentsModal} onOpenChange={(open) => {
        if (!open) {
          handleDocumentsModalClose()
        }
      }}>
        <DialogContent className="w-full rounded-none sm:rounded-lg max-w-full sm:max-w-2xl max-h-[100vh] sm:max-h-[90vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
            <DialogTitle className="text-lg sm:text-2xl">Step 2: Upload Verification Documents</DialogTitle>
            <DialogDescription className="text-xs sm:text-base mt-1">
              Upload your ID, proof of residence, and conduct certificate for verification
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 sm:mt-6 space-y-4">
            <VerificationDocumentsForm
              onComplete={() => {
                // After documents are uploaded, show completion message briefly then redirect
                setTimeout(() => {
                  handleDocumentsModalClose()
                }, 1000)
              }}
            />

            {/* Quick completion info */}
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
        </DialogContent>
      </Dialog>

      {/* Background content (visible if both modals are closed) */}
      {!showEditModal && !showDocumentsModal && editModalCompleted && (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                Great! You're all set
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your profile is being set up and documents are being reviewed. You'll be redirected to your dashboard shortly.
              </p>
              <div className="flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-trainer-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

export default TrainerOnboardingStep2
