import React, { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AuthForm } from './AuthForm'

interface TrainerSignupWithProfileModalProps {
  onSuccess?: (userType?: string) => void
}

/**
 * Wrapper component that shows AuthForm (signup) and automatically redirects
 * to step 2 onboarding when a trainer or client signs up.
 *
 * Trainer Step 2: Edit Modal (details) + Upload Documents Modal
 * Client Step 2: Profile Image Upload Modal
 */
export const TrainerSignupWithProfileModal: React.FC<TrainerSignupWithProfileModalProps> = ({ onSuccess }) => {
  const { userType } = useAuth()

  // Check if user just signed up and needs step 2 onboarding
  useEffect(() => {
    const trainerStep2 = localStorage.getItem('trainer_signup_step2') === 'true'
    const clientStep2 = localStorage.getItem('client_signup_step2') === 'true'

    if (trainerStep2 && userType === 'trainer') {
      // Redirect trainer to step 2 onboarding page
      window.location.href = '/signup-step2'
    } else if (clientStep2 && userType === 'client') {
      // Redirect client to step 2 profile upload page
      window.location.href = '/signup-client-step2'
    }
  }, [userType])

  return (
    <>
      {/* Signup Form */}
      <AuthForm
        initialTab="signup"
        onSuccess={(userType) => {
          // Step 2 redirects happen via useEffect above for trainer and client
          // Admin users redirect immediately
          if (userType === 'admin') {
            if (onSuccess) {
              onSuccess(userType)
            } else {
              window.location.href = '/admin'
            }
          }
        }}
      />
    </>
  )
}

export default TrainerSignupWithProfileModal
