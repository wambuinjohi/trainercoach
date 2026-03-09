import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

export default function IssuesPage() {
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize] = useState(10)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loadingPage, setLoadingPage] = useState(false)
  const [activeIssue, setActiveIssue] = useState<any | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    title: string
    description: string
    action: () => Promise<void>
    isDestructive?: boolean
  }>({
    open: false,
    title: '',
    description: '',
    action: async () => {},
  })
  const [confirmLoading, setConfirmLoading] = useState(false)

  useEffect(() => {
    loadIssuesPage(1)
  }, [])

  const loadIssuesPage = async (pageNum: number) => {
    setLoadingPage(true)
    try {
      const result = await apiService.getIssuesWithPagination({
        page: pageNum,
        pageSize,
        searchQuery: query,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      if (result?.data) {
        setIssues(result.data)
        if (result.count !== undefined) {
          setTotalCount(result.count)
        }
      }
      setPage(pageNum)
    } catch (err: any) {
      console.error('Load issues page error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to load issues', variant: 'destructive' })
    } finally {
      setLoadingPage(false)
    }
  }

  const markResolved = (issue: any) => {
    if (!issue?.id) {
      toast({ title: 'Error', description: 'Invalid issue', variant: 'destructive' })
      return
    }
    const issueTitle = issue.complaint_type || 'Issue'
    setConfirmModal({
      open: true,
      title: 'Resolve Issue',
      description: `Are you sure you want to mark "${issueTitle}" as resolved?`,
      action: async () => {
        try {
          setConfirmLoading(true)
          await apiService.updateIssueStatus(issue.id, 'resolved')
          setIssues(issues.map(iss => (iss.id === issue.id ? { ...iss, status: 'resolved' } : iss)))
          setActiveIssue(null)
          toast({ title: 'Success', description: 'Issue marked as resolved' })
          setConfirmModal({ ...confirmModal, open: false })
        } catch (err: any) {
          console.error('Mark issue resolved error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to resolve issue', variant: 'destructive' })
        } finally {
          setConfirmLoading(false)
        }
      },
    })
  }

  const softDelete = (issue: any) => {
    setConfirmModal({
      open: true,
      title: 'Delete Issue',
      description: 'Are you sure you want to delete this issue? This action can be undone.',
      isDestructive: true,
      action: async () => {
        try {
          setConfirmLoading(true)
          await apiService.softDeleteIssue(issue.id)
          setIssues(issues.filter(iss => iss.id !== issue.id))
          setActiveIssue(null)
          toast({ title: 'Success', description: 'Issue deleted' })
          setConfirmModal({ ...confirmModal, open: false })
        } catch (err: any) {
          console.error('Soft delete issue error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to delete issue', variant: 'destructive' })
        } finally {
          setConfirmLoading(false)
        }
      },
    })
  }

  const openIssues = issues.filter((it: any) => String(it.status || 'pending').toLowerCase() !== 'resolved').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Issues Management</h1>
        <Badge variant="secondary">{openIssues} open</Badge>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Search issues..." value={query} onChange={(e) => setQuery(e.target.value)} />

          <div className="flex gap-2">
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

            <Button onClick={() => loadIssuesPage(1)}>Search</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Issues</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPage ? (
            <div className="text-center text-muted-foreground">Loading issues...</div>
          ) : (
            <div className="space-y-4">
              {issues.length === 0 ? (
                <div className="text-center text-muted-foreground">No issues found</div>
              ) : (
                issues.map(issue => (
                  <div key={issue.id} className="p-4 border rounded-lg border-border hover:bg-muted/50 transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{issue.complaint_type || 'Issue'}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                      </div>
                      <Badge variant={issue.status === 'resolved' ? 'secondary' : 'outline'}>{issue.status || 'pending'}</Badge>
                    </div>

                    <div className="flex gap-2 text-xs text-muted-foreground mb-3">
                      <span>ID: {issue.id?.substring(0, 8)}</span>
                      {issue.created_at && <span>Created: {new Date(issue.created_at).toLocaleDateString()}</span>}
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setActiveIssue(issue)}>
                        View Details
                      </Button>
                      {issue.status !== 'resolved' && (
                        <Button size="sm" variant="outline" onClick={() => markResolved(issue)}>
                          Mark Resolved
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => softDelete(issue)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {totalCount > pageSize && (
            <div className="mt-4 flex gap-2 justify-center">
              <Button size="sm" variant="outline" onClick={() => loadIssuesPage(page - 1)} disabled={page === 1}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground py-2">Page {page}</span>
              <Button size="sm" variant="outline" onClick={() => loadIssuesPage(page + 1)} disabled={page * pageSize >= totalCount}>
                Next
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
              className={confirmModal.isDestructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {confirmLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {activeIssue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-96 overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Issue Details</CardTitle>
                <Button variant="ghost" onClick={() => setActiveIssue(null)}>×</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm">Complaint Type</h4>
                <p className="text-foreground">{activeIssue.complaint_type || '-'}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Description</h4>
                <p className="text-foreground">{activeIssue.description || '-'}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Status</h4>
                <p className="text-foreground">{activeIssue.status || 'pending'}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Created</h4>
                <p className="text-foreground">{activeIssue.created_at ? new Date(activeIssue.created_at).toLocaleString() : '-'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
