import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

type DisputeStatus = 'pending' | 'investigating' | 'resolved'

type Dispute = {
  id: string | number
  case: string
  client: string
  trainer: string
  issue: string
  amount: number
  status: DisputeStatus
  submittedAt: string
  refunded?: boolean
  notes?: string
}

export default function DisputesPage() {
  const [issues, setIssues] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [displayedDisputeCount, setDisplayedDisputeCount] = useState(10)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    title: string
    description: string
    action: () => Promise<void>
  }>({
    open: false,
    title: '',
    description: '',
    action: async () => {},
  })
  const [confirmLoading, setConfirmLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [issuesData, usersData] = await Promise.all([
        apiService.getIssuesWithPagination({ page: 1, pageSize: 100 }),
        apiService.getUsers(),
      ])

      const issuesList = issuesData?.data || []
      const usersList = Array.isArray(usersData) ? usersData : usersData?.data || []

      setIssues(issuesList)
      setUsers(usersList)
    } catch (error) {
      console.error('Failed to load disputes data:', error)
      toast({ title: 'Error', description: 'Failed to load disputes', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const issueToDispute = (issue: any): Dispute => {
    const clientUser = users.find((u: any) => u.user_id === issue.user_id)
    const trainerUser = users.find((u: any) => u.user_id === issue.trainer_id)
    const statusMap: Record<string, DisputeStatus> = {
      open: 'pending',
      pending: 'pending',
      investigating: 'investigating',
      resolved: 'resolved',
    }
    const mappedStatus = statusMap[String(issue.status || 'open').toLowerCase()] || 'pending'
    return {
      id: issue.id,
      case: `#${issue.id?.substring(0, 8) || Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      client: clientUser?.full_name || issue.user_id || 'Unknown Client',
      trainer: trainerUser?.full_name || issue.trainer_id || 'N/A',
      issue: issue.description || 'No description',
      amount: 0,
      status: mappedStatus,
      submittedAt: issue.created_at ? new Date(issue.created_at).toLocaleDateString() : 'Unknown',
      refunded: false,
      notes: issue.resolution || undefined,
    }
  }

  const transformedDisputes = useMemo(() => {
    return issues.map(issueToDispute)
  }, [issues, users])

  const filtered = useMemo(() => {
    return transformedDisputes.filter(d => {
      const q = query.toLowerCase()
      const matches = !q || [d.case, d.client, d.trainer, d.issue].some(v => String(v).toLowerCase().includes(q))
      const statusOk = statusFilter === 'all' ? true : d.status === statusFilter
      return matches && statusOk
    })
  }, [transformedDisputes, query, statusFilter])

  const displayed = filtered.slice(0, displayedDisputeCount)

  const setStatus = async (id: any, status: DisputeStatus) => {
    const issueId = String(id)
    try {
      await apiService.updateIssueStatus(issueId, status)
      setIssues(iss => iss.map(i => (i.id === issueId ? { ...i, status } : i)))
      toast({ title: 'Success', description: `Dispute status updated to ${status}` })
    } catch (err: any) {
      console.error('Update dispute status error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to update dispute status', variant: 'destructive' })
    }
  }

  const resolve = (id: any) => {
    const dispute = filtered.find(d => d.id === id)
    const caseLabel = dispute?.case || `Case #${id}`
    setConfirmModal({
      open: true,
      title: 'Resolve Dispute',
      description: `Are you sure you want to mark ${caseLabel} as resolved?`,
      action: async () => {
        try {
          setConfirmLoading(true)
          await setStatus(id, 'resolved')
          setConfirmModal({ ...confirmModal, open: false })
        } finally {
          setConfirmLoading(false)
        }
      },
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading disputes...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dispute Management</h1>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Search by case, client, trainer, or issue..." value={query} onChange={(e) => setQuery(e.target.value)} />

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Disputes ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="p-2">Case</th>
                  <th className="p-2">Client</th>
                  <th className="p-2">Trainer</th>
                  <th className="p-2">Issue</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No disputes found
                    </td>
                  </tr>
                ) : (
                  displayed.map(d => (
                    <tr key={d.id} className="border-b">
                      <td className="p-2 font-mono text-xs">{d.case}</td>
                      <td className="p-2">{d.client}</td>
                      <td className="p-2">{d.trainer}</td>
                      <td className="p-2 truncate max-w-xs">{d.issue}</td>
                      <td className="p-2">
                        <Select value={d.status} onValueChange={(v) => setStatus(d.id, v as DisputeStatus)}>
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="investigating">Investigating</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Button size="sm" variant="outline" onClick={() => resolve(d.id)}>
                          Resolve
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > displayedDisputeCount && (
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={() => setDisplayedDisputeCount(displayedDisputeCount + 10)}>
                Load More ({filtered.length - displayedDisputeCount} remaining)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmModal.open} onOpenChange={(open) => {
        if (!open) setConfirmModal({ ...confirmModal, open: false })
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmModal.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmModal.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await confirmModal.action()
              }}
              disabled={confirmLoading}
            >
              {confirmLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
