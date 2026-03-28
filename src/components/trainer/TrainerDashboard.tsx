import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Calendar,
  DollarSign,
  Star,
  Users,
  MessageCircle,
  MessageSquare,
  Clock,
  MapPin,
  Settings,
  BarChart3,
  Gift,
  Plus,
  User,
  Home,
  Briefcase,
  ArrowLeft,
  LogOut,
  Bell
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { apiRequest, withAuth } from '@/lib/api'
import { ProfileEditorModal } from './ProfileEditorModal'
import { AvailabilityEditor } from './AvailabilityEditor'
import { ServicesManager } from './ServicesManager'
import { TrainerChat } from './TrainerChat'
import { Payouts } from './Payouts'
import { TrainerTopUp } from './TrainerTopUp'
import { loadSettings } from '@/lib/settings'
import { toast } from '@/hooks/use-toast'
import { TrainerReportIssue } from './TrainerReportIssue'
import { TrainerDisputes } from './TrainerDisputes'
import { TrainerDocumentsView } from './TrainerDocumentsView'
import * as apiService from '@/lib/api-service'
import { AnnouncementBanner } from '@/components/shared/AnnouncementBanner'
import { NotificationsCenter } from '@/components/client/NotificationsCenter'
import { StatusIndicator } from './StatusIndicator'
import { PromoteProfileModal } from './PromoteProfileModal'
import { TrainerAttendanceConfirmModal } from './TrainerAttendanceConfirmModal'

