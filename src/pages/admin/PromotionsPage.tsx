import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
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

export default function PromotionsPage() {
  const { user } = useAuth()
  const [promotions, setPromotions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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
    loadPromotions()
  }, [])

  const loadPromotions = async () => {
    try {
      setLoading(true)
      const data = await apiService.getPromotionRequestsForAdmin('pending')
      const promotionsList = Array.isArray(data) ? data : data?.data ? (Array.isArray(data.data) ? data.data : [data.data]) : []
      setPromotions(promotionsList)
    } catch (error) {
      console.error('Failed to load promotions:', error)
      toast({ title: 'Error', description: 'Failed to load promotions', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const approvePromotion = (id: string | number) => {
    const promotion = promotions.find(p => p.id === id)
    const trainerName = promotion?.full_name || 'Unknown'
    setConfirmModal({
      open: true,
      title: 'Approve Promotion Request',
      description: `Are you sure you want to approve the promotion request from ${trainerName}?`,
      action: async () => {
        try {
          setConfirmLoading(true)
          await apiService.approvePromotionRequest(String(id), user?.id)
          setPromotions(promotions.filter(p => p.id !== id))
          toast({ title: 'Success', description: 'Promotion request approved' })
          setConfirmModal({ ...confirmModal, open: false })
        } catch (err: any) {
          console.error('Approve promotion error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to approve promotion', variant: 'destructive' })
        } finally {
          setConfirmLoading(false)
        }
      },
    })
  }

  const rejectPromotion = (id: string | number) => {
    const promotion = promotions.find(p => p.id === id)
    const trainerName = promotion?.full_name || 'Unknown'
    setConfirmModal({
      open: true,
      title: 'Reject Promotion Request',
      description: `Are you sure you want to reject the promotion request from ${trainerName}?`,
      action: async () => {
        try {
          setConfirmLoading(true)
          await apiService.rejectPromotionRequest(String(id), user?.id)
          setPromotions(promotions.filter(p => p.id !== id))
          toast({ title: 'Success', description: 'Promotion request rejected' })
          setConfirmModal({ ...confirmModal, open: false })
        } catch (err: any) {
          console.error('Reject promotion error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to reject promotion', variant: 'destructive' })
        } finally {
          setConfirmLoading(false)
        }
      },
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading promotions...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Promotion Requests</h1>
        <Badge variant="secondary">{promotions.length} pending</Badge>
      </div>

      <div className="space-y-4">
        {promotions.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">No pending promotion requests.</CardContent>
          </Card>
        ) : (
          promotions.map(promotion => (
            <Card key={promotion.id} className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{promotion.full_name || 'Unknown Trainer'}</h3>
                    <p className="text-muted-foreground">{promotion.email || '-'}</p>
                  </div>
                  <Badge variant="outline">Pending Review</Badge>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium text-foreground mb-2">Promotion Details</p>
                  <p className="text-sm text-muted-foreground">{promotion.description || promotion.promotion_name || '-'}</p>
                </div>

                {promotion.promo_discount && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-foreground">Discount</p>
                    <p className="text-sm text-muted-foreground">{promotion.promo_discount}%</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground flex-1"
                    onClick={() => rejectPromotion(promotion.id)}
                  >
                    Reject
                  </Button>
                  <Button size="sm" className="bg-gradient-primary text-white flex-1" onClick={() => approvePromotion(promotion.id)}>
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
            >
              {confirmLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
