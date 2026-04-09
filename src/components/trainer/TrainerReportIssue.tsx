import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { X } from 'lucide-react'

export const TrainerReportIssue: React.FC<{ onDone?: (ref?: string) => void }> = ({ onDone }) => {
  const { user } = useAuth()
  const [type, setType] = useState<'client_misconduct' | 'payment' | 'safety' | 'other'>('client_misconduct')
  const [bookingRef, setBookingRef] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [filePreviews, setFilePreviews] = useState<string[]>([])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const maxSize = 5 * 1024 * 1024
    const validFiles: File[] = []
    const previews: string[] = []

    files.forEach(file => {
      if (file.size > maxSize) {
        toast({ title: 'File too large', description: `${file.name} exceeds 5MB limit`, variant: 'destructive' })
        return
      }

      validFiles.push(file)

      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          previews.push(event.target.result as string)
          if (previews.length === validFiles.length) {
            setFilePreviews(prev => [...prev, ...previews])
          }
        }
      }
      reader.readAsDataURL(file)
    })

    setSelectedFiles(prev => [...prev, ...validFiles])
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setFilePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async (issueId: string): Promise<string[]> => {
    if (selectedFiles.length === 0) return []

    const uploadedUrls: string[] = []
    try {
      const formData = new FormData()
      selectedFiles.forEach(file => {
        formData.append('files[]', file)
      })

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://trainer.skatryk.co.ke'

      const response = await fetch(`${apiBaseUrl}/api.php`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const clonedResponse = response.clone()
        const data = await clonedResponse.json()
        if (data.data?.uploaded && Array.isArray(data.data.uploaded)) {
          uploadedUrls.push(...data.data.uploaded.map((f: any) => f.url))
        }
      } else {
        const clonedResponse = response.clone()
        const responseText = await clonedResponse.text()
        console.error('Upload failed:', responseText)
        toast({ title: 'Upload failed', description: 'Could not upload files', variant: 'destructive' })
      }
    } catch (err) {
      console.error('File upload error:', err)
      toast({ title: 'Upload error', description: String(err), variant: 'destructive' })
    }
    return uploadedUrls
  }

  const submit = async () => {
    if (!user) {
      toast({ title: 'Not signed in', description: 'Please sign in to report an issue', variant: 'destructive' })
      return
    }
    if (!description.trim()) {
      toast({ title: 'Missing details', description: 'Please provide a description', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      let attachmentUrls: string[] = []

      if (selectedFiles.length > 0) {
        attachmentUrls = await uploadFiles('temp')
      }

      const payload: any = {
        user_id: user.id,
        trainer_id: null,
        description,
        status: 'open',
        complaint_type: type,
        booking_reference: bookingRef || null,
        created_at: new Date().toISOString(),
      }

      if (attachmentUrls.length > 0) {
        payload.attachments = JSON.stringify(attachmentUrls)
      }

      const data = await apiRequest('issue_insert', payload, { headers: withAuth() })
      const issueId = data?.id || ('ISSUE-' + Math.random().toString(36).slice(2, 9).toUpperCase())

      toast({ title: 'Reported', description: `Issue reported: ${String(issueId)}` })
      onDone?.(String(issueId))
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      console.error('Report error:', {
        error: err,
        message: errorMsg,
        payload: { ...payload, description: '[redacted]' }
      })
      toast({ title: 'Failed', description: errorMsg || 'Could not report issue', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
      <div className="relative w-full max-w-sm sm:max-w-md md:max-w-lg my-auto">
        <Card className="bg-background">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Report an Issue</CardTitle>
            <button
              onClick={() => onDone?.()}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label>Complaint type</Label>
                <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full p-2 border border-border rounded-md bg-input">
                  <option value="client_misconduct">Client misconduct</option>
                  <option value="payment">Payment issue</option>
                  <option value="safety">Safety concern</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label>Booking reference (optional)</Label>
                <Input value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} placeholder="Booking ID or reference" />
              </div>

              <div>
                <Label>Description</Label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 border border-border rounded-md bg-input" rows={4} />
              </div>

              <div>
                <Label>Attachments (optional)</Label>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx"
                    onChange={handleFileSelect}
                    disabled={loading}
                    className="block w-full text-sm border border-border rounded-md p-2 bg-input cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">Max 5MB per file. Accepted: images, PDF, Word docs</p>
                </div>
              </div>

              {filePreviews.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Attached Files ({selectedFiles.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {filePreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        {selectedFiles[index]?.type.startsWith('image/') ? (
                          <img
                            src={preview}
                            alt={selectedFiles[index]?.name}
                            className="w-full h-24 object-cover rounded-md border border-border"
                          />
                        ) : (
                          <div className="w-full h-24 rounded-md border border-border bg-muted flex items-center justify-center">
                            <span className="text-xs text-center text-muted-foreground px-1 truncate">
                              {selectedFiles[index]?.name}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => removeFile(index)}
                          className="absolute -top-2 -right-2 bg-destructive rounded-full p-1 text-white hover:bg-destructive/90"
                          disabled={loading}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onDone?.()} disabled={loading}>Cancel</Button>
                <Button onClick={submit} disabled={loading}>{loading ? 'Reporting...' : 'Report'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