export const TrainerDashboard: React.FC = () => {
  const { user, userType, signOut, loading } = useAuth()
  const [activeTab, setActiveTab] = useState('home')
  const [isAvailable, setIsAvailable] = useState(true)
  const [showServicesManager, setShowServicesManager] = useState(false)
  const [monthRevenue, setMonthRevenue] = useState<number>(0)
  const [monthSessions, setMonthSessions] = useState<number>(0)


  const [bookings, setBookings] = useState<any[]>([])
  const [chatBooking, setChatBooking] = useState<any | null>(null)
  const [showPayouts, setShowPayouts] = useState(false)
  const [showTopUp, setShowTopUp] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showArchivedBookings, setShowArchivedBookings] = useState(false)
  const [showPromoteModal, setShowPromoteModal] = useState(false)
  const [unreadNotificationsTrainer, setUnreadNotificationsTrainer] = useState(0)
  const [attendanceConfirmBooking, setAttendanceConfirmBooking] = useState<any | null>(null)
  const [showAttendanceConfirmModal, setShowAttendanceConfirmModal] = useState(false)
  const [profileData, setProfileData] = useState<any>({
    name: user?.email,
    bio: 'Professional Trainer',
    profile_image: null,
    hourly_rate: 0,
    availability: [],
    pricing_packages: []
  })
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [showReviews, setShowReviews] = useState(false)
  const [reviews, setReviews] = useState<any[]>([])
  const [avgRating, setAvgRating] = useState<number>(0)
  const [accountStatus, setAccountStatus] = useState<'registered' | 'profile_incomplete' | 'pending_approval' | 'approved' | 'suspended'>('registered')
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [verificationDocuments, setVerificationDocuments] = useState<any[]>([])

  // Check for step 2 onboarding flag and redirect if needed
  useEffect(() => {
    const hasStep2Flag = localStorage.getItem('trainer_signup_step2') === 'true'
    console.log('[TrainerDashboard] Check step 2 flag:', hasStep2Flag)

    if (hasStep2Flag && userType === 'trainer') {
      console.log('[TrainerDashboard] Redirecting to signup-step2')
      window.location.href = '/signup-step2'
    }
  }, [userType])

  const openChat = (booking: any) => setChatBooking(booking)
  const closeChat = () => setChatBooking(null)
  const openPromote = () => {
    setShowPromoteModal(true)
  }

  const handleLogout = async () => {
    await signOut()
    window.location.href = '/'
  }

  const refreshProfileData = async () => {
    if (!user?.id) return
    try {
      const profile = await apiService.getTrainerProfile(user.id)
      // Handle both direct array response and wrapped response with .data property
      const profileList = Array.isArray(profile) ? profile : (profile?.data && Array.isArray(profile.data) ? profile.data : [])
      if (profileList.length > 0) {
        const profileData = profileList[0]
        setProfileData({
          name: profileData.full_name || user.email,
          bio: profileData.bio || 'Professional Trainer',
          profile_image: profileData.profile_image || null,
          hourly_rate: profileData.hourly_rate || 0,
          availability: profileData.availability ? (typeof profileData.availability === 'string' ? JSON.parse(profileData.availability) : profileData.availability) : [],
          pricing_packages: profileData.pricing_packages ? (typeof profileData.pricing_packages === 'string' ? JSON.parse(profileData.pricing_packages) : profileData.pricing_packages) : [],
          ...profileData // Include all other fields for status determination
        })

        // Use account_status from API if available, otherwise fallback to legacy fields
        if (profileData.account_status) {
          setAccountStatus(profileData.account_status)
        } else if (profileData.is_suspended) {
          setAccountStatus('suspended')
        } else if (profileData.is_approved) {
          setAccountStatus('approved')
        } else {
          // Load verification documents to check if any have been uploaded
          try {
            const docs = await apiService.getVerificationDocuments(user.id)
            const docList = Array.isArray(docs) ? docs : (docs?.data && Array.isArray(docs.data) ? docs.data : [])
            setVerificationDocuments(docList)
          } catch (err) {
            console.warn('Failed to load verification documents', err)
            setVerificationDocuments([])
          }
        }
      }
    } catch (err) {
      console.warn('Failed to refresh trainer profile', err)
    }
  }

  const acceptBooking = async (id: string) => {
    const booking = bookings.find(b => b.id === id)
    if (!booking) return

    try {
      await apiService.updateBooking(id, { status: 'confirmed', session_phase: 'waiting_start' })
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'confirmed', session_phase: 'waiting_start' } : b))
      await apiRequest('notifications_insert', {
        notifications: [{
          user_id: booking.client_id,
          booking_id: id,
          title: 'Booking confirmed',
          body: `${profileData.name} confirmed your booking. You can keep coordinating in-app for safety and complaint follow-up.`,
          action_type: 'view_booking',
          type: 'booking',
          created_at: new Date().toISOString(),
          read: false,
        }]
      }, { headers: withAuth() })
      toast({ title: 'Booking accepted', description: 'You accepted the booking.' })
    } catch (err) {
      console.error('Accept booking failed', err)
      toast({ title: 'Error', description: 'Failed to accept booking', variant: 'destructive' })
    }
  }

  const declineBooking = async (id: string) => {
    const booking = bookings.find(b => b.id === id)
    if (!booking) return

    try {
      await apiService.updateBooking(id, { status: 'cancelled' })
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b))
      await apiRequest('notifications_insert', {
        notifications: [{
          user_id: booking.client_id,
          booking_id: id,
          title: 'Booking declined',
          body: `${profileData.name} could not take this booking. Please search for another trainer.`,
          action_type: 'view_booking',
          type: 'booking',
          created_at: new Date().toISOString(),
          read: false,
        }]
      }, { headers: withAuth() })
      toast({ title: 'Booking declined', description: 'You declined the booking.', variant: 'destructive' })
    } catch (err) {
      console.error('Decline booking failed', err)
      toast({ title: 'Error', description: 'Failed to decline booking', variant: 'destructive' })
    }
  }

  const isBookingArchived = (booking: any) => {
    if (!booking.session_date) return false
    const sessionDate = new Date(booking.session_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return sessionDate < today
  }

  const startSession = async (id: string) => {
    const booking = bookings.find(b => b.id === id)
    if (!booking) return

    const isAwaitingCompletion = booking.status === 'in_session' && booking.session_phase === 'awaiting_completion'

    try {
      if (booking.status === 'confirmed') {
        await apiService.updateBooking(id, {
          status: 'in_session',
          session_phase: 'session_active',
          trainer_marked_start: true,
          trainer_marked_end: false,
          started_at: new Date().toISOString(),
        })

        setBookings(prev => prev.map(b => (
          b.id === id
            ? { ...b, status: 'in_session', session_phase: 'session_active', trainer_marked_start: true, trainer_marked_end: false }
            : b
        )))

        await apiRequest('notifications_insert', {
          notifications: [{
            user_id: booking.client_id,
            booking_id: id,
            title: 'Session starting',
            body: `${profileData.name} marked the session as started. Please confirm from your app when you are ready.`,
            action_type: 'start_session',
            type: 'session',
            created_at: new Date().toISOString(),
            read: false,
          }]
        }, { headers: withAuth() })

        toast({ title: 'Session started', description: 'The client has been notified.' })
        return
      }

      if (booking.status === 'in_session' && !isAwaitingCompletion) {
        await apiService.updateBooking(id, {
          status: 'in_session',
          session_phase: 'awaiting_completion',
          trainer_marked_end: true,
          ended_at: new Date().toISOString(),
        })

        setBookings(prev => prev.map(b => (
          b.id === id
            ? { ...b, status: 'in_session', session_phase: 'awaiting_completion', trainer_marked_end: true }
            : b
        )))

        await apiRequest('notifications_insert', {
          notifications: [{
            user_id: booking.client_id,
            booking_id: id,
            title: 'Session ended by trainer',
            body: `${profileData.name} marked the session as ended. Please confirm completion in your app.`,
            action_type: 'complete_session',
            type: 'session',
            created_at: new Date().toISOString(),
            read: false,
          }]
        }, { headers: withAuth() })

        toast({ title: 'Session ended', description: 'Waiting for client confirmation.' })
        return
      }

      if (isAwaitingCompletion) {
        toast({ title: 'Waiting on client', description: 'The client still needs to confirm session completion.' })
        return
      }
    } catch (err) {
      console.error('Failed to update booking', err)
      toast({ title: 'Error', description: 'Failed to update session status', variant: 'destructive' })
    }
  }

  useEffect(() => {
    const loadBookings = async () => {
      if (!user?.id) return
      try {
        const bookingsData = await apiService.getBookings(user.id, 'trainer')
        if (bookingsData?.data && Array.isArray(bookingsData.data)) {
          setBookings(bookingsData.data)

          // Calculate month stats
          const now = new Date()
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          const monthBookings = bookingsData.data.filter((b: any) => b.session_date && new Date(b.session_date) >= monthStart)
          setMonthSessions(monthBookings.length)

          const monthRevenue = monthBookings.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0)
          setMonthRevenue(monthRevenue)
        } else {
          setBookings([])
        }
      } catch (err) {
        console.warn('Failed to load trainer bookings', err)
        setBookings([])
      }
    }
    loadBookings()
  }, [user?.id])

  useEffect(() => {
    const loadReviews = async () => {
      if (!user?.id || !showReviews) return
      try {
        const reviewsData = await apiService.getReviews(user.id)
        if (reviewsData?.data && Array.isArray(reviewsData.data)) {
          setReviews(reviewsData.data)
          if (reviewsData.data.length > 0) {
            const avgRate = reviewsData.data.reduce((sum: number, r: any) => sum + (Number(r.rating) || 0), 0) / reviewsData.data.length
            setAvgRating(avgRate)
          }
        } else {
          setReviews([])
        }
      } catch (err) {
        console.warn('Failed to load trainer reviews', err)
        setReviews([])
      }
    }
    loadReviews()
  }, [user?.id, showReviews])

  const [editingProfile, setEditingProfile] = useState(false)
  const [editingAvailability, setEditingAvailability] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showDisputes, setShowDisputes] = useState(false)

  useEffect(() => {
    const loadTrainerProfile = async () => {
      if (!user?.id) return
      try {
        const profile = await apiService.getTrainerProfile(user.id)
        // Handle both direct array response and wrapped response with .data property
        const profileList = Array.isArray(profile) ? profile : (profile?.data && Array.isArray(profile.data) ? profile.data : [])
        if (profileList.length > 0) {
          const profileData = profileList[0]
          setProfileData({
            name: profileData.full_name || user.email,
            bio: profileData.bio || 'Professional Trainer',
            profile_image: profileData.profile_image || null,
            hourly_rate: profileData.hourly_rate || 0,
            availability: profileData.availability ? (typeof profileData.availability === 'string' ? JSON.parse(profileData.availability) : profileData.availability) : [],
            pricing_packages: profileData.pricing_packages ? (typeof profileData.pricing_packages === 'string' ? JSON.parse(profileData.pricing_packages) : profileData.pricing_packages) : [],
            ...profileData // Include all other fields for status determination
          })

          // Use account_status from API if available, otherwise fallback to legacy fields
          if (profileData.account_status) {
            setAccountStatus(profileData.account_status)
          } else if (profileData.is_suspended) {
            setAccountStatus('suspended')
          } else if (profileData.is_approved) {
            setAccountStatus('approved')
          } else {
            // Load verification documents to check if any have been uploaded
            try {
              const docs = await apiService.getVerificationDocuments(user.id)
              const docList = Array.isArray(docs) ? docs : (docs?.data && Array.isArray(docs.data) ? docs.data : [])
              setVerificationDocuments(docList)
            } catch (err) {
              console.warn('Failed to load verification documents', err)
              setVerificationDocuments([])
            }
            // Status will be determined by a separate useEffect after all data is loaded
          }
        } else {
          setProfileData({
            name: user.email,
            bio: 'Professional Trainer',
            profile_image: null,
            hourly_rate: 0,
            availability: [],
            pricing_packages: []
          })
          setAccountStatus('registered')
        }
      } catch (err) {
        console.warn('Failed to load trainer profile', err)
        setProfileData({
          name: user.email,
          bio: 'Professional Trainer',
          profile_image: null,
          hourly_rate: 0,
          availability: [],
          pricing_packages: []
        })
        setAccountStatus('registered')
      }

      // Load wallet balance - handle gracefully if table doesn't exist
      try {
        const walletData = await apiService.getWalletBalance(user.id)
        // Handle both direct array response and wrapped response with .data property
        const walletList = Array.isArray(walletData) ? walletData : (walletData?.data && Array.isArray(walletData.data) ? walletData.data : [])
        if (walletList.length > 0) {
          setWalletBalance(walletList[0].balance || 0)
        }
      } catch (err) {
        console.warn('Failed to load wallet balance', err)
        setWalletBalance(0)
      }
    }

    const loadCategories = async () => {
      if (!user?.id) return
      try {
        // Load all available categories
        const categoriesData = await apiService.getCategories()
        const allCategories = categoriesData?.data || []
        setCategories(allCategories)

        // Load trainer's selected categories
        const trainerCategoriesData = await apiService.getTrainerCategories(user.id)
        const trainerCategoryIds = trainerCategoriesData?.data?.map((tc: any) => String(tc.category_id || tc.id)) || []
        setSelectedCategoryIds(trainerCategoryIds)
      } catch (err) {
        console.warn('Failed to load categories', err)
        setCategories([])
        setSelectedCategoryIds([])
      }
    }

    loadTrainerProfile()
    loadCategories()
  }, [user?.id])

  // Separate effect to determine account status after all data is loaded
  useEffect(() => {
    // Skip if no user
    if (!user?.id) return

    // If account_status is explicitly set from API, use it
    if (profileData.account_status) {
      setAccountStatus(profileData.account_status)
      return
    }

    // Check for suspended or approved status
    if (profileData.is_suspended) {
      setAccountStatus('suspended')
      return
    }

    if (profileData.is_approved) {
      setAccountStatus('approved')
      return
    }

    // If documents have been uploaded, trainer is waiting for approval
    if (verificationDocuments && verificationDocuments.length > 0) {
      setAccountStatus('pending_approval')
      return
    }

    // No documents yet - check if profile is complete
    // Core required fields for profile completion
    const hasRate = !!profileData.hourly_rate
    const hasServiceArea = !!profileData.area_of_residence && !!profileData.service_radius
    const hasMpesa = !!profileData.mpesa_number

    // Optional but helpful fields
    const hasName = !!profileData.full_name
    const hasCategories = selectedCategoryIds && selectedCategoryIds.length > 0

    console.log('[Status Check] Profile completeness:', {
      hasRate,
      hasServiceArea,
      hasMpesa,
      hasName,
      hasCategories,
      full_name: profileData.full_name,
      hourly_rate: profileData.hourly_rate,
      area_of_residence: profileData.area_of_residence,
      service_radius: profileData.service_radius,
      mpesa_number: profileData.mpesa_number,
      selectedCategoryIds: selectedCategoryIds?.length || 0
    })

    // Profile is complete if it has the core required fields
    // (rate, service area, and M-Pesa payment method)
    if (hasRate && hasServiceArea && hasMpesa) {
      // Profile is complete, documents not yet uploaded
      setAccountStatus('profile_incomplete')
    } else {
      // Profile incomplete
      setAccountStatus('registered')
    }
  }, [profileData, selectedCategoryIds, verificationDocuments, user?.id])

  const loadNotifications = async () => {
    if (!user?.id) return
    try {
      const notifData = await apiRequest('notifications_get', { user_id: user.id }, { headers: withAuth() })
      const notifs = Array.isArray(notifData) ? notifData : (notifData?.data || [])
      const unreadCount = notifs.filter((n: any) => !n.read).length
      setUnreadNotificationsTrainer(unreadCount)

      // Check for pending attendance confirmation (unread notifications with confirm_attendance action_type)
      const pendingAttendanceNotif = notifs.find(
        (n: any) => !n.read && n.action_type === 'confirm_attendance'
      )

      if (pendingAttendanceNotif && pendingAttendanceNotif.booking_id) {
        // Find the booking that needs confirmation
        const booking = bookings.find(b => b.id === pendingAttendanceNotif.booking_id)
        if (booking && booking.status === 'pending') {
          setAttendanceConfirmBooking(booking)
          setShowAttendanceConfirmModal(true)
        }
      }
    } catch (err) {
      console.warn('Failed to load notifications', err)
    }
  }

  // Load notifications on mount and poll periodically
  useEffect(() => {
    if (!user?.id) return
    loadNotifications()

    const notificationInterval = setInterval(loadNotifications, 10000) // Poll every 10 seconds
    return () => clearInterval(notificationInterval)
  }, [user?.id])

  const renderAccountStatus = () => {
    const statuses = [
      { key: 'registered', label: 'Registered', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
      { key: 'profile_incomplete', label: 'Complete Profile', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      { key: 'pending_approval', label: 'Pending Approval', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      { key: 'approved', label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      { key: 'suspended', label: 'Suspended', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    ]

    const currentStatus = statuses.find(s => s.key === accountStatus)
    if (!currentStatus) return null

    const completedSteps = statuses.slice(0, statuses.findIndex(s => s.key === accountStatus) + 1)
    const nextSteps = statuses.slice(statuses.findIndex(s => s.key === accountStatus) + 1)

    return (
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <CardTitle className="text-base">Account Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <span className={`inline-block px-4 py-2 rounded-full font-semibold text-sm ${currentStatus.color}`}>
              {currentStatus.label}
            </span>
            {accountStatus === 'suspended' && (
              <span className="text-xs text-red-600 dark:text-red-400 font-semibold">Action Required</span>
            )}
          </div>

          <div className="space-y-2">
            {completedSteps.map((step) => (
              <div key={step.key} className="flex items-center gap-2 text-sm">
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                <span className="text-foreground">{step.label}</span>
              </div>
            ))}
            {nextSteps.map((step) => (
              <div key={step.key} className="flex items-center gap-2 text-sm">
                <div className="w-4 h-4 rounded-full border-2 border-muted-foreground"></div>
                <span className="text-muted-foreground">{step.label}</span>
              </div>
            ))}
          </div>

          {accountStatus === 'registered' && (
            <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => setEditingProfile(true)}>
              Complete Your Profile
            </Button>
          )}
          {accountStatus === 'profile_incomplete' && (
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded">
              Your profile is complete. Submit your verification documents to proceed to approval.
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderHomeContent = () => {
    const selectedCategories = (categories || []).filter((cat: any) => selectedCategoryIds.includes(String(cat.id)))

    return (
    <div className="space-y-6">
      <StatusIndicator
        status={accountStatus}
        profileData={{
          full_name: profileData.name,
          profile_image: profileData.profile_image,
          bio: profileData.bio,
          hourly_rate: profileData.hourly_rate,
          service_radius: profileData.service_radius,
          area_of_residence: profileData.area_of_residence,
          mpesa_number: profileData.mpesa_number,
          selectedCategories: selectedCategories,
          grace_period: profileData.good_conduct_grace_period_end ? {
            status: new Date(profileData.good_conduct_grace_period_end) > new Date() ? 'active' : 'expired',
            start_date: profileData.good_conduct_grace_period_start,
            end_date: profileData.good_conduct_grace_period_end,
            reason: 'Certificate of Good Conduct renewal'
          } : undefined
        }}
        onAction={() => setEditingProfile(true)}
      />
      <div className="flex items-center justify-between mb-4">
        <div></div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotifications(true)}
            className="relative text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-5 w-5" />
            {unreadNotificationsTrainer > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground rounded-full text-xs">
                {unreadNotificationsTrainer > 9 ? '9+' : unreadNotificationsTrainer}
              </Badge>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <AnnouncementBanner userId={user?.id} userType="trainer" />
      {profileData.profile_image && (
        <div className="mb-6 rounded-lg overflow-hidden h-48 w-full">
          <img
            src={profileData.profile_image}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-foreground">Welcome back!</h1>
        <p className="text-muted-foreground">Ready to inspire and train today?</p>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">This Month</div>
            <div className="text-2xl font-bold text-foreground mt-2">Ksh {monthRevenue.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Revenue</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Sessions</div>
            <div className="text-2xl font-bold text-foreground mt-2">{monthSessions}</div>
            <div className="text-xs text-muted-foreground mt-1">This month</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Wallet</div>
            <div className="text-2xl font-bold text-foreground mt-2">Ksh {walletBalance.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Available balance</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Messages</div>
            <div className="text-2xl font-bold text-foreground mt-2">{unreadMessages}</div>
            <div className="text-xs text-muted-foreground mt-1">Unread</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="w-full h-14 flex flex-col items-center justify-center gap-1" onClick={() => setEditingProfile(true)}>
            <User className="h-4 w-4" />
            <span className="text-sm">Edit Profile</span>
          </Button>
          <Button variant="outline" className="w-full h-14 flex flex-col items-center justify-center gap-1" onClick={() => setEditingAvailability(true)}>
            <Clock className="h-4 w-4" />
            <span className="text-sm">Set Hours</span>
          </Button>
          <Button variant="outline" className="w-full h-14 flex flex-col items-center justify-center gap-1" onClick={() => setShowPayouts(true)}>
            <DollarSign className="h-4 w-4" />
            <span className="text-sm">Payouts</span>
          </Button>
          <Button variant="outline" className="w-full h-14 flex flex-col items-center justify-center gap-1" onClick={() => setShowDisputes(true)}>
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm">Disputes</span>
          </Button>
          <Button variant="outline" className="w-full h-14 flex flex-col items-center justify-center gap-1" onClick={openPromote}>
            <Star className="h-4 w-4" />
            <span className="text-sm">Promote</span>
          </Button>
          <Button variant="outline" className="w-full h-14 flex flex-col items-center justify-center gap-1" onClick={() => setShowReport(true)}>
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm">Report Issue</span>
          </Button>
        </div>
      </div>
    </div>
    )
  }

  const renderBookingsContent = () => {
    const activeBookings = bookings.filter(b => !isBookingArchived(b))
    const archivedBookings = bookings.filter(b => isBookingArchived(b))

    const renderBookingCard = (b: any, isArchived: boolean = false) => {
      const bookingSessions = (() => {
        const sessionsValue = b?.sessions
        if (Array.isArray(sessionsValue)) return sessionsValue
        if (typeof sessionsValue === 'string' && sessionsValue.trim()) {
          try {
            const parsed = JSON.parse(sessionsValue)
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        }
        return []
      })()
      const primarySession = bookingSessions[0]
      return (
      <Card key={b.id || b.user_id} className={`bg-card border-border ${isArchived ? 'opacity-60' : ''}`}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className={`font-semibold ${isArchived ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {b.client_name || 'Client'}
              </div>
              {isArchived && (
                <Badge variant="outline" className="mt-2 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 text-xs">
                  Archived
                </Badge>
              )}
              {b.is_group_training && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    Group Training
                  </Badge>
                  {b.group_size_tier_name && (
                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs">
                      {b.group_size_tier_name}
                    </Badge>
                  )}
                  {b.pricing_model_used && (
                    <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800">
                      {b.pricing_model_used === 'per_person' ? 'Per Person' : 'Fixed Rate'}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <Badge variant={b.status === 'confirmed' ? 'default' : b.status === 'in_session' ? 'secondary' : 'secondary'}>
              {b.status === 'in_session' && b.session_phase === 'awaiting_completion' ? 'Awaiting completion' : b.status || 'pending'}
            </Badge>
          </div>
          <div className={`text-sm mt-2 ${isArchived ? 'text-muted-foreground line-through' : 'text-muted-foreground'}`}>
            {b.session_date || 'TBD'} at {b.session_time || ''}
          </div>
          {bookingSessions.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {bookingSessions.length === 1
                ? `Single session on ${primarySession?.date || b.session_date}`
                : `${bookingSessions.length} sessions total • first on ${primarySession?.date || b.session_date}`}
            </div>
          )}
          {!isArchived && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => openChat(b)}>Chat</Button>
              {(b.status === 'pending' || !b.status) && <Button size="sm" onClick={() => acceptBooking(b.id)}>Accept</Button>}
              {(b.status === 'pending' || !b.status) && <Button size="sm" onClick={() => declineBooking(b.id)}>Decline</Button>}
              {b.status === 'confirmed' && <Button size="sm" onClick={() => startSession(b.id)}>Start Session</Button>}
              {b.status === 'in_session' && b.session_phase !== 'awaiting_completion' && <Button size="sm" onClick={() => startSession(b.id)}>End Session</Button>}
              {b.status === 'in_session' && b.session_phase === 'awaiting_completion' && <Button size="sm" variant="secondary" onClick={() => startSession(b.id)}>Awaiting Client</Button>}
            </div>
          )}
        </CardContent>
      </Card>
    )
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setActiveTab('home')} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>
        </div>

        {bookings && bookings.length > 0 ? (
          <>
            {/* Active Bookings */}
            <div className="space-y-4">
              {activeBookings.length > 0 && (
                <>
                  <h2 className="text-lg font-semibold text-foreground">Active Bookings ({activeBookings.length})</h2>
                  {activeBookings.map(b => renderBookingCard(b, false))}
                </>
              )}
              {activeBookings.length === 0 && archivedBookings.length > 0 && (
                <Card className="bg-card border-border">
                  <CardContent className="p-8 text-center">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No active bookings</p>
                    <p className="text-sm text-muted-foreground mt-1">You have {archivedBookings.length} archived booking(s)</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Archived Bookings */}
            {archivedBookings.length > 0 && (
              <div className="space-y-4 pt-6 border-t border-border">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Archived Bookings ({archivedBookings.length})</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowArchivedBookings(!showArchivedBookings)}
                  >
                    {showArchivedBookings ? 'Hide' : 'Show'}
                  </Button>
                </div>
                {showArchivedBookings && (
                  <div className="space-y-4">
                    {archivedBookings.map(b => renderBookingCard(b, true))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No bookings yet</p>
              <p className="text-sm text-muted-foreground mt-1">Your bookings will appear here</p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const renderProfileContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setActiveTab('home')} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-bold text-foreground">Profile</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
      <div className="text-center">
        <div className="w-24 h-24 rounded-full bg-gradient-primary flex items-center justify-center text-3xl mx-auto mb-4 overflow-hidden border-4 border-card shadow-lg">
          {profileData.profile_image ? (
            <img
              src={profileData.profile_image}
              alt={profileData.name || 'Profile'}
              className="w-full h-full object-cover"
            />
          ) : (
            '💪'
          )}
        </div>
        <h1 className="text-2xl font-bold text-foreground">{profileData.name}</h1>
        <p className="text-muted-foreground mt-2">{profileData.bio}</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Hourly Rate</p>
            <p className="text-lg font-semibold text-foreground">Ksh {profileData.hourly_rate}</p>
          </div>
          {profileData.availability && typeof profileData.availability === 'object' && Object.keys(profileData.availability).length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Availability</p>
              <div className="text-sm text-foreground space-y-1">
                {Object.entries(profileData.availability as any).map(([day, slots]: any) => {
                  const hasSlotsToday = Array.isArray(slots) && slots.length > 0
                  return hasSlotsToday ? (
                    <div key={day} className="flex justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{day}</span>
                      <span className="text-foreground">{slots.join(', ')}</span>
                    </div>
                  ) : null
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Documents View */}
      {user?.id && <TrainerDocumentsView trainerId={user.id} />}

      <div className="space-y-2">
        <Button className="w-full" onClick={() => setEditingProfile(true)}>Edit Profile</Button>
        <Button variant="outline" className="w-full" onClick={() => setEditingAvailability(true)}>Edit Availability</Button>
        <Button variant="destructive" className="w-full" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />Logout</Button>
      </div>
    </div>
  )

  const renderDisputesContent = () => (
    <div className="space-y-6">
      <TrainerDisputes onClose={() => setActiveTab('home')} />
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return renderHomeContent()
      case 'bookings': return renderBookingsContent()
      case 'profile': return renderProfileContent()
      case 'disputes': return renderDisputesContent()
      default: return renderHomeContent()
    }
  }

  if (loading) return null
  if (!user || userType !== 'trainer') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 overflow-auto pb-20">
        <div className="container max-w-md mx-auto p-4">
          {renderContent()}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="container max-w-md mx-auto">
          <div className="flex items-center justify-around py-2">
            <Button variant={activeTab === 'home' ? 'default' : 'ghost'} onClick={() => setActiveTab('home')} size="sm"><Home className="h-5 w-5" /></Button>
            <Button variant={activeTab === 'bookings' ? 'default' : 'ghost'} onClick={() => setActiveTab('bookings')} size="sm"><Calendar className="h-5 w-5" /></Button>
            <Button variant="ghost" onClick={() => setShowServicesManager(true)} size="sm"><Plus className="h-5 w-5" /></Button>
            <Button variant={activeTab === 'profile' ? 'default' : 'ghost'} onClick={() => setActiveTab('profile')} size="sm"><User className="h-5 w-5" /></Button>
          </div>
        </div>
      </div>

      {showServicesManager && <ServicesManager onClose={() => setShowServicesManager(false)} />}
      <ProfileEditorModal isOpen={editingProfile} onClose={() => setEditingProfile(false)} onProfileSaved={refreshProfileData} />
      {editingAvailability && <AvailabilityEditor onClose={() => setEditingAvailability(false)} />}
      {showPayouts && <Payouts onClose={() => setShowPayouts(false)} />}
      {showReport && <TrainerReportIssue onDone={() => setShowReport(false)} />}
      {showNotifications && <NotificationsCenter onClose={() => setShowNotifications(false)} />}
      <PromoteProfileModal
        isOpen={showPromoteModal}
        onClose={() => setShowPromoteModal(false)}
        onSuccess={() => setShowPromoteModal(false)}
        currentPromotionTier={profileData.promotion_tier || 'standard'}
      />
      {showDisputes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40 overflow-y-auto">
          <div className="w-full max-w-2xl bg-background rounded-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <TrainerDisputes onClose={() => setShowDisputes(false)} />
          </div>
        </div>
      )}
      {chatBooking && <TrainerChat booking={chatBooking} onClose={closeChat} />}
      {attendanceConfirmBooking && (
        <TrainerAttendanceConfirmModal
          booking={attendanceConfirmBooking}
          isOpen={showAttendanceConfirmModal}
          onClose={() => {
            setShowAttendanceConfirmModal(false)
            setAttendanceConfirmBooking(null)
          }}
          onSuccess={() => {
            setShowAttendanceConfirmModal(false)
            setAttendanceConfirmBooking(null)
            loadBookings()
            loadNotifications()
          }}
          trainerProfile={profileData}
        />
      )}
    </div>
  )
}
