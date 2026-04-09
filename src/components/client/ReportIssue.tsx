import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export const ReportIssue: React.FC<{ trainerId?: any, onDone?: (ref?: string) => void }> = ({ trainerId, onDone }) => {
  const { user } = useAuth()
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!user) return
    if (!description.trim()) {
      toast({ title: 'Missing details', description: 'Please provide details for the issue', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const payload: any = { user_id: user.id, trainer_id: trainerId, description, status: 'open' }
      const data = await apiRequest('issue_insert', payload, { headers: withAuth() })
      const ref = data?.id || data?.reference || ('ISSUE-' + Math.random().toString(36).slice(2, 9).toUpperCase())
      toast({ title: 'Reported', description: `Issue reported: ${ref}` })
      onDone?.(ref)
    } catch (err) {
      console.error('Report error', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Report an Issue</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <Label>Description</Label>
            <textarea className="w-full p-2 border border-border rounded-md bg-input" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onDone?.()}>Cancel</Button>
            <Button onClick={submit} disabled={loading}>{loading ? 'Reporting...' : 'Report'}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
