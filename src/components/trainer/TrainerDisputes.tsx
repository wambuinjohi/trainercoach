import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ArrowLeft, MessageSquare, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { apiRequest, withAuth } from '@/lib/api'
import * as apiService from '@/lib/api-service'

type DisputeStatus = 'pending' | 'investigating' | 'resolved'

interface Dispute {
  id: string | number
  client: string
  trainer: string
  issue: string
  amount: number
  status: DisputeStatus
  submittedAt: string
  user_id?: string
  trainer_id?: string
  complaint_type?: string
  description?: string
  booking_reference?: string
  created_at?: string
  notes?: string
}

interface TrainerDisputesProps {
  onClose?: () => void
}

export const TrainerDisputes: React.FC<TrainerDisputesProps> = ({ onClose }) => {
  const { user } = useAuth()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDispute, setActiveDispute] = useState<Dispute | null>(null)
  const [notes, setNotes] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DisputeStatus>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadDisputes()
  }, [user?.id])

  const loadDisputes = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const result = await apiRequest('select', {
        table: 'reported_issues',
        where: `user_id = '${user.id}' OR trainer_id = '${user.id}'`,
        order: 'created_at DESC',
      })

      if (result?.data && Array.isArray(result.data)) {
        const transformedDisputes = result.data.map((issue: any) => ({
          id: issue.id,
          client: issue.user_id || 'Unknown',
          trainer: issue.trainer_id || user.id,
          issue: issue.complaint_type || 'Unknown',
          amount: 0,
          status: (issue.status || 'open').toLowerCase() === 'open' ? 'pending' : issue.status,
          submittedAt: issue.created_at || new Date().toISOString(),
          user_id: issue.user_id,
          trainer_id: issue.trainer_id,
          complaint_type: issue.complaint_type,
          description: issue.description,
          booking_reference: issue.booking_reference,
          created_at: issue.created_at,
          notes: issue.notes || ''
        }))
        setDisputes(transformedDisputes)
      } else {
        setDisputes([])
      }
    } catch (err) {
      console.error('Failed to load disputes:', err)
      toast({ title: 'Error', description: 'Failed to load disputes', variant: 'destructive' })
      setDisputes([])
    } finally {
      setLoading(false)
    }
  }

  const saveNotes = async () => {
    if (!activeDispute) return

    try {
      await apiService.updateIssue(String(activeDispute.id), { notes })
      setDisputes(disputes.map(d => d.id === activeDispute.id ? { ...d, notes } : d))
      setActiveDispute({ ...activeDispute, notes })
      toast({ title: 'Success', description: 'Notes saved' })
    } catch (err) {
      console.error('Failed to save notes:', err)
      toast({ title: 'Error', description: 'Failed to save notes', variant: 'destructive' })
    }
  }

  const handleStatusChange = async (status: DisputeStatus) => {
    if (!activeDispute) return

    try {
      await apiService.updateIssueStatus(String(activeDispute.id), status)
      const updated = { ...activeDispute, status }
      setActiveDispute(updated)
      setDisputes(disputes.map(d => d.id === activeDispute.id ? updated : d))
      toast({ title: 'Success', description: `Dispute status updated to ${status}` })
    } catch (err) {
      console.error('Failed to update status:', err)
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' })
    }
  }

  const filtered = disputes.filter(d => {
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter
    const matchesQuery = query.toLowerCase() === '' || 
      d.issue.toLowerCase().includes(query.toLowerCase()) ||
      String(d.client).toLowerCase().includes(query.toLowerCase())
    return matchesStatus && matchesQuery
  })

  const getStatusColor = (status: DisputeStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500'
      case 'investigating': return 'bg-blue-500'
      case 'resolved': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Disputes</h1>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading disputes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="-ml-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Disputes</h1>
      </div>

      <div className="flex flex-col gap-2 sm:gap-3">
        <div>
          <input
            type="text"
            placeholder="Search disputes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-2 sm:px-3 py-2 text-sm border border-border rounded-md bg-input text-foreground"
          />
        </div>
        <div className="flex gap-1 sm:gap-2 flex-wrap">
          {(['all', 'pending', 'investigating', 'resolved'] as const).map(status => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="text-xs sm:text-sm"
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {disputes.length === 0 ? 'No disputes yet' : 'No disputes match your search'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 sm:space-y-4">
          {filtered.map(dispute => (
            <Card key={dispute.id} className="bg-card border-border cursor-pointer hover:bg-card/80 transition" onClick={() => setActiveDispute(dispute)}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-start gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-foreground text-sm sm:text-base">{dispute.issue}</h3>
                      <Badge className={`${getStatusColor(dispute.status)} text-xs`}>
                        {dispute.status}
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 break-words">{dispute.description}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="text-muted-foreground">Client ID: </span>
                        <span className="text-foreground break-all">{dispute.user_id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Submitted: </span>
                        <span className="text-foreground">{new Date(dispute.submittedAt).toLocaleDateString()}</span>
                      </div>
                      {dispute.booking_reference && (
                        <div className="col-span-1 sm:col-span-2">
                          <span className="text-muted-foreground">Booking Ref: </span>
                          <span className="text-foreground">{dispute.booking_reference}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <MessageSquare className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40 overflow-y-auto">
          <Card className="w-full max-w-sm sm:max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="sticky top-0 bg-background">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg sm:text-xl">Dispute Details</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveDispute(null)}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Issue Type</p>
                <p className="text-sm text-muted-foreground">{activeDispute.issue}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-1">Description</p>
                <p className="text-sm text-muted-foreground">{activeDispute.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Client ID</p>
                  <p className="text-sm text-muted-foreground break-all">{activeDispute.user_id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Status</p>
                  <div className="mt-1">
                    <Badge className={getStatusColor(activeDispute.status)}>
                      {activeDispute.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {activeDispute.booking_reference && (
                <div>
                  <p className="text-sm font-medium text-foreground">Booking Reference</p>
                  <p className="text-sm text-muted-foreground">{activeDispute.booking_reference}</p>
                </div>
              )}

              <div>
                <Label htmlFor="notes">Internal Notes</Label>
                <textarea
                  id="notes"
                  value={notes || activeDispute.notes || ''}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border border-border rounded-md bg-input text-foreground mt-1"
                  rows={3}
                  placeholder="Add notes about this dispute..."
                />
              </div>

              <div className="flex gap-1 sm:gap-2 flex-wrap">
                {(['pending', 'investigating', 'resolved'] as const).map(status => (
                  <Button
                    key={status}
                    variant={activeDispute.status === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange(status)}
                    className="text-xs sm:text-sm"
                  >
                    Mark {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>

              <div className="flex justify-end gap-2 flex-col-reverse sm:flex-row">
                <Button variant="outline" onClick={() => setActiveDispute(null)} className="w-full sm:w-auto">Close</Button>
                <Button onClick={saveNotes} className="w-full sm:w-auto">Save Notes</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
