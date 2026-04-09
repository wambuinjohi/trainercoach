import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, CheckCircle, XCircle } from 'lucide-react'
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

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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
    loadApprovals()
  }, [])

  const loadApprovals = async () => {
    try {
      setLoading(true)
      const usersData = await apiService.getUsers()
      if (usersData?.data || Array.isArray(usersData)) {
        const users = Array.isArray(usersData) ? usersData : usersData.data
        const trainers = users.filter((u: any) => u.user_type === 'trainer')
        const pendingTrainers = trainers.filter((u: any) => !u.is_approved)
        setApprovals(pendingTrainers)
      }
    } catch (error) {
      console.error('Failed to load approvals:', error)
      toast({ title: 'Error', description: 'Failed to load trainer approvals', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const approveTrainer = (userId: string) => {
    const trainer = approvals.find(t => t.user_id === userId)
    const trainerName = trainer?.full_name || userId
    setConfirmModal({
      open: true,
      title: 'Approve Trainer',
      description: `Are you sure you want to approve ${trainerName} as a trainer? They will have access to the platform immediately.`,
      action: async () => {
        try {
          setConfirmLoading(true)
          await apiService.approveTrainer(userId)
          setApprovals(approvals.filter(t => t.user_id !== userId))
          toast({ title: 'Success', description: 'Trainer approved' })
          setConfirmModal({ ...confirmModal, open: false })
        } catch (err: any) {
          console.error('Approve trainer error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to approve trainer', variant: 'destructive' })
        } finally {
          setConfirmLoading(false)
        }
      },
    })
  }

  const rejectTrainer = (userId: string) => {
    const trainer = approvals.find(t => t.user_id === userId)
    const trainerName = trainer?.full_name || userId
    setConfirmModal({
      open: true,
      title: 'Reject Trainer',
      description: `Are you sure you want to reject ${trainerName}? This action cannot be undone.`,
      isDestructive: true,
      action: async () => {
        try {
          setConfirmLoading(true)
          await apiService.rejectTrainer(userId)
          setApprovals(approvals.filter(a => a.user_id !== userId))
          toast({ title: 'Success', description: 'Trainer rejected' })
          setConfirmModal({ ...confirmModal, open: false })
        } catch (err: any) {
          console.error('Reject trainer error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to reject trainer', variant: 'destructive' })
        } finally {
          setConfirmLoading(false)
        }
      },
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading approvals...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Trainer Approvals</h1>
        <Badge variant="secondary">{approvals.length} pending</Badge>
      </div>

      <div className="space-y-4">
        {approvals.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">No pending trainer approvals.</CardContent>
          </Card>
        ) : (
          approvals.map((trainer) => (
            <Card key={trainer.id || trainer.user_id} className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{trainer.full_name || trainer.user_id || 'Unnamed'}</h3>
                    <p className="text-muted-foreground">{trainer.email || trainer.phone_number || ''}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Applied {trainer.created_at ? new Date(trainer.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <Badge variant="outline">Pending Review</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Disciplines</p>
                    <p className="text-sm text-muted-foreground">
                      {Array.isArray(trainer.disciplines) ? trainer.disciplines.join(', ') : trainer.disciplines || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Experience (years)</p>
                    <p className="text-sm text-muted-foreground">{trainer.experience_years ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Registration Path</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={trainer.registration_path === 'sponsored' ? 'default' : 'secondary'}>
                        {trainer.registration_path === 'sponsored' ? 'Sponsored' : 'Independent'}
                      </Badge>
                    </div>
                  </div>
                  {trainer.registration_path === 'sponsored' && trainer.sponsor_name && (
                    <div>
                      <p className="text-sm font-medium text-foreground">Sponsor</p>
                      <p className="text-sm text-muted-foreground">{trainer.sponsor_name}</p>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium text-foreground mb-2">Certifications</p>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(trainer.certifications) ? trainer.certifications : trainer.certifications ? [trainer.certifications] : []).map((cert: any, index: number) => (
                      <Badge key={index} variant="secondary">
                        {cert}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => rejectTrainer(trainer.user_id)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button size="sm" className="bg-gradient-primary text-white" onClick={() => approveTrainer(trainer.user_id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

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
    </div>
  )
}
