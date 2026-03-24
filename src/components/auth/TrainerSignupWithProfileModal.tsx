import React, { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AuthForm } from './AuthForm'

interface TrainerSignupWithProfileModalProps {
  onSuccess?: (userType?: string) => void
}

/**
 * Wrapper component that shows AuthForm (signup) and automatically redirects
 * to step 2 onboarding when a trainer signs up.
 *
 * Step 2 includes Edit Modal (trainer details) and Upload Documents Modal
 * before final redirect to the trainer dashboard.
 */
export const TrainerSignupWithProfileModal: React.FC<TrainerSignupWithProfileModalProps> = ({ onSuccess }) => {
  const { userType } = useAuth()

  // Check if trainer just signed up and needs step 2 onboarding
  useEffect(() => {
    const needsStep2 = localStorage.getItem('trainer_signup_step2') === 'true'
    if (needsStep2 && userType === 'trainer') {
      // Redirect to step 2 onboarding page
      window.location.href = '/signup-step2'
    }
  }, [userType])

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
          // For trainers, step 2 redirect will happen via useEffect above
        }}
      />
    </>
  )
}

export default TrainerSignupWithProfileModal
