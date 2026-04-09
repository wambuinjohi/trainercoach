import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CheckCircle, Paperclip } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { Booking, ComplaintCategory } from '@/types'

interface ComplaintModalProps {
  booking: Booking
  complainantType: 'trainer' | 'client'
  onSubmitted?: () => void
  onDismiss?: () => void
}

const COMPLAINT_CATEGORIES: { value: ComplaintCategory; label: string }[] = [
  { value: 'no_show', label: 'Client/Trainer Did Not Show' },
  { value: 'late_start', label: 'Session Started Late' },
  { value: 'quality', label: 'Quality of Service Issue' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'unprofessional', label: 'Unprofessional Behavior' },
  { value: 'other', label: 'Other' },
]

export const ComplaintModal: React.FC<ComplaintModalProps> = ({
  booking,
  complainantType,
  onSubmitted,
  onDismiss,
}) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState<ComplaintCategory>('other')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'File must be smaller than 5MB',
          variant: 'destructive',
        })
        return
      }
      setSelectedFile(file)
    }
  }

  const handleSubmit = async () => {
    if (!user || !booking?.id || !description.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide a complaint description',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // Upload file if selected
      let attachmentUrl = null
      if (selectedFile) {
        const uploadFormData = new FormData()
        uploadFormData.append('file', selectedFile)
        uploadFormData.append('booking_id', booking.id)

        try {
          const uploadResponse = await fetch('/api_upload', {
            method: 'POST',
            body: uploadFormData,
          })
          const uploadData = await uploadResponse.json()
          if (uploadData.url) {
            attachmentUrl = uploadData.url
          }
        } catch (uploadErr) {
          console.warn('File upload failed, continuing without attachment', uploadErr)
        }
      }

      // Submit complaint
      const complaintData = {
        booking_id: booking.id,
        [complainantType === 'trainer' ? 'filed_by_trainer' : 'filed_by_client']: true,
        category,
        description: description.trim(),
        attachment_url: attachmentUrl,
        status: 'open',
      }

      await apiService.makeRequest('complaint_insert', complaintData)

      toast({
        title: 'Complaint Submitted',
        description: 'Your complaint has been filed and will be reviewed by our admin team.',
      })

      setSubmitted(true)

      // Auto-close after 2 seconds
      setTimeout(() => {
        onSubmitted?.()
        onDismiss?.()
      }, 2000)
    } catch (err: any) {
      console.error('Complaint submission error:', err)
      toast({
        title: 'Error',
        description: err?.message || 'Failed to submit complaint',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/40">
        <Card className="w-full max-h-[90vh] overflow-y-auto rounded-none sm:rounded-lg sm:max-w-md">
          <CardContent className="p-4 sm:p-6 space-y-4 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Complaint Submitted</h2>
            <p className="text-muted-foreground">
              Thank you for reporting this issue. Our admin team will review it shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/40">
      <Card className="w-full max-h-[90vh] overflow-y-auto rounded-none sm:rounded-lg sm:max-w-md">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            File a Complaint
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-900 dark:text-red-200">
              Please provide details about the issue you encountered. Our admin team will review your complaint.
            </p>
          </div>

          {/* Complaint Category */}
          <div className="space-y-2">
            <label htmlFor="category" className="text-sm font-semibold">
              Complaint Category *
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-900 dark:border-gray-700"
            >
              {COMPLAINT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Complaint Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-semibold">
              Description of Issue *
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe what happened and why you are filing this complaint..."
              className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-900 dark:border-gray-700"
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              {description.length} characters
            </p>
          </div>

          {/* File Attachment */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">
              Attach Evidence (Optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Choose File
              </Button>
              {selectedFile && (
                <span className="text-sm text-muted-foreground">
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Max 5MB. Accepted: images, PDF, Word documents
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onDismiss}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={handleSubmit}
              disabled={loading || !description.trim()}
            >
              {loading ? 'Submitting...' : 'Submit Complaint'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
