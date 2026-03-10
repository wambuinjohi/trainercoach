import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from '@/hooks/use-toast'
import { EmojiPickerComponent } from '@/components/admin/EmojiPickerComponent'
import { Plus, Info, CheckCircle, Clock } from 'lucide-react'

interface PendingRequest {
  id: string
  category_name: string
  category_icon: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  admin_notes?: string
  approved_category_id?: number
}

interface DisciplineRequestFormProps {
  onRequestSubmitted?: () => void
  pendingRequests?: PendingRequest[]
  onRefresh?: () => void
}

export const DisciplineRequestForm: React.FC<DisciplineRequestFormProps> = ({
  onRequestSubmitted,
  pendingRequests = [],
  onRefresh
}) => {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    category_name: '',
    category_icon: '🏋️',
    category_description: ''
  })
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!formData.category_name.trim()) {
      toast({
        title: 'Error',
        description: 'Discipline name is required',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          action: 'discipline_request_create',
          ...formData
        })
      })

      const data = await response.json()
      if (data.status === 'success') {
        toast({
          title: 'Success',
          description: 'Discipline request submitted for admin review'
        })
        setFormData({
          category_name: '',
          category_icon: '🏋️',
          category_description: ''
        })
        setOpen(false)
        onRequestSubmitted?.()
        onRefresh?.()
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to submit request',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit discipline request',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const activePending = pendingRequests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-4">
      {/* Pending Requests Summary */}
      {pendingRequests.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.id} className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded border border-blue-100 dark:border-blue-800">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{request.category_icon}</span>
                      <div>
                        <h4 className="font-semibold text-foreground">{request.category_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Submitted: {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {request.status === 'pending' && (
                      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Clock className="h-4 w-4" />
                        <span className="text-xs font-semibold">Pending</span>
                      </div>
                    )}
                    {request.status === 'approved' && (
                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs font-semibold">Approved</span>
                      </div>
                    )}
                    {request.status === 'rejected' && (
                      <div className="text-destructive">
                        <p className="text-xs font-semibold">Rejected</p>
                        {request.admin_notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Reason: {request.admin_notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request New Discipline Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Request New Discipline
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request New Discipline</DialogTitle>
            <DialogDescription>
              Suggest a new training discipline. An admin will review and approve it before it becomes available.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Info Box */}
            <div className="flex gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                You can only have one pending request per discipline. Once approved, it will be available for your profile.
              </p>
            </div>

            {/* Discipline Name */}
            <div>
              <Label htmlFor="discipline-name" className="text-sm font-semibold">
                Discipline Name *
              </Label>
              <Input
                id="discipline-name"
                placeholder="e.g., Pilates, Muay Thai, Swimming"
                value={formData.category_name}
                onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                className="mt-1 bg-input border-border"
              />
            </div>

            {/* Icon */}
            <div>
              <Label className="text-sm font-semibold">Select Icon</Label>
              <div className="mt-1">
                <EmojiPickerComponent
                  value={formData.category_icon}
                  onChange={(icon) => setFormData({ ...formData, category_icon: icon })}
                  placeholder="Select emoji icon"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="discipline-description" className="text-sm font-semibold">
                Description
              </Label>
              <Textarea
                id="discipline-description"
                placeholder="Brief description of this discipline and what it involves..."
                value={formData.category_description}
                onChange={(e) => setFormData({ ...formData, category_description: e.target.value })}
                className="mt-1 bg-input border-border"
                rows={3}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !formData.category_name.trim()}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {loading ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
