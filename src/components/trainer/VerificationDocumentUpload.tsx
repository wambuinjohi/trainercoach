import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import { DocumentType } from '@/types'

interface DocumentStatus {
  type: DocumentType
  status: 'pending' | 'approved' | 'rejected'
  file_url?: string
  rejection_reason?: string
  uploaded_at?: string
  reviewed_at?: string
}

interface VerificationDocumentUploadProps {
  trainerId: string
  onDocumentUploaded?: (documentType: DocumentType) => void
  onComplete?: () => void
}

const DOCUMENT_TYPES: Array<{
  type: DocumentType
  label: string
  description: string
  required: boolean
}> = [
  {
    type: 'national_id',
    label: 'National ID',
    description: 'A clear copy of your national identification document',
    required: true
  },
  {
    type: 'proof_of_residence',
    label: 'Proof of Residence',
    description: 'GPS location confirmation of your address',
    required: true
  },
  {
    type: 'certificate_of_good_conduct',
    label: 'Certificate of Good Conduct',
    description: 'Government-issued certificate of good conduct (within 90 days)',
    required: true
  }
]

export const VerificationDocumentUpload: React.FC<VerificationDocumentUploadProps> = ({
  trainerId,
  onDocumentUploaded,
  onComplete
}) => {
  const [documents, setDocuments] = useState<DocumentStatus[]>([])
  const [uploading, setUploading] = useState<DocumentType | null>(null)
  const [loading, setLoading] = useState(false)
  const [idNumber, setIdNumber] = useState('')

  const handleDocumentUpload = async (
    documentType: DocumentType,
    file: File,
    idNum?: string
  ) => {
    setUploading(documentType)
    try {
      const response = await apiService.uploadVerificationDocument(
        trainerId,
        documentType,
        file,
        idNum
      )

      if (response?.status === 'success' || response?.data) {
        toast({
          title: 'Document uploaded',
          description: `${DOCUMENT_TYPES.find(d => d.type === documentType)?.label} has been submitted for review.`
        })

        setDocuments(prev => {
          const existing = prev.find(d => d.type === documentType)
          if (existing) {
            return prev.map(d =>
              d.type === documentType
                ? { ...d, status: 'pending', file_url: response.data?.file_url }
                : d
            )
          }
          return [...prev, {
            type: documentType,
            status: 'pending',
            file_url: response.data?.file_url
          }]
        })

        onDocumentUploaded?.(documentType)
      } else {
        throw new Error(response?.message || 'Upload failed')
      }
    } catch (error) {
      console.error('Document upload error:', error)
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload document',
        variant: 'destructive'
      })
    } finally {
      setUploading(null)
    }
  }

  const getStatusIcon = (status: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />
    }
  }

  const getStatusBadge = (status: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Approved</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Rejected</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending Review</Badge>
    }
  }

  const handleFileSelect = (documentType: DocumentType, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif']
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF or image file (JPG, PNG, GIF)',
        variant: 'destructive'
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 5MB',
        variant: 'destructive'
      })
      return
    }

    const idNum = documentType === 'national_id' ? idNumber : undefined
    handleDocumentUpload(documentType, file, idNum)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Verification Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Please upload all required documents for verification. Your account will remain in pending status until all documents are reviewed and approved.
        </p>

        <div className="space-y-4">
          {DOCUMENT_TYPES.map((docType) => {
            const uploadedDoc = documents.find(d => d.type === docType.type)
            const isUploading = uploading === docType.type

            return (
              <div
                key={docType.type}
                className="border border-border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground">{docType.label}</h4>
                      {docType.required && (
                        <Badge variant="outline" className="text-xs">Required</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{docType.description}</p>
                  </div>
                  {uploadedDoc && getStatusIcon(uploadedDoc.status)}
                </div>

                {uploadedDoc && (
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm text-muted-foreground">
                      Uploaded {uploadedDoc.uploaded_at ? new Date(uploadedDoc.uploaded_at).toLocaleDateString() : 'recently'}
                    </span>
                    {getStatusBadge(uploadedDoc.status)}
                  </div>
                )}

                {uploadedDoc?.rejection_reason && (
                  <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      <strong>Rejection reason:</strong> {uploadedDoc.rejection_reason}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                      Please re-upload a corrected document.
                    </p>
                  </div>
                )}

                {docType.type === 'national_id' && !uploadedDoc && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">ID Number</label>
                    <input
                      type="text"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      placeholder="Enter your ID number"
                      className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground placeholder-muted-foreground"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif"
                    onChange={(e) => handleFileSelect(docType.type, e)}
                    disabled={isUploading || loading}
                    className="hidden"
                    id={`document-input-${docType.type}`}
                  />
                  <label
                    htmlFor={`document-input-${docType.type}`}
                    className="flex-1"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={isUploading || loading}
                      asChild
                    >
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        {isUploading ? 'Uploading...' : uploadedDoc ? 'Re-upload' : 'Upload'}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            )
          })}
        </div>

        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-1">Upload Requirements</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>All documents must be clear and readable</li>
                <li>Accepted formats: PDF, JPG, PNG, GIF (max 5MB each)</li>
                <li>Personal information must be visible</li>
                <li>Documents must be recent and valid</li>
              </ul>
            </div>
          </div>
        </div>

        {onComplete && (
          <Button
            onClick={onComplete}
            className="w-full"
            disabled={loading || uploading !== null}
          >
            {loading ? 'Processing...' : 'Complete Verification'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
