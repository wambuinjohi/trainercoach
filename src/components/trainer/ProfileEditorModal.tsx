import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { TrainerProfileEditor } from './TrainerProfileEditor'
import { X } from 'lucide-react'

interface ProfileEditorModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ProfileEditorModal: React.FC<ProfileEditorModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-full sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-5xl max-h-[95vh] overflow-y-auto p-4 sm:p-6 rounded-lg">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl sm:text-2xl">Edit Your Profile</DialogTitle>
              <DialogDescription className="text-sm sm:text-base mt-1">
                Complete all required fields to progress through account verification stages
              </DialogDescription>
            </div>
            {/* Close button for mobile */}
            <button
              onClick={onClose}
              className="ml-2 p-1 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 sm:hidden"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>
        <div className="mt-6 pr-0 sm:pr-0">
          <TrainerProfileEditor onClose={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
