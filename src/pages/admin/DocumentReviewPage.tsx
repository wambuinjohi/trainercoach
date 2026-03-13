import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Eye, CheckCircle, XCircle, FileText, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Document {
  id: string
  trainer_id: string
  document_type: string
  file_url: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string
  uploaded_at: string
  reviewed_at?: string
  reviewed_by?: string
  full_name?: string
  user_type?: string
}

export default function DocumentReviewPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedTab, setSelectedTab] = useState('pending')
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [viewModal, setViewModal] = useState<{
    open: boolean
    document: Document | null
  }>({
    open: false,
    document: null,
  })
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    title: string
    description: string
    action: 'approve' | 'reject' | null
    document: Document | null
  }>({
    open: false,
    title: '',
    description: '',
    action: null,
    document: null,
  })

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('adminToken')
      const response = await apiService.listVerificationDocuments(undefined, token)

      console.log('Document review response:', response)

      // Handle various response formats
      let docs: Document[] = []
      if (Array.isArray(response)) {
        docs = response
      } else if (response?.data && Array.isArray(response.data)) {
        docs = response.data
      } else if (response && typeof response === 'object' && !Array.isArray(response)) {
        // If response is an object but not an array, it might be a single document wrapped in an object
        docs = []
      }

      setDocuments(docs)
    } catch (error) {
      console.error('Failed to load documents:', error)
      toast({ title: 'Error', description: 'Failed to load verification documents', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleApproveClick = (document: Document) => {
    setConfirmModal({
      open: true,
      title: 'Approve Document',
      description: `Approve ${document.document_type.replace(/_/g, ' ')} from ${document.full_name || document.trainer_id}?`,
      action: 'approve',
      document,
    })
  }

  const handleRejectClick = (document: Document) => {
    setSelectedDocument(document)
    setRejectionReason('')
    setConfirmModal({
      open: true,
      title: 'Reject Document',
      description: `Please provide a reason for rejecting this ${document.document_type.replace(/_/g, ' ')}.`,
      action: 'reject',
      document,
    })
  }

  const approveDocument = async (document: Document) => {
    try {
      setActionLoading(true)
      const token = localStorage.getItem('adminToken')
      await apiService.verifyDocument(document.id, 'approved', undefined, token)
      
      setDocuments(documents.filter(d => d.id !== document.id))
      toast({ title: 'Success', description: 'Document approved' })
      setConfirmModal({ ...confirmModal, open: false })
    } catch (error) {
      console.error('Approve document error:', error)
      toast({ title: 'Error', description: 'Failed to approve document', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const rejectDocument = async (document: Document, reason: string) => {
    if (!reason.trim()) {
      toast({ title: 'Error', description: 'Please provide a rejection reason', variant: 'destructive' })
      return
    }

    try {
      setActionLoading(true)
      const token = localStorage.getItem('adminToken')
      await apiService.verifyDocument(document.id, 'rejected', reason, token)
      
      setDocuments(documents.filter(d => d.id !== document.id))
      toast({ title: 'Success', description: 'Document rejected' })
      setConfirmModal({ ...confirmModal, open: false })
      setRejectionReason('')
    } catch (error) {
      console.error('Reject document error:', error)
      toast({ title: 'Error', description: 'Failed to reject document', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const filteredDocuments = documents.filter(d => {
    if (selectedTab === 'pending') return d.status === 'pending'
    if (selectedTab === 'approved') return d.status === 'approved'
    if (selectedTab === 'rejected') return d.status === 'rejected'
    return true
  })

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      national_id: 'National ID',
      proof_of_residence: 'Proof of Residence',
      certificate_of_good_conduct: 'Certificate of Good Conduct',
      discipline_certificate: 'Discipline Certificate',
      sponsor_reference: 'Sponsor/Reference Letter',
    }
    return labels[type] || type.replace(/_/g, ' ')
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading documents...</div>
      </div>
    )
  }

  const pendingCount = documents.filter(d => d.status === 'pending').length
  const approvedCount = documents.filter(d => d.status === 'approved').length
  const rejectedCount = documents.filter(d => d.status === 'rejected').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Document Verification</h1>
        <Badge variant="secondary">{pendingCount} Pending Review</Badge>
      </div>

      {pendingCount === 0 && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            All documents have been reviewed! No pending documents at this time.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="relative">
            Pending
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved
            {approvedCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {approvedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected
            {rejectedCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {rejectedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="space-y-4 mt-6">
          {filteredDocuments.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center text-muted-foreground">
                {selectedTab === 'pending' && 'No pending documents for review.'}
                {selectedTab === 'approved' && 'No approved documents yet.'}
                {selectedTab === 'rejected' && 'No rejected documents yet.'}
              </CardContent>
            </Card>
          ) : (
            filteredDocuments.map((document) => (
              <Card key={document.id} className={`border ${
                document.status === 'approved' ? 'border-green-200 bg-green-50' :
                document.status === 'rejected' ? 'border-red-200 bg-red-50' :
                'border-yellow-200 bg-yellow-50'
              }`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {getDocumentTypeLabel(document.document_type)}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Trainer: {document.full_name || document.trainer_id}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Badge 
                      variant={
                        document.status === 'approved' ? 'default' :
                        document.status === 'rejected' ? 'destructive' :
                        'secondary'
                      }
                    >
                      {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Uploaded</p>
                      <p className="text-sm text-foreground">
                        {new Date(document.uploaded_at).toLocaleString()}
                      </p>
                    </div>
                    {document.reviewed_at && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Reviewed</p>
                        <p className="text-sm text-foreground">
                          {new Date(document.reviewed_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {document.rejection_reason && (
                    <Alert className="mb-4 bg-red-50 border-red-200">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        <p className="font-medium mb-1">Rejection Reason:</p>
                        <p>{document.rejection_reason}</p>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setViewModal({ open: true, document })}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Document
                    </Button>
                    
                    {document.status === 'pending' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleRejectClick(document)}
                          disabled={actionLoading}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 text-white hover:bg-green-700"
                          onClick={() => handleApproveClick(document)}
                          disabled={actionLoading}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* View Document Modal */}
      <AlertDialog open={viewModal.open} onOpenChange={(open) => {
        if (!open) setViewModal({ open: false, document: null })
      }}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {viewModal.document && getDocumentTypeLabel(viewModal.document.document_type)}
            </AlertDialogTitle>
          </AlertDialogHeader>
          
          {viewModal.document && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Trainer Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm font-medium">{viewModal.document.full_name || viewModal.document.trainer_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ID</p>
                    <p className="text-sm font-medium">{viewModal.document.trainer_id}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Document</p>
                {viewModal.document.file_url ? (
                  viewModal.document.file_url.endsWith('.pdf') ? (
                    <iframe
                      src={viewModal.document.file_url}
                      className="w-full h-96 border rounded-lg"
                      title="PDF Document"
                    />
                  ) : (
                    <img
                      src={viewModal.document.file_url}
                      alt={getDocumentTypeLabel(viewModal.document.document_type)}
                      className="w-full h-auto max-h-96 object-contain border rounded-lg"
                    />
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">No document file available</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Uploaded</p>
                  <p className="text-sm">{new Date(viewModal.document.uploaded_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm">
                    <Badge variant={
                      viewModal.document.status === 'approved' ? 'default' :
                      viewModal.document.status === 'rejected' ? 'destructive' :
                      'secondary'
                    }>
                      {viewModal.document.status.charAt(0).toUpperCase() + viewModal.document.status.slice(1)}
                    </Badge>
                  </p>
                </div>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Action Modal */}
      <AlertDialog open={confirmModal.open} onOpenChange={(open) => {
        if (!open) {
          setConfirmModal({ ...confirmModal, open: false })
          setRejectionReason('')
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmModal.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmModal.description}</AlertDialogDescription>
          </AlertDialogHeader>

          {confirmModal.action === 'reject' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="rejection-reason" className="text-sm">Rejection Reason</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Explain why this document is being rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-2"
                  rows={4}
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmModal.document) {
                  if (confirmModal.action === 'approve') {
                    await approveDocument(confirmModal.document)
                  } else if (confirmModal.action === 'reject') {
                    await rejectDocument(confirmModal.document, rejectionReason)
                  }
                }
              }}
              disabled={actionLoading || (confirmModal.action === 'reject' && !rejectionReason.trim())}
              className={confirmModal.action === 'reject' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                confirmModal.action === 'approve' ? 'Approve' : 'Reject'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
