import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Check, X, Loader2, Upload } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'

interface DisciplineAndSponsorSectionProps {
  onDisciplineCertificateStatusChange?: (hasApprovedCertificate: boolean) => void
  onRegistrationPathChange?: (path: 'direct' | 'sponsored') => void
  registrationPath?: 'direct' | 'sponsored'
  currentSponsorId?: string | null
  currentSponsorName?: string | null
  onSponsorSelected?: (sponsorId: string, sponsorName: string) => void
  onSponsorRemoved?: () => void
}

interface Trainer {
  user_id: string
  full_name: string
  email: string
  phone_number?: string
  hourly_rate?: number
  is_approved?: boolean
}

interface CertificateStatus {
  status: 'pending' | 'approved' | 'rejected'
  fileUrl?: string
  uploadedAt?: string
  rejectionReason?: string
}

export const DisciplineAndSponsorSection: React.FC<DisciplineAndSponsorSectionProps> = ({
  onDisciplineCertificateStatusChange,
  onRegistrationPathChange,
  registrationPath = 'direct',
  currentSponsorId,
  currentSponsorName,
  onSponsorSelected,
  onSponsorRemoved
}) => {
  const { user } = useAuth()
  const userId = user?.id

  // Registration path state (local control for toggle)
  const [localRegistrationPath, setLocalRegistrationPath] = useState<'direct' | 'sponsored'>(registrationPath)

  // Discipline Certificate State
  const [certificateStatus, setCertificateStatus] = useState<CertificateStatus>({
    status: 'pending'
  })
  const [uploadingCertificate, setUploadingCertificate] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [preview, setPreview] = useState<string | undefined>()
  const [certificateLoading, setCertificateLoading] = useState(true)

  // Sponsor National ID State
  const [sponsorNationalId, setSponsorNationalId] = useState('')
  const [validatingSponsorId, setValidatingSponsorId] = useState(false)
  const [sponsorValidationError, setSponsorValidationError] = useState<string | null>(null)
  const [sponsorValidationSuccess, setSponsorValidationSuccess] = useState(false)
  const [validatedSponsor, setValidatedSponsor] = useState<Trainer | null>(null)

  // Load discipline certificate status
  useEffect(() => {
    if (!userId) return
    loadCertificateStatus()
  }, [userId])

  // Load validated sponsor if already selected
  useEffect(() => {
    if (currentSponsorId && currentSponsorName) {
      setValidatedSponsor({
        user_id: currentSponsorId,
        full_name: currentSponsorName,
        email: '',
      })
      setSponsorValidationSuccess(true)
    }
  }, [currentSponsorId, currentSponsorName])

  const loadCertificateStatus = async () => {
    try {
      setCertificateLoading(true)
      const response = await apiService.getVerificationDocuments(userId!)

      // Handle both direct array response and wrapped response with .data property
      let docs = Array.isArray(response) ? response : (response?.data && Array.isArray(response.data) ? response.data : [])

      const disciplineDoc = docs.find(d => d.document_type === 'discipline_certificate')
      if (disciplineDoc) {
        setCertificateStatus({
          status: disciplineDoc.status || 'pending',
          fileUrl: disciplineDoc.file_url,
          uploadedAt: disciplineDoc.uploaded_at,
          rejectionReason: disciplineDoc.rejection_reason
        })
        // Accept both 'pending' (awaiting review) and 'approved' certificates
        // Only reject if status is explicitly 'rejected'
        const hasCertificate = disciplineDoc.status !== 'rejected' && !!disciplineDoc.file_url
        onDisciplineCertificateStatusChange?.(hasCertificate)
      } else {
        setCertificateStatus({ status: 'pending' })
        onDisciplineCertificateStatusChange?.(false)
      }
    } catch (error) {
      console.warn('Failed to load certificate status:', error)
      setCertificateStatus({ status: 'pending' })
      onDisciplineCertificateStatusChange?.(false)
    } finally {
      setCertificateLoading(false)
    }
  }

  const handleFileSelect = async (docType: string, file: File) => {
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
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      // For PDFs, show file name as preview
      setPreview(`📄 ${file.name}`)
    }

    setUploadingCertificate(true)
    setUploadProgress(0)

    try {
      const response = await apiService.uploadVerificationDocument(
        userId,
        docType,
        file,
        undefined,
        (progress) => {
          setUploadProgress(progress)
        }
      )

      if (response?.status === 'success') {
        toast({ title: 'Success', description: 'Discipline certificate uploaded successfully' })
        setPreview(undefined)
        loadCertificateStatus()
      } else {
        throw new Error(response?.message || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Could not upload certificate',
        variant: 'destructive'
      })
      setPreview(undefined)
    } finally {
      setUploadingCertificate(false)
      setUploadProgress(0)
    }
  }

  const handleRegistrationPathChange = (newPath: 'direct' | 'sponsored') => {
    setLocalRegistrationPath(newPath)
    onRegistrationPathChange?.(newPath)

    // Clear validation errors and data when switching paths
    if (newPath === 'direct') {
      setSponsorNationalId('')
      setSponsorValidationError(null)
      setSponsorValidationSuccess(false)
      setValidatedSponsor(null)
    } else {
      setPreview(undefined)
      setSponsorValidationError(null)
    }
  }

  const validateAndSelectSponsorByNationalId = async () => {
    if (!sponsorNationalId.trim()) {
      setSponsorValidationError('Please enter a Sponsor ID')
      return
    }

    setValidatingSponsorId(true)
    setSponsorValidationError(null)
    setSponsorValidationSuccess(false)

    try {
      // Try to fetch the trainer profile by user_id
      const response = await apiService.getUserProfile(sponsorNationalId.trim())
      const profileList = Array.isArray(response) ? response : (response?.data && Array.isArray(response.data) ? response.data : [])

      if (profileList.length === 0) {
        setSponsorValidationError('Sponsor ID not found. Please check and try again.')
        return
      }

      const sponsorProfile = profileList[0]

      // Verify the user is a trainer and is approved
      if (sponsorProfile.user_type !== 'trainer') {
        setSponsorValidationError('This ID does not belong to a trainer.')
        return
      }

      if (!sponsorProfile.is_approved) {
        setSponsorValidationError('This trainer has not been approved yet. Please select an approved trainer.')
        return
      }

      // Valid sponsor found
      const sponsorName = sponsorProfile.full_name || sponsorProfile.email || sponsorProfile.user_id
      setValidatedSponsor({
        user_id: sponsorProfile.user_id,
        full_name: sponsorName,
        email: sponsorProfile.email,
      })
      setSponsorValidationSuccess(true)
      onSponsorSelected?.(sponsorProfile.user_id, sponsorName)
      toast({
        title: 'Success',
        description: `${sponsorName} validated and selected as your sponsor.`,
      })
    } catch (error) {
      console.error('Failed to validate sponsor ID:', error)
      setSponsorValidationError('Could not validate sponsor ID. Please try again.')
    } finally {
      setValidatingSponsorId(false)
    }
  }

  const handleRemoveSponsorNationalId = () => {
    setSponsorNationalId('')
    setSponsorValidationError(null)
    setSponsorValidationSuccess(false)
    setValidatedSponsor(null)
    onSponsorRemoved?.()
    toast({
      title: 'Sponsor removed',
      description: 'Your sponsor reference has been cleared.',
    })
  }

  // Accept both pending (awaiting review) and approved certificates
  // Only reject if status is explicitly 'rejected' or no certificate uploaded
  const hasDisciplineCertificate = certificateStatus.fileUrl && certificateStatus.status !== 'rejected'

  if (certificateLoading) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Registration Type</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Choose how you want to register
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Registration Path Toggle */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <div
              className={`flex-1 flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                localRegistrationPath === 'direct'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-border hover:bg-muted/50'
              }`}
              onClick={() => handleRegistrationPathChange('direct')}
            >
              <input
                type="radio"
                name="registration-type"
                value="direct"
                checked={localRegistrationPath === 'direct'}
                onChange={() => handleRegistrationPathChange('direct')}
                className="cursor-pointer flex-shrink-0"
              />
              <div className="flex-1">
                <p className="font-medium text-sm text-foreground">Direct Registration</p>
                <p className="text-xs text-muted-foreground">Upload discipline certificate independently</p>
              </div>
            </div>

            <div
              className={`flex-1 flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                localRegistrationPath === 'sponsored'
                  ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                  : 'border-border hover:bg-muted/50'
              }`}
              onClick={() => handleRegistrationPathChange('sponsored')}
            >
              <input
                type="radio"
                name="registration-type"
                value="sponsored"
                checked={localRegistrationPath === 'sponsored'}
                onChange={() => handleRegistrationPathChange('sponsored')}
                className="cursor-pointer flex-shrink-0"
              />
              <div className="flex-1">
                <p className="font-medium text-sm text-foreground">Under Sponsor</p>
                <p className="text-xs text-muted-foreground">Register with a sponsor trainer</p>
              </div>
            </div>
          </div>
        </div>

        {/* DIRECT REGISTRATION: DISCIPLINE CERTIFICATE */}
        {localRegistrationPath === 'direct' && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div>
              <h3 className="font-medium text-sm mb-3">Discipline Certificate</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Upload your discipline certificate to verify your professional credentials as an independent trainer.
              </p>

              {/* Info Alert */}
              <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 mb-4">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs">
                  A valid discipline certificate is required for direct registration.
                </AlertDescription>
              </Alert>

              {/* Show existing certificate status */}
              {certificateStatus.fileUrl && (
                <div
                  className={`border-2 rounded-lg p-4 mb-4 ${
                    certificateStatus.status === 'approved'
                      ? 'border-green-200 bg-green-50'
                      : certificateStatus.status === 'rejected'
                      ? 'border-red-200 bg-red-50'
                      : 'border-blue-200 bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p
                      className={`text-xs font-medium ${
                        certificateStatus.status === 'approved'
                          ? 'text-green-700'
                          : certificateStatus.status === 'rejected'
                          ? 'text-red-700'
                          : 'text-blue-700'
                      }`}
                    >
                      📄{' '}
                      {certificateStatus.status === 'approved'
                        ? 'Approved Certificate'
                        : certificateStatus.status === 'rejected'
                        ? 'Certificate (Rejected)'
                        : 'Current Certificate'}
                    </p>
                    {certificateStatus.status !== 'rejected' && (
                      <Badge
                        className={`${
                          certificateStatus.status === 'approved'
                            ? 'bg-green-100 text-green-800 hover:bg-green-100'
                            : 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                        }`}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        {certificateStatus.status === 'approved' ? 'Approved' : 'Pending Review'}
                      </Badge>
                    )}
                  </div>
                  {certificateStatus.fileUrl.startsWith('http') ? (
                    <img src={certificateStatus.fileUrl} alt="Certificate" className="max-w-full max-h-72 rounded object-contain mx-auto" />
                  ) : (
                    <div className="flex items-center justify-center py-6">
                      <span className="text-lg">📄 Discipline Certificate</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <Check
                      className={`h-4 w-4 ${
                        certificateStatus.status === 'approved'
                          ? 'text-green-600'
                          : certificateStatus.status === 'rejected'
                          ? 'text-red-600'
                          : 'text-blue-600'
                      }`}
                    />
                    <p
                      className={`text-xs ${
                        certificateStatus.status === 'approved'
                          ? 'text-green-600'
                          : certificateStatus.status === 'rejected'
                          ? 'text-red-600'
                          : 'text-blue-600'
                      }`}
                    >
                      {certificateStatus.status === 'pending'
                        ? 'Awaiting review'
                        : certificateStatus.status === 'approved'
                        ? 'Approved'
                        : 'Rejected'}{' '}
                      - {certificateStatus.uploadedAt ? new Date(certificateStatus.uploadedAt).toLocaleDateString() : 'Recently'}
                    </p>
                  </div>
                </div>
              )}

              {/* Rejection reason */}
              {certificateStatus.status === 'rejected' && certificateStatus.rejectionReason && (
                <Alert className="bg-red-50 border-red-200 mb-4">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{certificateStatus.rejectionReason}</AlertDescription>
                </Alert>
              )}

              {/* Show pending status when no certificate */}
              {!certificateStatus.fileUrl && certificateStatus.status === 'pending' && (
                <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 bg-amber-50 mb-4">
                  <p className="text-xs font-medium text-amber-700 mb-2">⏳ Not Yet Uploaded</p>
                  <p className="text-xs text-amber-600">No discipline certificate uploaded yet.</p>
                </div>
              )}

              {/* Upload area - only show if rejected or missing */}
              {(!certificateStatus.fileUrl || certificateStatus.status === 'rejected') && (
                <div className="space-y-3">
                  {/* Preview Section */}
                  {preview && (
                    <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                      <p className="text-xs font-medium text-green-700 mb-3">Preview - Ready to Upload</p>
                      {preview.startsWith('data:') ? (
                        <img src={preview} alt="Preview" className="max-w-full max-h-72 rounded object-contain mx-auto" />
                      ) : (
                        <div className="flex items-center justify-center py-6">
                          <span className="text-lg">{preview}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload Progress */}
                  {uploadingCertificate && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Uploading...</span>
                        <span className="text-gray-600 font-medium">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Upload Area */}
                  {!preview || uploadingCertificate ? (
                    <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition">
                      <div className="flex flex-col items-center gap-2">
                        {uploadingCertificate ? (
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
                            handleFileSelect('discipline_certificate', file)
                          }
                        }}
                        disabled={uploadingCertificate}
                      />
                    </label>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setPreview(undefined)
                        }}
                        className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                      >
                        Change File
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SPONSORED REGISTRATION: SPONSOR NATIONAL ID */}
        {localRegistrationPath === 'sponsored' && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div>
              <h3 className="font-medium text-sm mb-3">Sponsor Information</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Enter the Sponsor trainer's ID for validation. Your sponsor must be an approved trainer.
              </p>

              {/* Info Alert */}
              <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 mb-4">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs">
                  A sponsor is a registered and approved trainer who will vouch for your credentials.
                </AlertDescription>
              </Alert>

              {/* Validated Sponsor Display */}
              {validatedSponsor && sponsorValidationSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/20 dark:border-green-900 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-200 text-sm">
                          {validatedSponsor.full_name || validatedSponsor.email}
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300">
                          {validatedSponsor.email}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveSponsorNationalId}
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Sponsor ID Input (show only if not yet validated) */}
              {!validatedSponsor || !sponsorValidationSuccess && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="sponsor-national-id" className="text-sm font-medium">
                      Sponsor ID <span className="text-red-600">*</span>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      Enter the Sponsor trainer's user ID
                    </p>
                    <div className="flex gap-2">
                      <Input
                        id="sponsor-national-id"
                        placeholder="Enter sponsor ID..."
                        value={sponsorNationalId}
                        onChange={(e) => {
                          setSponsorNationalId(e.target.value)
                          setSponsorValidationError(null)
                        }}
                        disabled={validatingSponsorId}
                        className="flex-1"
                      />
                      <Button
                        onClick={validateAndSelectSponsorByNationalId}
                        disabled={validatingSponsorId || !sponsorNationalId.trim()}
                        variant="outline"
                        size="sm"
                        className="px-3 flex-shrink-0"
                      >
                        {validatingSponsorId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {sponsorValidationError && (
                    <Alert className="bg-red-50 border-red-200">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800 text-xs">{sponsorValidationError}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <div className="text-xs text-muted-foreground p-2 bg-muted rounded mt-3">
                Only approved trainers can be sponsors. Your sponsor ID will be validated against our database.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
