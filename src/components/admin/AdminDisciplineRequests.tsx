import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from '@/hooks/use-toast'
import { EmojiPickerComponent } from './EmojiPickerComponent'
import { CheckCircle, XCircle, Edit2, Search } from 'lucide-react'

interface DisciplineRequest {
  id: string
  trainer_id: string
  category_name: string
  category_icon: string
  category_description: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string
  created_at: string
  reviewed_at?: string
  email: string
  first_name: string
  last_name: string
  phone: string
  rating?: number
  total_reviews?: number
  approved_category_name?: string
}

export const AdminDisciplineRequests: React.FC = () => {
  const [requests, setRequests] = useState<DisciplineRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Dialog states
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; request?: DisciplineRequest }>({ open: false })
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; request?: DisciplineRequest }>({ open: false })
  
  // Edit form for approval
  const [editForm, setEditForm] = useState({
    category_name: '',
    category_icon: '',
    category_description: ''
  })
  
  // Reject form
  const [rejectNotes, setRejectNotes] = useState('')
  
  const [processingId, setProcessingId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadRequests()
  }, [statusFilter])

  const loadRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          action: 'discipline_request_list',
          status: statusFilter,
          sortBy: 'created_at'
        })
      })

      const data = await response.json()
      if (data.status === 'success') {
        setRequests(data.data || [])
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to load requests',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load discipline requests',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApproveClick = (request: DisciplineRequest) => {
    setEditForm({
      category_name: request.category_name,
      category_icon: request.category_icon,
      category_description: request.category_description
    })
    setApproveDialog({ open: true, request })
  }

  const handleRejectClick = (request: DisciplineRequest) => {
    setRejectNotes('')
    setRejectDialog({ open: true, request })
  }

  const handleApprove = async () => {
    if (!approveDialog.request) return

    try {
      setProcessingId(approveDialog.request.id)
      const response = await fetch('/api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          action: 'discipline_request_approve',
          request_id: approveDialog.request.id,
          ...editForm
        })
      })

      const data = await response.json()
      if (data.status === 'success') {
        toast({
          title: 'Success',
          description: 'Discipline request approved'
        })
        setApproveDialog({ open: false })
        loadRequests()
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to approve request',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to approve request',
        variant: 'destructive'
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async () => {
    if (!rejectDialog.request) return

    try {
      setProcessingId(rejectDialog.request.id)
      const response = await fetch('/api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          action: 'discipline_request_reject',
          request_id: rejectDialog.request.id,
          admin_notes: rejectNotes || 'Request does not meet requirements'
        })
      })

      const data = await response.json()
      if (data.status === 'success') {
        toast({
          title: 'Success',
          description: 'Discipline request rejected'
        })
        setRejectDialog({ open: false })
        loadRequests()
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to reject request',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reject request',
        variant: 'destructive'
      })
    } finally {
      setProcessingId(null)
    }
  }

  const filteredRequests = requests.filter(req =>
    req.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Discipline Requests</h2>
          <p className="text-sm text-muted-foreground">Review trainer-submitted discipline requests</p>
        </div>
        {pendingCount > 0 && (
          <div className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
            <span className="text-sm font-semibold">{pendingCount} Pending</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="search" className="text-sm">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by trainer or discipline..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-input border-border pl-10"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="status-filter" className="text-sm">Status</Label>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Requests</SelectItem>
              <SelectItem value="pending">Pending Only</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center text-muted-foreground">
            Loading requests...
          </CardContent>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center text-muted-foreground">
            {requests.length === 0 ? 'No discipline requests yet.' : 'No requests match your search.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredRequests.map((request) => (
            <Card key={request.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="grid md:grid-cols-5 gap-4 items-start">
                  {/* Discipline Info */}
                  <div className="md:col-span-2">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl flex-shrink-0">{request.category_icon}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground">{request.category_name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {request.category_description || 'No description provided'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Trainer Info */}
                  <div className="md:col-span-1">
                    <p className="text-sm font-semibold text-foreground">{request.first_name} {request.last_name}</p>
                    <p className="text-xs text-muted-foreground">{request.email}</p>
                    {request.rating !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ⭐ {request.rating} ({request.total_reviews} reviews)
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted: {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="md:col-span-1 flex items-center justify-center">
                    {request.status === 'pending' && (
                      <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-xs font-semibold">
                        ⏳ Pending
                      </span>
                    )}
                    {request.status === 'approved' && (
                      <div className="text-center">
                        <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 text-xs font-semibold">
                          ✓ Approved
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          as: {request.approved_category_name}
                        </p>
                      </div>
                    )}
                    {request.status === 'rejected' && (
                      <div className="text-center">
                        <span className="px-3 py-1 rounded-full bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 text-xs font-semibold">
                          ✗ Rejected
                        </span>
                        {request.admin_notes && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                            {request.admin_notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {request.status === 'pending' && (
                    <div className="md:col-span-1 flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApproveClick(request)}
                        disabled={processingId === request.id}
                        className="gap-1 border-green-200 text-green-600 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span className="hidden sm:inline">Approve</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectClick(request)}
                        disabled={processingId === request.id}
                        className="gap-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900"
                      >
                        <XCircle className="h-4 w-4" />
                        <span className="hidden sm:inline">Reject</span>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialog.open} onOpenChange={(open) => setApproveDialog({ open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Discipline Request</DialogTitle>
            <DialogDescription>
              Review and optionally edit the discipline details before approving.
            </DialogDescription>
          </DialogHeader>

          {approveDialog.request && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="approve-name" className="text-sm font-semibold">
                  Discipline Name
                </Label>
                <Input
                  id="approve-name"
                  value={editForm.category_name}
                  onChange={(e) => setEditForm({ ...editForm, category_name: e.target.value })}
                  className="mt-1 bg-input border-border"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold">Icon</Label>
                <div className="mt-1">
                  <EmojiPickerComponent
                    value={editForm.category_icon}
                    onChange={(icon) => setEditForm({ ...editForm, category_icon: icon })}
                    placeholder="Select emoji"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="approve-desc" className="text-sm font-semibold">
                  Description
                </Label>
                <Textarea
                  id="approve-desc"
                  value={editForm.category_description}
                  onChange={(e) => setEditForm({ ...editForm, category_description: e.target.value })}
                  className="mt-1 bg-input border-border"
                  rows={3}
                />
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-100">
                From {approveDialog.request.first_name} {approveDialog.request.last_name}
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setApproveDialog({ open: false })}
                  disabled={processingId === approveDialog.request?.id}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={processingId === approveDialog.request?.id || !editForm.category_name.trim()}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  {processingId === approveDialog.request?.id ? 'Approving...' : 'Approve'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogTitle>Reject Discipline Request?</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-3 py-2">
              <p>
                Are you sure you want to reject the request for "<strong>{rejectDialog.request?.category_name}</strong>" from <strong>{rejectDialog.request?.first_name} {rejectDialog.request?.last_name}</strong>?
              </p>
              <div>
                <Label htmlFor="reject-notes" className="text-sm font-semibold text-foreground">
                  Rejection Reason (optional)
                </Label>
                <Textarea
                  id="reject-notes"
                  placeholder="Explain why this discipline was rejected..."
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  className="mt-1 bg-input border-border text-foreground"
                  rows={3}
                />
              </div>
            </div>
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-4">
            <AlertDialogCancel disabled={processingId === rejectDialog.request?.id}>
              Keep Pending
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={processingId === rejectDialog.request?.id}
              className="bg-destructive hover:bg-destructive/90"
            >
              {processingId === rejectDialog.request?.id ? 'Rejecting...' : 'Reject Request'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
