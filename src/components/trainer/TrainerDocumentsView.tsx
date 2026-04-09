import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import { DocumentPreviewModal } from '@/components/shared/DocumentPreviewModal'

interface Document {
  id: string
  trainer_id: string
  document_type: string
  file_url?: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string
  uploaded_at?: string
  reviewed_at?: string
}

interface TrainerDocumentsViewProps {
  trainerId: string
}

const documentTypeLabels: Record<string, string> = {
  national_id: 'National ID',
  national_id_front: 'National ID - Front',
  national_id_back: 'National ID - Back',
  proof_of_residence: 'Proof of Residence',
  certificate_of_good_conduct: 'Certificate of Good Conduct',
  discipline_certificate: 'Discipline Certificate',
  sponsor_reference: 'Sponsor Reference',
}

export const TrainerDocumentsView: React.FC<TrainerDocumentsViewProps> = ({ trainerId }) => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [trainerId])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const response = await apiService.getVerificationDocuments(trainerId)
      
      // Handle both direct array response and wrapped response
      let docs = Array.isArray(response) ? response : (response?.data && Array.isArray(response.data) ? response.data : [])
      
      setDocuments(docs)
    } catch (error) {
      console.error('Failed to load documents:', error)
      toast({ title: 'Error', description: 'Failed to load your documents', variant: 'destructive' })
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document)
    setPreviewModalOpen(true)
  }

  const getDocumentTypeLabel = (type: string): string => {
    return documentTypeLabels[type] || type.replace(/_/g, ' ')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'border-green-200 bg-green-50'
      case 'rejected':
        return 'border-red-200 bg-red-50'
      case 'pending':
        return 'border-yellow-200 bg-yellow-50'
      default:
        return 'border-border'
    }
  }

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Verification Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading documents...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (documents.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Verification Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              No verification documents have been uploaded yet. Please complete the profile editor to upload your documents.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const approvedCount = documents.filter(d => d.status === 'approved').length
  const pendingCount = documents.filter(d => d.status === 'pending').length
  const rejectedCount = documents.filter(d => d.status === 'rejected').length
  const allApproved = documents.every(d => d.status === 'approved')

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Verification Documents
            </CardTitle>
            {allApproved && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                All Verified
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          {!allApproved && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {approvedCount > 0 && (
                <div className="p-2 bg-green-50 rounded-lg text-center">
                  <div className="text-lg font-semibold text-green-700">{approvedCount}</div>
                  <div className="text-xs text-green-600">Approved</div>
                </div>
              )}
              {pendingCount > 0 && (
                <div className="p-2 bg-yellow-50 rounded-lg text-center">
                  <div className="text-lg font-semibold text-yellow-700">{pendingCount}</div>
                  <div className="text-xs text-yellow-600">Pending</div>
                </div>
              )}
              {rejectedCount > 0 && (
                <div className="p-2 bg-red-50 rounded-lg text-center">
                  <div className="text-lg font-semibold text-red-700">{rejectedCount}</div>
                  <div className="text-xs text-red-600">Rejected</div>
                </div>
              )}
            </div>
          )}

          {/* Document List */}
          <div className="space-y-3">
            {documents.map((document) => (
              <div key={document.id} className={`border rounded-lg p-3 ${getStatusColor(document.status)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-medium text-foreground">
                        {getDocumentTypeLabel(document.document_type)}
                      </h4>
                      <Badge
                        variant={
                          document.status === 'approved'
                            ? 'default'
                            : document.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="text-xs"
                      >
                        {document.status === 'pending'
                          ? 'Pending'
                          : document.status === 'approved'
                            ? 'Approved'
                            : 'Rejected'}
                      </Badge>
                    </div>
                    {document.uploaded_at && (
                      <p className="text-xs text-muted-foreground">
                        Uploaded: {new Date(document.uploaded_at).toLocaleDateString()}
                      </p>
                    )}
                    {document.status === 'rejected' && document.rejection_reason && (
                      <p className="text-xs text-red-700 mt-1">
                        Reason: {document.rejection_reason}
                      </p>
                    )}
                  </div>
                  {document.file_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDocument(document)}
                      className="ml-2"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Status Alert */}
          {allApproved && (
            <Alert className="bg-green-50 border-green-200 mt-4">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                All your verification documents have been approved. You can now accept bookings!
              </AlertDescription>
            </Alert>
          )}

          {!allApproved && pendingCount > 0 && (
            <Alert className="bg-blue-50 border-blue-200 mt-4">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                {pendingCount} document{pendingCount !== 1 ? 's' : ''} {pendingCount === 1 ? 'is' : 'are'} pending review.
                You will be notified once reviewed.
              </AlertDescription>
            </Alert>
          )}

          {rejectedCount > 0 && (
            <Alert className="bg-red-50 border-red-200 mt-4">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {rejectedCount} document{rejectedCount !== 1 ? 's' : ''} {rejectedCount === 1 ? 'was' : 'were'} rejected.
                Please review the rejection reasons and re-upload.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        document={
          selectedDocument
            ? {
                file_url: selectedDocument.file_url,
                document_type: selectedDocument.document_type,
                status: selectedDocument.status,
                rejection_reason: selectedDocument.rejection_reason,
                uploaded_at: selectedDocument.uploaded_at,
              }
            : null
        }
        showTrainerInfo={false}
        getDocumentTypeLabel={getDocumentTypeLabel}
      />
    </>
  )
}
