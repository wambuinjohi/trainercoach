import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Send, Loader2, Users, AlertCircle, CheckCircle } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import * as notificationService from '@/lib/notification-service'

type RecipientType = 'all' | 'clients' | 'trainers' | 'admins'

interface BroadcastHistory {
  id: string
  title: string
  message: string
  recipientType: RecipientType
  sentAt: string
  recipientCount: number
  status: 'sent' | 'failed' | 'pending'
}

export const AnnouncementBroadcastManager: React.FC = () => {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [recipientType, setRecipientType] = useState<RecipientType>('all')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<BroadcastHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [previewMode, setPreviewMode] = useState(false)

  // Load broadcast history on mount
  useEffect(() => {
    loadBroadcastHistory()
  }, [])

  const STORAGE_KEY = 'announcement_broadcast_history'

  const loadBroadcastHistory = async () => {
    try {
      setLoadingHistory(true)
      // Load from localStorage first
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const parsedHistory = JSON.parse(stored) as BroadcastHistory[]
          setHistory(parsedHistory)
        } catch (err) {
          console.warn('Failed to parse stored broadcast history', err)
          setHistory([])
        }
      }
    } catch (err) {
      console.warn('Failed to load broadcast history', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const saveBroadcastHistory = (updatedHistory: BroadcastHistory[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory))
    } catch (err) {
      console.warn('Failed to save broadcast history to localStorage', err)
    }
  }

  const handleBroadcast = async () => {
    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Please enter an announcement title', variant: 'destructive' })
      return
    }
    if (!message.trim()) {
      toast({ title: 'Message required', description: 'Please enter the announcement message', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      // Get users based on recipient type
      let userIds: string[] = []

      if (recipientType === 'all') {
        // Get all users
        const allUsers = await apiRequest('get_users', {}, { headers: withAuth() })
        userIds = allUsers?.data?.map((u: any) => u.id) || []
      } else if (recipientType === 'clients') {
        const clients = await apiRequest('profiles_get_by_type', { user_type: 'client' }, { headers: withAuth() })
        userIds = clients?.map((c: any) => c.user_id) || []
      } else if (recipientType === 'trainers') {
        const trainers = await apiRequest('profiles_get_by_type', { user_type: 'trainer' }, { headers: withAuth() })
        userIds = trainers?.map((t: any) => t.user_id) || []
      } else if (recipientType === 'admins') {
        const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
        userIds = admins?.map((a: any) => a.user_id) || []
      }

      if (userIds.length === 0) {
        toast({ title: 'No recipients', description: 'No users found for the selected recipient type', variant: 'destructive' })
        setLoading(false)
        return
      }

      // Use centralized notification service to create announcements
      const success = await notificationService.notifySystemAnnouncement(
        title,
        message,
        userIds
      )

      if (!success) {
        throw new Error('Failed to send notifications')
      }

      // Add to history and persist
      const nowIso = new Date().toISOString()
      const announcement: BroadcastHistory = {
        id: `ann-${Date.now()}`,
        title,
        message,
        recipientType,
        sentAt: nowIso,
        recipientCount: userIds.length,
        status: 'sent',
      }
      const updatedHistory = [announcement, ...history]
      setHistory(updatedHistory)
      saveBroadcastHistory(updatedHistory)

      toast({
        title: 'Announcement sent',
        description: `Successfully sent to ${userIds.length} ${recipientType === 'all' ? 'users' : recipientType}`,
      })

      // Reset form
      setTitle('')
      setMessage('')
      setRecipientType('all')
      setPreviewMode(false)
    } catch (err: any) {
      console.error('Broadcast error', err)
      toast({
        title: 'Broadcast failed',
        description: err?.message || 'Failed to send announcement',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const recipientLabels: Record<RecipientType, string> = {
    all: 'All Users',
    clients: 'Clients Only',
    trainers: 'Trainers Only',
    admins: 'Admins Only',
  }

  return (
    <div className="space-y-6">
      {/* Compose Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Compose Announcement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title" className="font-medium">
              Announcement Title
            </Label>
            <Input
              id="title"
              placeholder="e.g., System Maintenance Scheduled"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={loading}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="message" className="font-medium">
              Message
            </Label>
            <textarea
              id="message"
              placeholder="Enter your announcement message..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              disabled={loading}
              rows={6}
              className="w-full p-2 border border-border rounded-md bg-input mt-1 font-sans text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {message.length} characters
            </p>
          </div>

          <div>
            <Label className="font-medium mb-3 block">Send to</Label>
            <div className="space-y-2">
              {(['all', 'clients', 'trainers', 'admins'] as RecipientType[]).map(type => (
                <label key={type} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer">
                  <Checkbox
                    checked={recipientType === type}
                    onCheckedChange={() => setRecipientType(type)}
                    disabled={loading}
                  />
                  <span className="text-sm font-medium">{recipientLabels[type]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          {previewMode && (
            <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 space-y-2">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Preview</p>
              <div className="bg-white dark:bg-gray-950 rounded p-3 space-y-2">
                <p className="font-semibold text-sm">{title || 'Announcement Title'}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {message || 'Your message will appear here...'}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setPreviewMode(!previewMode)}
              disabled={loading}
              className="flex-1"
            >
              {previewMode ? 'Hide Preview' : 'Preview'}
            </Button>
            <Button
              onClick={handleBroadcast}
              disabled={loading || !title.trim() || !message.trim()}
              className="flex-1 bg-gradient-primary text-white gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Announcement
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Broadcast History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-3">
              {history.map(announcement => (
                <div key={announcement.id} className="p-3 rounded-lg border border-border hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm truncate">{announcement.title}</p>
                        <Badge variant={announcement.status === 'sent' ? 'default' : 'secondary'} className="text-xs">
                          {announcement.status === 'sent' ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : announcement.status === 'failed' ? (
                            <AlertCircle className="h-3 w-3 mr-1" />
                          ) : null}
                          {announcement.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {announcement.message}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {announcement.recipientCount} {recipientLabels[announcement.recipientType].toLowerCase()}
                        </span>
                        <span>
                          {new Date(announcement.sentAt).toLocaleDateString()} {new Date(announcement.sentAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500">No announcements sent yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
