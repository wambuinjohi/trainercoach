import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { AuthForm } from './AuthForm'
import { TrainerProfileEditor } from '@/components/trainer/TrainerProfileEditor'

interface TrainerSignupWithProfileModalProps {
  onSuccess?: (userType?: string) => void
}

/**
 * Wrapper component that shows AuthForm (signup) and automatically opens
 * a modal with TrainerProfileEditor when a trainer signs up.
 * 
 * This allows trainers to set up their profile immediately after signup
 * before being redirected to the trainer dashboard.
 */
export const TrainerSignupWithProfileModal: React.FC<TrainerSignupWithProfileModalProps> = ({ onSuccess }) => {
  const { userType, clearSignupData } = useAuth()
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [hasSignedUp, setHasSignedUp] = useState(false)

  // Check if trainer just signed up (trainer_signup_new flag in localStorage)
  useEffect(() => {
    const isNewTrainerSignup = localStorage.getItem('trainer_signup_new') === 'true'
    if (isNewTrainerSignup && userType === 'trainer' && !hasSignedUp) {
      setHasSignedUp(true)
      setShowProfileModal(true)
    }
  }, [userType, hasSignedUp])

  const handleProfileModalClose = () => {
    setShowProfileModal(false)
    // Clear signup data flags
    localStorage.removeItem('trainer_signup_new')
    clearSignupData()
    // Redirect to trainer dashboard
    if (onSuccess) {
      onSuccess('trainer')
    } else {
      window.location.href = '/trainer'
    }
  }

  return (
    <>
      {/* Signup Form */}
      <AuthForm
        initialTab="signup"
        onSuccess={(userType) => {
          // For non-trainer users, redirect immediately
          if (userType !== 'trainer') {
            if (onSuccess) {
              onSuccess(userType)
            } else {
              if (userType === 'admin') window.location.href = '/admin'
              else window.location.href = '/client'
            }
          }
          // For trainers, the modal will show automatically via the useEffect above
        }}
      />

      {/* Profile Setup Modal - shows after trainer signup */}
      <Dialog open={showProfileModal} onOpenChange={(open) => {
        if (!open) {
          handleProfileModalClose()
        }
      }}>
        <DialogContent className="w-full rounded-none sm:rounded-lg max-w-full sm:max-w-2xl max-h-[100vh] sm:max-h-[90vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
            <DialogTitle className="text-lg sm:text-2xl">Complete Your Profile</DialogTitle>
            <DialogDescription className="text-xs sm:text-base mt-1">
              Set up your trainer profile to start accepting bookings. You can update this anytime.
            </DialogDescription>
          </DialogHeader>

          {/* Profile Editor */}
          <div className="mt-4 sm:mt-6">
            <TrainerProfileEditor
              onClose={handleProfileModalClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default TrainerSignupWithProfileModal
