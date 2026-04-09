import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { X } from 'lucide-react'

export const NotificationsCenter: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth()
  const userId = user?.id
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await apiRequest('notifications_get', { user_id: userId }, { headers: withAuth() })
      const notifs = Array.isArray(data) ? data : (data?.data || [])
      setItems(notifs)

      // Mark all as read
      const unreadIds = notifs.filter((n: any) => !n.read).map((n: any) => n.id)
      if (unreadIds.length > 0) {
        try {
          await apiRequest('notifications_mark_read', { user_id: userId, notification_ids: unreadIds }, { headers: withAuth() })
        } catch (err) {
          console.warn('Failed to mark notifications as read', err)
        }
      }
    } catch (err) {
      console.warn('Failed to load notifications', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [userId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-96 bg-background rounded-lg border border-border overflow-hidden flex flex-col">
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-border bg-background">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No notifications</div>
          ) : (
            <div className="space-y-1">
              {items.map((it, i) => (
                <div key={i} className="p-3 border-b border-border last:border-b-0 hover:bg-muted/50">
                  <div className="font-semibold text-sm">{it.title || 'Notification'}</div>
                  <div className="text-xs text-muted-foreground mt-1">{it.body || it.message}</div>
                  {it.created_at && (
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      {new Date(it.created_at).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
