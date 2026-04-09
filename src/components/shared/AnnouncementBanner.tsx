import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, X, ChevronRight } from 'lucide-react'
import { apiRequest } from '@/lib/api'

interface Announcement {
  id: string
  title: string
  message: string
  target_user_type: string
  admin_id: string | null
  created_at: string
  updated_at: string
  is_read: boolean
}

interface AnnouncementBannerProps {
  userId?: string
  userType?: 'client' | 'trainer' | 'admin'
  onAnnouncementsLoaded?: (count: number) => void
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  userId,
  userType,
  onAnnouncementsLoaded
}) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId || !userType) return
    loadAnnouncements()
  }, [userId, userType])

  const loadAnnouncements = async () => {
    if (!userType) return
    setLoading(true)
    try {
      const response = await apiRequest<{ announcements: Announcement[]; count: number }>('announcements_get', {
        user_type: userType,
        limit: 10,
        offset: 0
      })

      if ('announcements' in response) {
        setAnnouncements(response.announcements)
        onAnnouncementsLoaded?.(response.announcements.length)
      }
    } catch (err) {
      console.warn('Failed to load announcements', err)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (announcementId: string) => {
    try {
      await apiRequest('announcement_mark_read', {
        announcement_id: announcementId,
        user_id: userId
      })

      setAnnouncements(prev =>
        prev.map(a => a.id === announcementId ? { ...a, is_read: true } : a)
      )
    } catch (err) {
      console.warn('Failed to mark announcement as read', err)
    }
  }

  const handleDismiss = (announcementId: string) => {
    setDismissed(prev => new Set([...prev, announcementId]))
    markAsRead(announcementId)
    
    const remaining = announcements.filter(a => !dismissed.has(a.id) && a.id !== announcementId)
    if (remaining.length > 0) {
      setCurrentIndex(0)
      setAnnouncements(remaining)
    }
  }

  const handleNext = () => {
    const visibleAnnouncements = announcements.filter(a => !dismissed.has(a.id))
    if (currentIndex < visibleAnnouncements.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const visibleAnnouncements = announcements.filter(a => !dismissed.has(a.id))

  if (visibleAnnouncements.length === 0) {
    return null
  }

  const currentAnnouncement = visibleAnnouncements[currentIndex]

  return (
    <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800 mb-4">
      <CardContent className="p-4">
        <div className="flex gap-4 items-start">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              {currentAnnouncement.title}
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              {currentAnnouncement.message}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {new Date(currentAnnouncement.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2 items-start flex-shrink-0">
            {visibleAnnouncements.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleNext}
                className="border-blue-200 hover:bg-blue-100 dark:border-blue-800 dark:hover:bg-blue-900"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDismiss(currentAnnouncement.id)}
              className="border-blue-200 hover:bg-blue-100 dark:border-blue-800 dark:hover:bg-blue-900"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {visibleAnnouncements.length > 1 && (
          <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
            {currentIndex + 1} of {visibleAnnouncements.length} announcements
          </div>
        )}
      </CardContent>
    </Card>
  )
}
