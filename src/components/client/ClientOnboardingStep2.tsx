import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Loader2, Upload } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import { apiRequest, withAuth } from '@/lib/api'

/**
 * Step 2 of client onboarding after personal details signup.
 * Shows a modal for uploading a profile picture.
 * 
 * After profile picture upload, redirects to client dashboard.
 */
export const ClientOnboardingStep2: React.FC = () => {
  const { user, userType } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadCompleted, setUploadCompleted] = useState(false)

  // Auto-open modal on component mount
  useEffect(() => {
    // Verify we're a client and have the step2 flag
    const hasStep2Flag = localStorage.getItem('client_signup_step2') === 'true'

    if (userType === 'client' && hasStep2Flag) {
      // Small delay to ensure auth context is ready
      const timer = setTimeout(() => {
        setShowModal(true)
        setIsLoading(false)
      }, 500)
      return () => clearTimeout(timer)
    } else if (userType === 'client') {
      // If no step2 flag, redirect to dashboard
      window.location.href = '/client'
    } else {
      // Not a client, redirect to appropriate page
      window.location.href = '/'
    }
  }, [userType])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Profile photo must be smaller than 5MB.',
          variant: 'destructive'
        })
        return
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an image file (JPG, PNG, GIF, or WebP).',
          variant: 'destructive'
        })
        return
      }

      setSelectedFile(file)

      // Show preview
      const reader = new FileReader()
      reader.onload = (event) => {
        const preview = event.target?.result as string
        setProfileImage(preview)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !user?.id) {
      toast({
        title: 'Error',
        description: 'Please select a file to upload',
        variant: 'destructive'
      })
      return
    }

    setIsUploading(true)
    try {
      const response = await apiService.uploadProfileImage(user.id, selectedFile)
      if (response?.file_url) {
        // Save the profile image URL to the database
        await apiRequest('profile_update', {
          user_id: user.id,
          profile_image: response.file_url
        }, { headers: withAuth() })

        toast({
          title: 'Success',
          description: 'Profile photo uploaded successfully'
        })
        setUploadCompleted(true)
        setShowModal(false)
        // Clear the step2 flag and redirect to client dashboard
        localStorage.removeItem('client_signup_step2')
        setTimeout(() => {
          window.location.href = '/client'
        }, 500)
      } else {
        throw new Error('No image URL returned from upload')
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Could not upload profile photo',
        variant: 'destructive'
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleSkip = () => {
    setShowModal(false)
    localStorage.removeItem('client_signup_step2')
    setTimeout(() => {
      window.location.href = '/client'
    }, 500)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-primary mx-auto mb-4 animate-pulse"></div>
          <p className="text-muted-foreground">Preparing your profile...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Profile Image Upload Modal */}
      <Dialog open={showModal} onOpenChange={(open) => {
        if (!open) {
          handleSkip()
        }
      }}>
        <DialogContent className="w-full rounded-none sm:rounded-lg max-w-full sm:max-w-md p-3 sm:p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg sm:text-2xl">Add Profile Photo</DialogTitle>
            <DialogDescription className="text-xs sm:text-base mt-1">
              Choose a profile picture to help trainers recognize you (optional)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Image Preview */}
            <div className="flex justify-center">
              {profileImage ? (
                <div className="relative">
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border-2 border-trainer-primary"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-muted border-2 border-dashed border-trainer-primary/30 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground text-center px-4">No photo selected</span>
                </div>
              )}
            </div>

            {/* Upload Area */}
            <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-trainer-primary/20 rounded-lg cursor-pointer hover:border-trainer-primary/50 transition bg-trainer-primary/5 hover:bg-trainer-primary/10">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-trainer-primary/60" />
                <span className="text-sm font-medium text-foreground">Click to upload or drag and drop</span>
                <span className="text-xs text-muted-foreground">JPG, PNG, GIF or WebP (max 5MB)</span>
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </label>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={isUploading}
                className="flex-1"
              >
                Skip for now
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload & Continue'
                )}
              </Button>
            </div>

            {/* Info */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                💡 A profile photo helps trainers get to know you better and builds trust.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Background content (visible if modal is closed) */}
      {!showModal && uploadCompleted && (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                All set!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your profile is ready. Redirecting you to the dashboard...
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

export default ClientOnboardingStep2
