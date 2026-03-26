import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { TrainerProfileEditor } from './TrainerProfileEditor'
import { VerificationDocumentsForm } from './VerificationDocumentsForm'
import { X } from 'lucide-react'

interface ProfileEditorModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ProfileEditorModal: React.FC<ProfileEditorModalProps> = ({ isOpen, onClose }) => {
  const handleDocumentsComplete = () => {
    // Close the modal and redirect to trainer dashboard
    onClose()
    setTimeout(() => {
      window.location.href = '/trainer'
    }, 500)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full rounded-none sm:rounded-lg max-w-full sm:max-w-2xl md:max-w-3xl max-h-[100vh] sm:max-h-[95vh] overflow-y-auto p-0 flex flex-col">
        <div className="sticky top-0 bg-background z-10 border-b p-3 sm:p-6 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-lg sm:text-2xl">Edit Your Profile</DialogTitle>
            <DialogDescription className="text-xs sm:text-base mt-1">
              Complete all required fields to progress through account verification stages
            </DialogDescription>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0 sm:hidden"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="space-y-8">
            <TrainerProfileEditor onClose={onClose} />
            <VerificationDocumentsForm onComplete={handleDocumentsComplete} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
