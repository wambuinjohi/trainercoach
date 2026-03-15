import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Clock, CheckCircle2, AlertCircle, FileText, Upload, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'

interface Document {
  type: 'national_id_front' | 'national_id_back' | 'proof_of_residence' | 'certificate_of_good_conduct'
  label: string
  description: string
  status: 'pending' | 'approved' | 'rejected'
  fileUrl?: string
  rejectionReason?: string
  uploadedAt?: string
  expiresAt?: string
  idNumber?: string
  preview?: string // Data URL for image preview
  uploadProgress?: number // 0-100
}

const requiredDocuments: Document[] = [
  {
    type: 'national_id_front',
    label: 'National ID - Front',
    description: 'Upload a clear photo of the front of your national ID',
    status: 'pending'
  },
  {
    type: 'national_id_back',
    label: 'National ID - Back',
    description: 'Upload a clear photo of the back of your national ID',
    status: 'pending'
  },
  {
    type: 'proof_of_residence',
    label: 'Proof of Residence',
    description: 'GPS location confirmation of your address will be captured separately',
    status: 'pending'
  },
  {
    type: 'certificate_of_good_conduct',
    label: 'Certificate of Good Conduct',
    description: 'Must be uploaded within 90 days of issuance',
    status: 'pending',
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  }
]

interface VerificationDocumentsFormProps {
  onComplete?: () => void
}

