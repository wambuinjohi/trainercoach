import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle, Upload, Loader2, Trash2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'

interface IdDocument {
  type: 'national_id' | 'passport'
  side?: 'front' | 'back' // Only for national_id
  status: 'pending' | 'approved' | 'rejected'
  fileUrl?: string
  rejectionReason?: string
  uploadedAt?: string
  idNumber?: string
  preview?: string
  uploadProgress?: number
}

interface IdDocumentUploadSectionProps {
  onIdTypeChange?: (idType: 'national_id' | 'passport') => void
  onPassportNumberChange?: (number: string) => void
  initialIdType?: 'national_id' | 'passport'
  initialPassportNumber?: string
}

export const IdDocumentUploadSection: React.FC<IdDocumentUploadSectionProps> = ({
  onIdTypeChange,
  onPassportNumberChange,
  initialIdType = 'national_id',
  initialPassportNumber = ''
}) => {
  const { user } = useAuth()
  const userId = user?.id
  const [idType, setIdType] = useState<'national_id' | 'passport'>(initialIdType)
  const [passportNumber, setPassportNumber] = useState(initialPassportNumber)
  const [documents, setDocuments] = useState<IdDocument[]>([])
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null)
  const [idNumber, setIdNumber] = useState('')

  // Initialize documents based on ID type
  useEffect(() => {
    loadDocuments()
  }, [userId])

  const getDocumentKey = (side?: 'front' | 'back') => {
    if (idType === 'passport') {
      return 'passport'
    }
    return `national_id${side ? '_' + side : ''}`
  }

  const loadDocuments = async () => {
    if (!userId) return
    try {
      const response = await apiService.getVerificationDocuments(userId)
      let docs = Array.isArray(response) ? response : (response?.data && Array.isArray(response.data) ? response.data : [])

      if (Array.isArray(docs)) {
        // Filter only ID-related documents
        const idDocs = docs.filter(d => 
          d.document_type === 'national_id' || d.document_type === 'passport'
        )

        // Map to our internal structure
        const mappedDocs: IdDocument[] = []
        
        // Group by type
        if (idType === 'national_id') {
          // Add front and back for national ID
          const frontDoc = idDocs.find(d => d.document_type === 'national_id' && d.id_side === 'front')
          const backDoc = idDocs.find(d => d.document_type === 'national_id' && d.id_side === 'back')

          if (frontDoc) {
            mappedDocs.push({
              type: 'national_id',
              side: 'front',
              status: frontDoc.status,
              fileUrl: frontDoc.file_url,
              rejectionReason: frontDoc.rejection_reason,
              uploadedAt: frontDoc.uploaded_at,
              idNumber: frontDoc.id_number
            })
          } else {
            mappedDocs.push({
              type: 'national_id',
              side: 'front',
              status: 'pending'
            })
          }

          if (backDoc) {
            mappedDocs.push({
              type: 'national_id',
              side: 'back',
              status: backDoc.status,
              fileUrl: backDoc.file_url,
              rejectionReason: backDoc.rejection_reason,
              uploadedAt: backDoc.uploaded_at,
              idNumber: backDoc.id_number
            })
          } else {
            mappedDocs.push({
              type: 'national_id',
              side: 'back',
              status: 'pending'
            })
          }
        } else {
          // Passport - single document
          const passportDoc = idDocs.find(d => d.document_type === 'passport')
          if (passportDoc) {
            mappedDocs.push({
              type: 'passport',
              status: passportDoc.status,
              fileUrl: passportDoc.file_url,
              rejectionReason: passportDoc.rejection_reason,
              uploadedAt: passportDoc.uploaded_at,
              idNumber: passportDoc.id_number
            })
          } else {
            mappedDocs.push({
              type: 'passport',
              status: 'pending'
            })
          }
        }

        setDocuments(mappedDocs)
        if (idDocs.length > 0 && idDocs[0].id_number) {
          setIdNumber(idDocs[0].id_number)
        }
      }
    } catch (error) {
      console.warn('Failed to load ID documents:', error)
    }
  }

  const handleIdTypeChange = (newType: 'national_id' | 'passport') => {
    setIdType(newType)
    onIdTypeChange?.(newType)
    // Reset documents when switching type
    setDocuments([])
    setIdNumber('')
    loadDocuments()
  }

  const handlePassportNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPassportNumber(value)
    onPassportNumberChange?.(value)
  }

  const handleFileUpload = async (docType: 'national_id' | 'passport', side?: 'front' | 'back', file?: File) => {
    if (!userId || !file) return

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 5MB', variant: 'destructive' })
      return
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Only JPG, PNG, and PDF files are allowed', variant: 'destructive' })
      return
    }

    const docKey = side ? `${docType}_${side}` : docType
    setUploadingDocId(docKey)

    // Create preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setDocuments(prev =>
          prev.map(d =>
            (d.type === docType && d.side === side) ? { ...d, preview: e.target?.result as string } : d
          )
        )
      }
      reader.readAsDataURL(file)
    }

    // Update progress
    setDocuments(prev =>
      prev.map(d =>
        (d.type === docType && d.side === side) ? { ...d, uploadProgress: 0 } : d
      )
    )

    try {
      const uploadDocType = side ? `${docType}_${side}` : docType
      
      // Prepare additional data for API
      const additionalData = {
        id_side: side || null,
        id_number: idNumber || undefined
      }

      const response = await apiService.uploadVerificationDocument(
        userId,
        uploadDocType,
        file,
        undefined,
        (progress) => {
          setDocuments(prev =>
            prev.map(d =>
              (d.type === docType && d.side === side) ? { ...d, uploadProgress: progress } : d
            )
          )
        },
        additionalData
      )

      if (response?.status === 'success') {
        toast({ title: 'Success', description: `${side ? side.charAt(0).toUpperCase() + side.slice(1) : 'Passport'} uploaded successfully` })
        loadDocuments()
      } else {
        throw new Error(response?.message || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Could not upload document',
        variant: 'destructive'
      })
      setDocuments(prev =>
        prev.map(d =>
          (d.type === docType && d.side === side) ? { ...d, preview: undefined, uploadProgress: undefined } : d
        )
      )
    } finally {
      setUploadingDocId(null)
    }
  }

  const renderDocument = (doc: IdDocument) => {
    const docKey = doc.side ? `${doc.type}_${doc.side}` : doc.type
    const isUploading = uploadingDocId === docKey

    return (
      <Card key={docKey} className={`border ${doc.status === 'approved' ? 'border-green-200 bg-green-50' : doc.status === 'rejected' ? 'border-red-200 bg-red-50' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold">
                  {doc.type === 'passport' ? 'Passport' : `National ID - ${doc.side?.charAt(0).toUpperCase()}${doc.side?.slice(1)}`}
                </h4>
                <Badge variant={doc.status === 'approved' ? 'default' : doc.status === 'rejected' ? 'destructive' : 'secondary'}>
                  {doc.status === 'pending' ? 'Pending' : doc.status === 'approved' ? 'Approved' : 'Rejected'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">
                {doc.type === 'passport' ? 'Upload your passport (one-sided)' : `Upload the ${doc.side} side of your national ID`}
              </p>
            </div>
          </div>

          {/* Existing document preview */}
          {doc.fileUrl && (
            <div className={`mb-3 border-2 rounded-lg p-4 ${
              doc.status === 'approved'
                ? 'border-green-200 bg-green-50'
                : doc.status === 'rejected'
                ? 'border-red-200 bg-red-50'
                : 'border-blue-200 bg-blue-50'
            }`}>
              <p className={`text-xs font-medium mb-3 ${
                doc.status === 'approved'
                  ? 'text-green-700'
                  : doc.status === 'rejected'
                  ? 'text-red-700'
                  : 'text-blue-700'
              }`}>
                📄 {doc.status === 'approved' ? 'Approved Document' : doc.status === 'rejected' ? 'Document (Rejected)' : 'Current Document'}
              </p>
              {doc.fileUrl.startsWith('http') ? (
                <img src={doc.fileUrl} alt="ID Document" className="max-w-full max-h-72 rounded object-contain mx-auto" />
              ) : (
                <div className="flex items-center justify-center py-6">
                  <span className="text-lg">📄 Document</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-3">
                <CheckCircle2 className={`h-4 w-4 ${
                  doc.status === 'approved'
                    ? 'text-green-600'
                    : doc.status === 'rejected'
                    ? 'text-red-600'
                    : 'text-blue-600'
                }`} />
                <p className={`text-xs ${
                  doc.status === 'approved'
                    ? 'text-green-600'
                    : doc.status === 'rejected'
                    ? 'text-red-600'
                    : 'text-blue-600'
                }`}>
                  {doc.status === 'pending' ? 'Awaiting review' : doc.status === 'approved' ? 'Approved' : 'Rejected'} - {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Recently'}
                </p>
              </div>
            </div>
          )}

          {/* Rejection reason */}
          {doc.status === 'rejected' && doc.rejectionReason && (
            <Alert className="mb-3 bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {doc.rejectionReason}
              </AlertDescription>
            </Alert>
          )}

          {/* Upload section */}
          {doc.status !== 'approved' && (
            <div className="mb-3 space-y-3">
              {/* Preview */}
              {doc.preview && (
                <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                  <p className="text-xs font-medium text-green-700 mb-3">Preview - Ready to Upload</p>
                  {doc.preview.startsWith('data:') ? (
                    <img src={doc.preview} alt="Preview" className="max-w-full max-h-72 rounded object-contain mx-auto" />
                  ) : (
                    <div className="flex items-center justify-center py-6">
                      <span className="text-lg">{doc.preview}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Upload progress */}
              {isUploading && doc.uploadProgress !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Uploading...</span>
                    <span className="text-gray-600 font-medium">{doc.uploadProgress}%</span>
                  </div>
                  <Progress value={doc.uploadProgress} className="h-2" />
                </div>
              )}

              {/* Upload input */}
              {!doc.preview || isUploading ? (
                <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition">
                  <div className="flex flex-col items-center gap-2">
                    {isUploading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        <span className="text-sm text-gray-600">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-600">Click to upload or drag and drop</span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleFileUpload(doc.type, doc.side, file)
                      }
                    }}
                    disabled={isUploading}
                  />
                </label>
              ) : (
                <button
                  onClick={() => {
                    setDocuments(prev =>
                      prev.map(d =>
                        (d.type === doc.type && d.side === doc.side) ? { ...d, preview: undefined, uploadProgress: undefined } : d
                      )
                    )
                  }}
                  className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Change File
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const allDocumentsApproved = documents.every(d => d.status === 'approved')
  const allDocumentsSubmitted = documents.every(d => d.status !== 'pending')

  return (
    <div className="space-y-4">
      {/* ID Type Selection */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-base font-semibold mb-3 block">Document Type</Label>
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="radio"
                id="national_id"
                name="id_type"
                value="national_id"
                checked={idType === 'national_id'}
                onChange={() => handleIdTypeChange('national_id')}
                className="h-4 w-4 text-blue-600 cursor-pointer"
              />
              <label htmlFor="national_id" className="ml-3 cursor-pointer flex-1">
                <span className="font-medium">National ID</span>
                <p className="text-sm text-gray-600">Two-sided document (front and back required)</p>
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                id="passport"
                name="id_type"
                value="passport"
                checked={idType === 'passport'}
                onChange={() => handleIdTypeChange('passport')}
                className="h-4 w-4 text-blue-600 cursor-pointer"
              />
              <label htmlFor="passport" className="ml-3 cursor-pointer flex-1">
                <span className="font-medium">Passport</span>
                <p className="text-sm text-gray-600">One-sided document (photo page only)</p>
              </label>
            </div>
          </div>

          {/* Passport number field */}
          {idType === 'passport' && (
            <div className="mt-4 pt-4 border-t">
              <Label htmlFor="passport_number" className="block mb-2">Passport Number</Label>
              <Input
                id="passport_number"
                value={passportNumber}
                onChange={handlePassportNumberChange}
                placeholder="Enter your passport number"
                className="max-w-xs"
              />
            </div>
          )}

          {/* ID Number field for National ID */}
          {idType === 'national_id' && (
            <div className="mt-4 pt-4 border-t">
              <Label htmlFor="id_number" className="block mb-2">National ID Number</Label>
              <Input
                id="id_number"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="Enter your national ID number"
                className="max-w-xs"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <div className="space-y-4">
        {documents.map(renderDocument)}
      </div>

      {/* Status messages */}
      {allDocumentsApproved && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {idType === 'passport' ? 'Passport' : 'National ID'} has been approved!
          </AlertDescription>
        </Alert>
      )}

      {allDocumentsSubmitted && !allDocumentsApproved && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Documents are being reviewed by our admin team. This usually takes 24-48 hours.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
