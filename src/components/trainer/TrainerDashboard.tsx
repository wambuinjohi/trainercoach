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
import { TrainerProfileEditor } from './TrainerProfileEditor'
import { AvailabilityEditor } from './AvailabilityEditor'
import { ServicesManager } from './ServicesManager'
import { ServiceAreaEditor } from './ServiceAreaEditor'
import { TrainerChat } from './TrainerChat'
import { Payouts } from './Payouts'
import { TrainerTopUp } from './TrainerTopUp'
import { loadSettings } from '@/lib/settings'
import { toast } from '@/hooks/use-toast'
import { TrainerReportIssue } from './TrainerReportIssue'
import { TrainerDisputes } from './TrainerDisputes'
import * as apiService from '@/lib/api-service'
import { AnnouncementBanner } from '@/components/shared/AnnouncementBanner'
import { NotificationsCenter } from '@/components/client/NotificationsCenter'

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
  const [unreadNotificationsTrainer, setUnreadNotificationsTrainer] = useState(0)
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

  const openChat = (booking: any) => setChatBooking(booking)
  const closeChat = () => setChatBooking(null)

  const handleLogout = async () => {
    await signOut()
    window.location.href = '/'
  }

  const acceptBooking = (id: string) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'confirmed' } : b))
    toast({ title: 'Booking accepted', description: 'You accepted the booking.' })
  }

  const declineBooking = (id: string) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b))
    toast({ title: 'Booking declined', description: 'You declined the booking.', variant: 'destructive' })
  }

  const startSession = async (id: string) => {
    const booking = bookings.find(b => b.id === id)
    if (!booking) return

    let newStatus = ''
    if (booking.status === 'confirmed') {
      newStatus = 'in_session'
    } else if (booking.status === 'in_session') {
      newStatus = 'completed'
    } else {
      return
    }

    try {
      // Persist to database
      await apiService.updateBooking(id, {
        status: newStatus,
        ...(newStatus === 'completed' && { completed_at: new Date().toISOString() })
      })

      // Update local state
      setBookings(prev => prev.map(b => {
        if (b.id !== id) return b
        return { ...b, status: newStatus }
      }))

      // Send notification to client if session completed
      if (newStatus === 'completed') {
        try {
          const nowIso = new Date().toISOString()
          const notifRows: any[] = [
            {
              user_id: booking.client_id,
              booking_id: id,
              title: 'Session Complete',
              body: `Your session with ${profileData.name} has ended. Please rate your experience!`,
              action_type: 'rate',
              type: 'success',
              created_at: nowIso,
              read: false
            }
          ]
          await apiRequest('notifications_insert', { notifications: notifRows }, { headers: withAuth() })
        } catch (err) {
          console.warn('Failed to send completion notification', err)
        }

        // Initiate automatic payout to trainer's MPESA account
        try {
          const trainerMpesaNumber = profileData?.mpesa_number
          const trainerNetAmount = booking.trainer_net_amount || 0

          if (trainerMpesaNumber && trainerNetAmount > 0) {
            await apiService.initiateTrainerPayout({
              booking_id: id,
              trainer_id: user?.id || '',
              trainer_mpesa_number: trainerMpesaNumber,
              amount: trainerNetAmount,
              reason: 'session_completion'
            })
          }
        } catch (err) {
          console.warn('Failed to initiate automatic payout', err)
          // Don't fail the session completion if payout fails - it can be retried
        }
      }

      const msg = newStatus === 'in_session' ? 'Session started' : 'Session completed'
      toast({ title: 'Success', description: msg })
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
  const [showServiceArea, setShowServiceArea] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showDisputes, setShowDisputes] = useState(false)

  useEffect(() => {
    const loadTrainerProfile = async () => {
      if (!user?.id) return
      try {
        const profile = await apiService.getTrainerProfile(user.id)
        if (profile?.data && profile.data.length > 0) {
          const profileData = profile.data[0]
          setProfileData({
            name: profileData.full_name || user.email,
            bio: profileData.bio || 'Professional Trainer',
            profile_image: profileData.profile_image || null,
            hourly_rate: profileData.hourly_rate || 0,
            availability: profileData.availability ? (typeof profileData.availability === 'string' ? JSON.parse(profileData.availability) : profileData.availability) : [],
            pricing_packages: profileData.pricing_packages ? (typeof profileData.pricing_packages === 'string' ? JSON.parse(profileData.pricing_packages) : profileData.pricing_packages) : []
          })
        } else {
          setProfileData({
            name: user.email,
            bio: 'Professional Trainer',
            profile_image: null,
            hourly_rate: 0,
            availability: [],
            pricing_packages: []
          })
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
      }

      // Load wallet balance - handle gracefully if table doesn't exist
      try {
        const walletData = await apiService.getWalletBalance(user.id)
        if (walletData?.data && walletData.data.length > 0) {
          setWalletBalance(walletData.data[0].balance || 0)
        }
      } catch (err) {
        console.warn('Failed to load wallet balance', err)
        setWalletBalance(0)
      }
    }
    loadTrainerProfile()
  }, [user?.id])

  const loadNotifications = async () => {
    if (!user?.id) return
    try {
      const notifData = await apiRequest('notifications_get', { user_id: user.id }, { headers: withAuth() })
      const notifs = Array.isArray(notifData) ? notifData : (notifData?.data || [])
      const unreadCount = notifs.filter((n: any) => !n.read).length
      setUnreadNotificationsTrainer(unreadCount)
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

  const renderHomeContent = () => (
    <div className="space-y-6">
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

  const renderBookingsContent = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setActiveTab('home')} className="-ml-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>
      </div>
      {bookings && bookings.length > 0 ? (
        bookings.map(b => (
          <Card key={b.id || b.user_id} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-foreground">{b.client_name || 'Client'}</div>
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
                <Badge variant={b.status === 'confirmed' ? 'default' : 'secondary'}>{b.status || 'pending'}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-2">{b.session_date || 'TBD'} at {b.session_time || ''}</div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => openChat(b)}>Chat</Button>
                {(b.status === 'pending' || !b.status) && <Button size="sm" onClick={() => acceptBooking(b.id)}>Accept</Button>}
                {(b.status === 'pending' || !b.status) && <Button size="sm" onClick={() => declineBooking(b.id)}>Decline</Button>}
                {(b.status === 'confirmed' || b.status === 'in_session') && <Button size="sm" onClick={() => startSession(b.id)}>Start/End</Button>}
              </div>
            </CardContent>
          </Card>
        ))
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

      <div className="space-y-2">
        <Button className="w-full" onClick={() => setEditingProfile(true)}>Edit Profile</Button>
        <Button variant="outline" className="w-full" onClick={() => setEditingAvailability(true)}>Edit Availability</Button>
        <Button variant="outline" className="w-full" onClick={() => setShowServiceArea(true)}>Service Area</Button>
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
      {editingProfile && <TrainerProfileEditor onClose={() => setEditingProfile(false)} />}
      {editingAvailability && <AvailabilityEditor onClose={() => setEditingAvailability(false)} />}
      {showServiceArea && <ServiceAreaEditor onClose={() => setShowServiceArea(false)} />}
      {showPayouts && <Payouts onClose={() => setShowPayouts(false)} />}
      {showReport && <TrainerReportIssue onDone={() => setShowReport(false)} />}
      {showNotifications && <NotificationsCenter onClose={() => setShowNotifications(false)} />}
      {showDisputes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40 overflow-y-auto">
          <div className="w-full max-w-2xl bg-background rounded-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <TrainerDisputes onClose={() => setShowDisputes(false)} />
          </div>
        </div>
      )}
      {chatBooking && <TrainerChat booking={chatBooking} onClose={closeChat} />}
    </div>
  )
}
