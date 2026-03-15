import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { TrainerProfileEditor } from './TrainerProfileEditor'

interface ProfileEditorModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ProfileEditorModal: React.FC<ProfileEditorModalProps> = ({ isOpen, onClose }) => {
  const [mountKey, setMountKey] = useState(0)

  useEffect(() => {
    if (isOpen) {
      // Force remount when modal opens to trigger fresh data load
      setMountKey(prev => prev + 1)
    }
  }, [isOpen])

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
          {isOpen && <TrainerProfileEditor key={`profile-editor-${mountKey}`} onClose={onClose} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