export const VerificationDocumentsForm: React.FC<VerificationDocumentsFormProps> = ({ onComplete }) => {
  const { user } = useAuth()
  const userId = user?.id
  const [documents, setDocuments] = useState<Document[]>(requiredDocuments)
  const [loading, setLoading] = useState(false)
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null)
  const [idNumber, setIdNumber] = useState('')
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [registrationPath, setRegistrationPath] = useState<'direct' | 'sponsored'>('direct')
  const [profileLoading, setProfileLoading] = useState(true)

  // Load registration path and existing documents on mount
  useEffect(() => {
    if (!userId) return
    loadProfileAndDocuments()
  }, [userId])

  const loadProfileAndDocuments = async () => {
    try {
      // Load profile to get registration path
      const profileResponse = await apiService.getUserProfile(userId)
      if (profileResponse?.data && profileResponse.data.length > 0) {
        const profile = profileResponse.data[0]
        setRegistrationPath(profile.registration_path || 'direct')
      }
      // Load documents
      loadDocuments()
    } finally {
      setProfileLoading(false)
    }
  }

  // Timer for Good Conduct cert
  useEffect(() => {
    const goodConductDoc = documents.find(d => d.type === 'certificate_of_good_conduct')
    if (goodConductDoc?.expiresAt && goodConductDoc.status === 'pending') {
      const expiresTime = new Date(goodConductDoc.expiresAt).getTime()
      const now = Date.now()
      const remaining = Math.max(0, expiresTime - now)

      setTimeRemaining(remaining > 0 ? remaining : null)

      if (remaining > 0) {
        const interval = setInterval(() => {
          setTimeRemaining(prev => {
            if (!prev || prev <= 0) {
              clearInterval(interval)
              return null
            }
            return prev - 1000
          })
        }, 1000)

        return () => clearInterval(interval)
      }
    }
  }, [documents])

  const loadDocuments = async () => {
    try {
      const response = await apiService.getVerificationDocuments(userId!)
      if (response?.data && Array.isArray(response.data)) {
        const loadedDocs: Document[] = requiredDocuments
          .map(reqDoc => {
            const uploaded = response.data.find(d => d.document_type === reqDoc.type)
            return {
              ...reqDoc,
              status: uploaded?.status || 'pending',
              fileUrl: uploaded?.file_url,
              rejectionReason: uploaded?.rejection_reason,
              uploadedAt: uploaded?.uploaded_at,
              expiresAt: uploaded?.expires_at,
              idNumber: uploaded?.id_number
            }
          })
        setDocuments(loadedDocs)
      }
    } catch (error) {
      console.warn('Failed to load verification documents:', error)
    }
  }

  const handleFileUpload = async (docType: string, file: File) => {
    if (!userId) {
      toast({ title: 'Error', description: 'User not found', variant: 'destructive' })
      return
    }

    // Validate file size (max 5MB)
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

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setDocuments(prev =>
          prev.map(d =>
            d.type === docType ? { ...d, preview: e.target?.result as string } : d
          )
        )
      }
      reader.readAsDataURL(file)
    } else {
      // For PDFs, show file name as preview
      setDocuments(prev =>
        prev.map(d =>
          d.type === docType ? { ...d, preview: `📄 ${file.name}` } : d
        )
      )
    }

    setUploadingDocType(docType)
    setDocuments(prev =>
      prev.map(d =>
        d.type === docType ? { ...d, uploadProgress: 0 } : d
      )
    )

    try {
      const response = await apiService.uploadVerificationDocument(
        userId,
        docType,
        file,
        undefined,
        (progress) => {
          // Update upload progress
          setDocuments(prev =>
            prev.map(d =>
              d.type === docType ? { ...d, uploadProgress: progress } : d
            )
          )
        }
      )

      if (response?.status === 'success') {
        toast({ title: 'Success', description: `${requiredDocuments.find(d => d.type === docType)?.label} uploaded successfully` })
        loadDocuments()
      } else {
        throw new Error(response?.message || 'Upload failed')
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Could not upload document',
        variant: 'destructive'
      })
      // Clear preview on error
      setDocuments(prev =>
        prev.map(d =>
          d.type === docType ? { ...d, preview: undefined, uploadProgress: undefined } : d
        )
      )
    } finally {
      setUploadingDocType(null)
    }
  }

  const handleSubmitForApproval = async () => {
    if (!userId) return

    const allSubmitted = documents.every(d => d.status !== 'pending')
    if (!allSubmitted) {
      toast({
        title: 'Incomplete',
        description: 'Please upload all required documents',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      // Check if documents are all submitted
      const checkResponse = await apiService.checkDocumentsSubmission(userId)
      if (checkResponse?.data?.all_submitted) {
        toast({
          title: 'Success',
          description: 'Your documents have been submitted for review. You will be notified once approved.'
        })
        onComplete?.()
      } else {
        throw new Error('Not all documents have been submitted')
      }
    } catch (error) {
      toast({
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'Could not submit documents',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const allApproved = documents.every(d => d.status === 'approved')
  const allSubmitted = documents.every(d => d.status !== 'pending')

  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Show loading state while profile is being loaded
  if (profileLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-4 text-center text-muted-foreground">
            Loading verification documents...
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Trainer Verification Documents
            {registrationPath === 'sponsored' && (
              <Badge variant="outline" className="ml-2">
                Sponsored Path
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Alert */}
          {allApproved && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                All documents have been approved! You can now accept bookings.
              </AlertDescription>
            </Alert>
          )}

          {!allApproved && allSubmitted && (
            <Alert className="bg-blue-50 border-blue-200">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Your documents are being reviewed by our admin team. This usually takes 24-48 hours.
              </AlertDescription>
            </Alert>
          )}

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-semibold">Upload Progress</Label>
              <span className="text-sm text-gray-600">
                {documents.filter(d => d.status !== 'pending').length} of {documents.length}
              </span>
            </div>
            <Progress
              value={(documents.filter(d => d.status !== 'pending').length / documents.length) * 100}
              className="h-2"
            />
          </div>

          {/* Documents List */}
          <div className="space-y-4">
            {documents.map((doc) => (
              <Card key={doc.type} className={`border ${doc.status === 'approved' ? 'border-green-200 bg-green-50' : doc.status === 'rejected' ? 'border-red-200 bg-red-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{doc.label}</h4>
                        <Badge variant={doc.status === 'approved' ? 'default' : doc.status === 'rejected' ? 'destructive' : 'secondary'}>
                          {doc.status === 'pending' ? 'Pending' : doc.status === 'approved' ? 'Approved' : 'Rejected'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{doc.description}</p>
                    </div>
                  </div>

                  {/* Good Conduct Validity */}
                  {doc.type === 'certificate_of_good_conduct' && doc.status === 'pending' && (
                    <Alert className="mb-3 bg-blue-50 border-blue-200">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        Certificate must be valid within 90 days of issuance
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Rejection Reason */}
                  {doc.status === 'rejected' && doc.rejectionReason && (
                    <Alert className="mb-3 bg-red-50 border-red-200">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        {doc.rejectionReason}
                      </AlertDescription>
                    </Alert>
                  )}


                  {/* File Upload - Skip for proof_of_residence (GPS location only) */}
                  {doc.status !== 'approved' && doc.type !== 'proof_of_residence' && (
                    <div className="mb-3 space-y-3">
                      {/* Preview Section */}
                      {doc.preview && (
                        <div className="border rounded-lg p-3 bg-gray-50">
                          {doc.preview.startsWith('data:') ? (
                            <img src={doc.preview} alt="Preview" className="max-w-full max-h-64 rounded object-contain mx-auto" />
                          ) : (
                            <div className="flex items-center justify-center py-4">
                              <span className="text-lg">{doc.preview}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Upload Progress */}
                      {uploadingDocType === doc.type && doc.uploadProgress !== undefined && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Uploading...</span>
                            <span className="text-gray-600 font-medium">{doc.uploadProgress}%</span>
                          </div>
                          <Progress value={doc.uploadProgress} className="h-2" />
                        </div>
                      )}

                      {/* Upload Area */}
                      {!doc.preview || uploadingDocType === doc.type ? (
                        <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition">
                          <div className="flex flex-col items-center gap-2">
                            {uploadingDocType === doc.type ? (
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
                                handleFileUpload(doc.type, file)
                              }
                            }}
                            disabled={uploadingDocType === doc.type}
                          />
                        </label>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setDocuments(prev =>
                                prev.map(d =>
                                  d.type === doc.type ? { ...d, preview: undefined, uploadProgress: undefined } : d
                                )
                              )
                            }}
                            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                          >
                            Change File
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Proof of Residence - GPS Location Info */}
                  {doc.type === 'proof_of_residence' && (
                    <Alert className="mb-3 bg-blue-50 border-blue-200">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        Your GPS location will be captured from your profile location. Make sure to set your location in the trainer profile section.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Uploaded Status */}
                  {doc.fileUrl && (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>File uploaded {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Submit Button */}
          {allSubmitted && !allApproved && (
            <Button
              onClick={handleSubmitForApproval}
              disabled={loading || !allSubmitted}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Documents for Approval'
              )}
            </Button>
          )}

          {allApproved && (
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-800 font-semibold">All documents verified!</p>
              <p className="text-sm text-green-700">You are now approved to start accepting bookings.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
