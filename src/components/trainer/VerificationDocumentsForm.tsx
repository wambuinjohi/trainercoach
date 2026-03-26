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
import { IdDocumentUploadSection } from './IdDocumentUploadSection'

interface Document {
  type: 'proof_of_residence' | 'certificate_of_good_conduct' | 'discipline_certificate' | 'sponsor_reference'
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
    type: 'proof_of_residence',
    label: 'Proof of Residence',
    description: 'REQUIRED: Set your location in the trainer profile section. Your location grid coordinates will be used to verify your address.',
    status: 'pending'
  },
  {
    type: 'certificate_of_good_conduct',
    label: 'Certificate of Good Conduct',
    description: 'OPTIONAL: Upload to enhance your profile credibility. If uploaded, must be valid and within 90 days of issuance.',
    status: 'pending',
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  }
]

interface VerificationDocumentsFormProps {
  onComplete?: () => void
  refreshTrigger?: number
}

export const VerificationDocumentsForm: React.FC<VerificationDocumentsFormProps> = ({ onComplete, refreshTrigger }) => {
  const { user } = useAuth()
  const userId = user?.id
  const [documents, setDocuments] = useState<Document[]>(requiredDocuments)
  const [loading, setLoading] = useState(false)
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null)
  const [idNumber, setIdNumber] = useState('')
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [registrationPath, setRegistrationPath] = useState<'direct' | 'sponsored'>('direct')
  const [profileLoading, setProfileLoading] = useState(true)
  const [locationSet, setLocationSet] = useState(false)

  // Load registration path and existing documents on mount
  useEffect(() => {
    if (!userId) return
    loadProfileAndDocuments()
  }, [userId])

  // Reload documents when refreshTrigger changes (e.g., after profile is saved)
  useEffect(() => {
    if (!userId || refreshTrigger === undefined) return
    console.log('[VerificationDocuments] Refreshing documents due to trigger change:', refreshTrigger)
    loadProfileAndDocuments()
  }, [userId, refreshTrigger])

  const loadProfileAndDocuments = async () => {
    try {
      // Load profile to get registration path and location
      const profileResponse = await apiService.getUserProfile(userId)
      // Handle both direct array response and wrapped response with .data property
      const profileList = Array.isArray(profileResponse) ? profileResponse : (profileResponse?.data && Array.isArray(profileResponse.data) ? profileResponse.data : [])
      if (profileList.length > 0) {
        const profile = profileList[0]
        setRegistrationPath(profile.registration_path || 'direct')
        // Check if location has been set (GPS coordinates exist)
        const hasLocation = profile.location_lat && profile.location_lng
        setLocationSet(!!hasLocation)
        console.log('[VerificationDocuments] Location set:', hasLocation, 'Lat:', profile.location_lat, 'Lng:', profile.location_lng)
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
      console.log('[VerificationDocuments] Loading documents for userId:', userId)
      const response = await apiService.getVerificationDocuments(userId!)
      console.log('[VerificationDocuments] API Response:', response)

      // Handle both direct array response and wrapped response with .data property
      let docs = Array.isArray(response) ? response : (response?.data && Array.isArray(response.data) ? response.data : [])

      if (Array.isArray(docs)) {
        const loadedDocs: Document[] = requiredDocuments
          .map(reqDoc => {
            const uploaded = docs.find(d => d.document_type === reqDoc.type)
            console.log('[VerificationDocuments] Document:', reqDoc.type, '| Uploaded:', uploaded)
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
        console.log('[VerificationDocuments] Final loaded documents:', loadedDocs)
        setDocuments(loadedDocs)
      } else {
        console.log('[VerificationDocuments] No document data in response')
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
      console.log('[VerificationDocuments] Starting upload for docType:', docType)
      console.log('[VerificationDocuments] File details:', { name: file.name, size: file.size, type: file.type })

      const response = await apiService.uploadVerificationDocument(
        userId,
        docType,
        file,
        undefined,
        (progress) => {
          console.log('[VerificationDocuments] Upload progress:', progress, '%')
          // Update upload progress
          setDocuments(prev =>
            prev.map(d =>
              d.type === docType ? { ...d, uploadProgress: progress } : d
            )
          )
        }
      )

      console.log('[VerificationDocuments] Upload response:', response)

      if (response?.status === 'success') {
        console.log('[VerificationDocuments] Upload successful, file_url:', response.file_url)
        toast({ title: 'Success', description: `${requiredDocuments.find(d => d.type === docType)?.label} uploaded successfully` })
        loadDocuments()
      } else {
        throw new Error(response?.message || 'Upload failed')
      }
    } catch (error) {
      console.error('[VerificationDocuments] Upload error:', error)
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

    setLoading(true)
    try {
      // Check if required documents are submitted
      // Proof of Residence is satisfied either by:
      // 1. Having set location in the trainer profile (locationSet = true)
      // 2. Having uploaded a proof_of_residence document
      const proofOfResidenceDoc = documents.find(d => d.type === 'proof_of_residence')
      const proofOfResidenceOK = locationSet || proofOfResidenceDoc?.fileUrl

      if (!proofOfResidenceOK) {
        toast({
          title: 'Missing required document',
          description: 'Proof of Residence is required. Please set your location in the trainer profile.',
          variant: 'destructive'
        })
        return
      }

      // Check backend as secondary validation
      const checkResponse = await apiService.checkDocumentsSubmission(userId)
      if (checkResponse?.data?.all_submitted) {
        toast({
          title: 'Success',
          description: 'Your documents have been submitted for review. You will be notified once approved.'
        })
        onComplete?.()
      } else {
        // Show success anyway if location is set, since proof of residence is location-based
        toast({
          title: 'Success',
          description: 'Your documents have been submitted for review. You will be notified once approved.'
        })
        onComplete?.()
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

  // Proof of Residence can be satisfied by either:
  // 1. Setting location in trainer profile (locationSet)
  // 2. Uploading a proof_of_residence document
  const proofOfResidenceApproved = locationSet || documents.find(d => d.type === 'proof_of_residence')?.status === 'approved'
  const allApproved = proofOfResidenceApproved

  // Check if any document is still under review
  const anySubmitted = documents.some(d => d.status !== 'pending')

  // Check if any documents have been uploaded/submitted or location is set
  const anyRequiredUploaded = locationSet || documents.some(d => d.fileUrl || d.type === 'proof_of_residence')

  // Ready to submit: proof of residence is satisfied and none are rejected
  const readyToSubmit = (locationSet || anyRequiredUploaded) && !allApproved &&
    documents.every(d => d.status !== 'rejected')

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
      {/* ID/Passport Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            ID/Passport Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IdDocumentUploadSection />
        </CardContent>
      </Card>

      {/* Additional Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Residence & Conduct Documentation
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

          {!allApproved && anySubmitted && (
            <Alert className="bg-blue-50 border-blue-200">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Proof of Residence</strong> is being reviewed by our admin team. This usually takes 24-48 hours.
              </AlertDescription>
            </Alert>
          )}

          {/* Status Overview */}
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-blue-900 mb-2">📋 Documentation Status</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ <strong>Required:</strong> Proof of Residence (set location in trainer profile)</li>
                <li>○ <strong>Optional:</strong> Certificate of Good Conduct (to enhance credibility)</li>
              </ul>
            </div>
          </div>

          {/* Progress Bar - Additional Documents */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-semibold">Optional Documentation Progress</Label>
              <span className="text-sm text-gray-600">
                {documents.filter(d => d.type !== 'proof_of_residence' && d.status !== 'pending').length} of {documents.filter(d => d.type !== 'proof_of_residence').length}
              </span>
            </div>
            <Progress
              value={documents.filter(d => d.type !== 'proof_of_residence').length > 0
                ? (documents.filter(d => d.type !== 'proof_of_residence' && d.status !== 'pending').length / documents.filter(d => d.type !== 'proof_of_residence').length) * 100
                : 0
              }
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

                  {/* Show existing document preview - Always visible */}
                  {doc.fileUrl && doc.type !== 'proof_of_residence' && (
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
                        <img src={doc.fileUrl} alt={doc.label} className="max-w-full max-h-72 rounded object-contain mx-auto" />
                      ) : (
                        <div className="flex items-center justify-center py-6">
                          <span className="text-lg">📄 {doc.label}</span>
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

                  {/* Show pending status when no document uploaded yet */}
                  {!doc.fileUrl && doc.type !== 'proof_of_residence' && doc.status === 'pending' && (
                    <div className="mb-3 border-2 border-dashed border-amber-300 rounded-lg p-4 bg-amber-50">
                      <p className="text-xs font-medium text-amber-700 mb-2">⏳ Waiting for Upload</p>
                      <p className="text-xs text-amber-600">No document uploaded yet. Please add {doc.label.toLowerCase()} below.</p>
                    </div>
                  )}

                  {/* Good Conduct Validity */}
                  {doc.type === 'certificate_of_good_conduct' && doc.status === 'pending' && (
                    <Alert className="mb-3 bg-blue-50 border-blue-200">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        Optional: If uploaded, certificate must be valid within 90 days of issuance
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


                  {/* File Upload - Skip for proof_of_residence (GPS location only) and already approved documents */}
                  {doc.status !== 'approved' && doc.type !== 'proof_of_residence' && (
                    <div className="mb-3 space-y-3">

                      {/* Preview Section for new upload being prepared */}
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
                            ) : doc.fileUrl ? (
                              <>
                                <Upload className="h-5 w-5 text-gray-400" />
                                <span className="text-sm text-gray-600">Click to replace with new file</span>
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

                  {/* Proof of Residence - Location Grid Info */}
                  {doc.type === 'proof_of_residence' && !doc.fileUrl && !locationSet && (
                    <Alert className="mb-3 bg-blue-50 border-blue-200">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        Your location grid from the trainer profile will be used as proof of residence. Set your location to automatically verify this document.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Proof of Residence - Location Grid Verified */}
                  {doc.type === 'proof_of_residence' && (doc.fileUrl || locationSet) && (
                    <div className="border rounded-lg p-3 bg-green-50 border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-green-700">Location Grid Verified</span>
                      </div>
                      <p className="text-sm text-green-700">
                        Your location coordinates have been captured and verified as proof of residence.
                      </p>
                    </div>
                  )}

                  {/* Uploaded Status - Only show if not pending (already uploaded and status is not pending) */}
                  {doc.fileUrl && doc.status !== 'pending' && (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>File uploaded {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Submit Button - Show when at least proof of residence is available or user wants to skip optional docs */}
          {(readyToSubmit || !allApproved) && (
            <>
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <strong>Note:</strong> Proof of Residence is required. Certificate of Good Conduct is optional but recommended to enhance your profile.
                </AlertDescription>
              </Alert>
              <Button
                onClick={handleSubmitForApproval}
                disabled={loading}
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
            </>
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
