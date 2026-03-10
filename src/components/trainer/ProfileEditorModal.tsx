import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { TrainerProfileEditor } from './TrainerProfileEditor'

interface ProfileEditorModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ProfileEditorModal: React.FC<ProfileEditorModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Your Profile</DialogTitle>
          <DialogDescription>
            Complete all required fields to progress through account verification stages
          </DialogDescription>
        </DialogHeader>
        <div className="mt-6">
          <TrainerProfileEditor onClose={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
