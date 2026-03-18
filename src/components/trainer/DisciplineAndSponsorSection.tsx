import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Search, Check, X, Loader2, Upload } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'

interface DisciplineAndSponsorSectionProps {
  onDisciplineCertificateStatusChange?: (hasApprovedCertificate: boolean) => void
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
  disciplines?: string[] | string
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
  registrationPath = 'direct',
  currentSponsorId,
  currentSponsorName,
  onSponsorSelected,
  onSponsorRemoved
}) => {
  const { user } = useAuth()
  const userId = user?.id
  
  // Discipline Certificate State
  const [certificateStatus, setCertificateStatus] = useState<CertificateStatus>({
    status: 'pending'
  })
  const [uploadingCertificate, setUploadingCertificate] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [preview, setPreview] = useState<string | undefined>()
  const [certificateLoading, setCertificateLoading] = useState(true)

  // Sponsor State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Trainer[]>([])
  const [sponsorLoading, setSponsorLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedSponsor, setSelectedSponsor] = useState<Trainer | null>(null)

  // Load discipline certificate status
  useEffect(() => {
    if (!userId) return
    loadCertificateStatus()
  }, [userId])

  // Load sponsor if already selected
  useEffect(() => {
    if (currentSponsorId && currentSponsorName) {
      setSelectedSponsor({
        user_id: currentSponsorId,
        full_name: currentSponsorName,
        email: '',
      })
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
        onDisciplineCertificateStatusChange?.(disciplineDoc.status === 'approved')
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

  const searchSponsors = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Empty search',
        description: 'Please enter a trainer name, email, or phone number',
        variant: 'destructive',
      })
      return
    }

    setSponsorLoading(true)
    setHasSearched(true)
    try {
      const response = await apiService.getUsers()
      const users = Array.isArray(response) ? response : response?.data || []

      const filteredTrainers = users.filter((u: any) => {
        // Only show approved trainers
        if (!u.is_approved || u.user_type !== 'trainer') return false

        const query = searchQuery.toLowerCase()
        const fullName = (u.full_name || '').toLowerCase()
        const email = (u.email || '').toLowerCase()
        const phone = (u.phone_number || '').toLowerCase()

        return fullName.includes(query) || email.includes(query) || phone.includes(query)
      })

      setSearchResults(filteredTrainers.slice(0, 10))
    } catch (error) {
      console.error('Failed to search sponsors:', error)
      toast({
        title: 'Search failed',
        description: 'Could not search for trainers. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSponsorLoading(false)
    }
  }

  const handleSelectSponsor = (trainer: Trainer) => {
    setSelectedSponsor(trainer)
    onSponsorSelected?.(trainer.user_id, trainer.full_name || trainer.email)
    setSearchQuery('')
    setSearchResults([])
    toast({
      title: 'Success',
      description: `${trainer.full_name || trainer.email} selected as your sponsor.`,
    })
  }

  const handleRemoveSponsor = () => {
    setSelectedSponsor(null)
    onSponsorRemoved?.()
    toast({
      title: 'Sponsor removed',
      description: 'Your sponsor reference has been cleared.',
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchSponsors()
    }
  }

  const hasDisciplineCertificate = certificateStatus.status === 'approved'
  const shouldShowSponsorRequired = !hasDisciplineCertificate

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
        <CardTitle className="text-lg">Discipline & Sponsorship</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Either upload a discipline certificate or select a sponsor trainer
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info Alert */}
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            {shouldShowSponsorRequired 
              ? 'You don\'t have an approved discipline certificate. You must select a sponsor trainer to proceed.'
              : 'You have an approved discipline certificate. Sponsor selection is optional.'}
          </AlertDescription>
        </Alert>

        {/* DISCIPLINE CERTIFICATE SECTION */}
        <div className="space-y-4 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Discipline Certificate</h4>
            {hasDisciplineCertificate && (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                <Check className="h-3 w-3 mr-1" />
                Approved
              </Badge>
            )}
          </div>

          {/* Show existing certificate status */}
          {certificateStatus.fileUrl && (
            <div className={`border-2 rounded-lg p-4 ${
              certificateStatus.status === 'approved'
                ? 'border-green-200 bg-green-50'
                : certificateStatus.status === 'rejected'
                ? 'border-red-200 bg-red-50'
                : 'border-blue-200 bg-blue-50'
            }`}>
              <p className={`text-xs font-medium mb-3 ${
                certificateStatus.status === 'approved'
                  ? 'text-green-700'
                  : certificateStatus.status === 'rejected'
                  ? 'text-red-700'
                  : 'text-blue-700'
              }`}>
                📄 {certificateStatus.status === 'approved' ? 'Approved Certificate' : certificateStatus.status === 'rejected' ? 'Certificate (Rejected)' : 'Current Certificate'}
              </p>
              {certificateStatus.fileUrl.startsWith('http') ? (
                <img src={certificateStatus.fileUrl} alt="Certificate" className="max-w-full max-h-72 rounded object-contain mx-auto" />
              ) : (
                <div className="flex items-center justify-center py-6">
                  <span className="text-lg">📄 Discipline Certificate</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Check className={`h-4 w-4 ${
                  certificateStatus.status === 'approved'
                    ? 'text-green-600'
                    : certificateStatus.status === 'rejected'
                    ? 'text-red-600'
                    : 'text-blue-600'
                }`} />
                <p className={`text-xs ${
                  certificateStatus.status === 'approved'
                    ? 'text-green-600'
                    : certificateStatus.status === 'rejected'
                    ? 'text-red-600'
                    : 'text-blue-600'
                }`}>
                  {certificateStatus.status === 'pending' ? 'Awaiting review' : certificateStatus.status === 'approved' ? 'Approved' : 'Rejected'} - {certificateStatus.uploadedAt ? new Date(certificateStatus.uploadedAt).toLocaleDateString() : 'Recently'}
                </p>
              </div>
            </div>
          )}

          {/* Rejection reason */}
          {certificateStatus.status === 'rejected' && certificateStatus.rejectionReason && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {certificateStatus.rejectionReason}
              </AlertDescription>
            </Alert>
          )}

          {/* Show pending status when no certificate */}
          {!certificateStatus.fileUrl && certificateStatus.status === 'pending' && (
            <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 bg-amber-50">
              <p className="text-xs font-medium text-amber-700 mb-2">⏳ Not Yet Uploaded</p>
              <p className="text-xs text-amber-600">No discipline certificate uploaded yet.</p>
            </div>
          )}

          {/* Upload area - only show if not approved */}
          {certificateStatus.status !== 'approved' && (
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

        {/* SPONSOR SECTION */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">
              Sponsor Trainer
              {shouldShowSponsorRequired && <span className="text-red-600 ml-1">*</span>}
            </h4>
            {selectedSponsor && (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                <Check className="h-3 w-3 mr-1" />
                Selected
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            A sponsor is a registered and approved trainer who will vouch for your credentials.
          </p>

          {selectedSponsor && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/20 dark:border-green-900">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-200">
                      {selectedSponsor.full_name || selectedSponsor.email}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {selectedSponsor.email}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveSponsor}
                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {!selectedSponsor && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="sponsor-search" className="text-sm font-medium">
                  Search for a Sponsor
                </Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="sponsor-search"
                    placeholder="Enter trainer name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sponsorLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={searchSponsors}
                    disabled={sponsorLoading || !searchQuery.trim()}
                    variant="outline"
                    size="sm"
                    className="px-3"
                  >
                    {sponsorLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {hasSearched && (
                <div className="space-y-2">
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-center text-muted-foreground text-sm">
                      {sponsorLoading ? 'Searching...' : 'No trainers found. Try a different search.'}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {searchResults.map((trainer) => (
                        <div
                          key={trainer.user_id}
                          className="p-3 border border-border rounded-lg hover:bg-muted dark:hover:bg-slate-900 cursor-pointer transition"
                          onClick={() => handleSelectSponsor(trainer)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-foreground">
                                {trainer.full_name || trainer.email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {trainer.email}
                              </p>
                              {trainer.phone_number && (
                                <p className="text-xs text-muted-foreground">
                                  {trainer.phone_number}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="ml-2">
                              Verified
                            </Badge>
                          </div>

                          {trainer.hourly_rate && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Rate: KES {trainer.hourly_rate}/hour
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                Only approved trainers can be selected as sponsors.
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
