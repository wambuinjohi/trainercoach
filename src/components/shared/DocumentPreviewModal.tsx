import React from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, FileText } from 'lucide-react'

interface DocumentPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: {
    file_url?: string
    document_type?: string
    full_name?: string
    trainer_id?: string
    uploaded_at?: string
    status?: 'pending' | 'approved' | 'rejected'
    rejection_reason?: string
  } | null
  title?: string
  showTrainerInfo?: boolean
  getDocumentTypeLabel?: (type: string) => string
}

const defaultGetDocumentTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    national_id: 'National ID',
    national_id_front: 'National ID - Front',
    national_id_back: 'National ID - Back',
    proof_of_residence: 'Proof of Residence',
    certificate_of_good_conduct: 'Certificate of Good Conduct',
    discipline_certificate: 'Discipline Certificate',
    sponsor_reference: 'Sponsor Reference',
  }
  return labels[type] || type.replace(/_/g, ' ')
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  open,
  onOpenChange,
  document,
  title,
  showTrainerInfo = true,
  getDocumentTypeLabel = defaultGetDocumentTypeLabel,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-full rounded-none sm:rounded-lg max-w-full sm:max-w-2xl max-h-[100vh] sm:max-h-[90vh] overflow-y-auto p-3 sm:p-6">
        <AlertDialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
          <AlertDialogTitle className="text-lg sm:text-xl">
            {title || (document?.document_type ? getDocumentTypeLabel(document.document_type) : 'Document Preview')}
          </AlertDialogTitle>
          {document?.status && (
            <Badge
              className="mt-2 w-fit"
              variant={
                document.status === 'approved'
                  ? 'default'
                  : document.status === 'rejected'
                    ? 'destructive'
                    : 'secondary'
              }
            >
              {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
            </Badge>
          )}
        </AlertDialogHeader>

        {document && (
          <div className="space-y-4">
            {/* Trainer Info */}
            {showTrainerInfo && (document?.full_name || document?.trainer_id) && (
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">Trainer Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {document.full_name && (
                    <div>
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="text-xs sm:text-sm font-medium break-words">{document.full_name}</p>
                    </div>
                  )}
                  {document.trainer_id && (
                    <div>
                      <p className="text-xs text-muted-foreground">ID</p>
                      <p className="text-xs sm:text-sm font-medium break-words">{document.trainer_id}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Document Preview */}
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">Document</p>
              {document.file_url ? (
                document.file_url.endsWith('.pdf') ? (
                  <iframe
                    src={document.file_url}
                    className="w-full h-48 sm:h-96 border rounded-lg"
                    title="PDF Document"
                  />
                ) : (
                  <img
                    src={document.file_url}
                    alt={
                      document.document_type
                        ? getDocumentTypeLabel(document.document_type)
                        : 'Document'
                    }
                    className="w-full h-auto max-h-48 sm:max-h-96 object-contain border rounded-lg"
                  />
                )
              ) : (
                <div className="border rounded-lg p-4 sm:p-6 text-center text-muted-foreground bg-muted">
                  <FileText className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs sm:text-sm">No document file available</p>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {document.uploaded_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Uploaded</p>
                  <p className="text-xs sm:text-sm break-words">{new Date(document.uploaded_at).toLocaleString()}</p>
                </div>
              )}
              {document.status && (
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
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
                    {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
                  </Badge>
                </div>
              )}
            </div>

            {/* Rejection Reason */}
            {document.status === 'rejected' && document.rejection_reason && (
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <AlertDescription className="text-red-800 text-xs sm:text-sm">
                  <p className="font-medium mb-1">Rejection Reason:</p>
                  <p className="break-words">{document.rejection_reason}</p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <AlertDialogFooter className="mt-4 pt-4 border-t sticky bottom-0 bg-background z-10">
          <AlertDialogCancel className="w-full sm:w-auto">Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
