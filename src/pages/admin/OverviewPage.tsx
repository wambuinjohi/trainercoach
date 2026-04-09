import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, UserCheck, AlertCircle, Calendar, DollarSign, TrendingUp, Megaphone, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import * as apiService from '@/lib/api-service'
import { getActivityFeed, getAnalyticsTimeSeries, getDashboardOverview, getTrainerMetrics, type ActivityEvent } from '@/lib/analytics-service'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

type ActivityItem = {
  id: string
  timestamp: string
  message: string
  tone: 'positive' | 'neutral' | 'alert'
}

type AnalyticsPoint = {
  rawDate: string
  revenue: number
  bookings: number
  aov: number
}

const monthFormatter = new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' })

export default function OverviewPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTrainers: 0,
    totalClients: 0,
    totalAdmins: 0,
    totalBookings: 0,
    totalRevenue: 0,
    pendingApprovals: 0,
    activeDisputes: 0,
    pendingDocuments: 0,
  })
  const [analyticsPoints, setAnalyticsPoints] = useState<AnalyticsPoint[]>([])
  const [range, setRange] = useState<'30d' | '90d' | '12m'>('12m')
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [recentBroadcasts, setRecentBroadcasts] = useState<any[]>([])

  const activityToneColors: Record<string, string> = {
    positive: 'bg-blue-500',
    neutral: 'bg-blue-500',
    alert: 'bg-yellow-500',
  }

  const formatActivityTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return timestamp
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const formatActivityMessage = (event: ActivityEvent) => {
    switch (event.eventType) {
      case 'booking_created':
        return 'A new booking was created'
      case 'payment_completed':
        return 'A payment was completed successfully'
      case 'session_started':
        return 'A session has started'
      case 'session_completed':
        return 'A session has been completed'
      case 'review_submitted':
        return 'A client submitted a review'
      case 'trainer_approved':
        return 'A trainer was approved'
      case 'dispute_created':
        return 'A new dispute needs attention'
      case 'dispute_resolved':
        return 'A dispute was resolved'
      default:
        return 'Platform activity was recorded'
    }
  }

  const getActivityTone = (event: ActivityEvent): ActivityItem['tone'] => {
    if (event.eventType === 'dispute_created') return 'alert'
    if (event.eventType === 'payment_completed' || event.eventType === 'session_completed' || event.eventType === 'trainer_approved') return 'positive'
    return 'neutral'
  }

  const loadData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true)
      }

      // Load announcement broadcast history from localStorage
      const stored = localStorage.getItem('announcement_broadcast_history')
      if (stored) {
        try {
          const history = JSON.parse(stored)
          // Get the 2 most recent broadcasts
          setRecentBroadcasts(history.slice(0, 2))
        } catch (err) {
          console.warn('Failed to parse broadcast history', err)
        }
      }

      const [dashboard, trainerMetrics, analyticsTimeline, activityEvents, issuesData] = await Promise.all([
        getDashboardOverview(),
        getTrainerMetrics(),
        getAnalyticsTimeSeries(),
        getActivityFeed(4),
        apiService.getIssuesWithPagination({ page: 1, pageSize: 100 }),
      ])

      let documentsData = []
      // Check if auth token is available before making authenticated API call
      const authToken = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null
      if (authToken) {
        try {
          documentsData = await apiService.listVerificationDocuments('pending')
        } catch (docError) {
          console.warn('Failed to load verification documents:', docError)
          documentsData = []
        }
      } else {
        console.warn('Auth token not available, skipping verification documents load')
        documentsData = []
      }

      const documents = Array.isArray(documentsData) ? documentsData : (documentsData?.data && Array.isArray(documentsData.data) ? documentsData.data : [])
      const activeDisputes = issuesData?.data?.filter((issue: any) => issue.status !== 'resolved')?.length || 0
      const totalClients = dashboard.users?.totalClients || 0
      const totalTrainers = trainerMetrics?.activeTrainers ?? dashboard.users?.totalTrainers ?? 0
      const totalAdmins = dashboard.users?.totalAdmins || 0
      const totalUsers = totalClients + (dashboard.users?.totalTrainers || 0) + totalAdmins
      const totalBookings = dashboard.bookings?.total || 0
      const totalRevenue = dashboard.revenue?.totalRevenue || 0
      const pendingApprovals = dashboard.approvals?.totalPending || 0
      const pendingDocuments = documents.filter((document: any) => document.status === 'pending').length

      setStats({
        totalUsers,
        totalTrainers,
        totalClients,
        totalAdmins,
        totalBookings,
        totalRevenue,
        pendingApprovals,
        activeDisputes,
        pendingDocuments,
      })

      setAnalyticsPoints(analyticsTimeline)

      const fallbackActivities: ActivityItem[] = [
        {
          id: 'fallback-bookings',
          timestamp: new Date().toISOString(),
          message: `${totalBookings} total bookings recorded`,
          tone: 'positive',
        },
        {
          id: 'fallback-documents',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          message: `${pendingDocuments} verification documents pending review`,
          tone: 'alert',
        },
        {
          id: 'fallback-approvals',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          message: `${pendingApprovals} trainer applications pending approval`,
          tone: 'alert',
        },
        {
          id: 'fallback-disputes',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          message: `${activeDisputes} active disputes`,
          tone: 'alert',
        },
      ]

      setActivityFeed(
        activityEvents && activityEvents.length > 0
          ? activityEvents.map((event) => ({
              id: event.id,
              timestamp: event.timestamp,
              message: formatActivityMessage(event),
              tone: getActivityTone(event),
            }))
          : fallbackActivities
      )
    } catch (error) {
      console.error('Failed to load overview data:', error)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadData(true)

    const refreshInterval = setInterval(() => {
      loadData(false)
    }, 30000)

    return () => clearInterval(refreshInterval)
  }, [loadData])

  const revenueSeries = useMemo(() => {
    if (!analyticsPoints.length) return []

    const now = new Date()
    const start = new Date(now)
    if (range === '30d') {
      start.setDate(start.getDate() - 30)
    } else if (range === '90d') {
      start.setDate(start.getDate() - 90)
    } else {
      start.setMonth(start.getMonth() - 12)
    }

    const filtered = analyticsPoints.filter((point) => {
      const pointDate = new Date(point.rawDate)
      return pointDate >= start && pointDate <= now
    })

    if (!filtered.length) return []

    if (range === '12m') {
      const monthly = new Map<string, { order: number; revenue: number; bookings: number; month: string }>()
      filtered.forEach((point) => {
        const date = new Date(point.rawDate)
        const order = date.getFullYear() * 12 + date.getMonth()
        const key = `${date.getFullYear()}-${date.getMonth()}`
        const bucket = monthly.get(key) || { order, revenue: 0, bookings: 0, month: monthFormatter.format(date) }
        bucket.revenue += point.revenue
        bucket.bookings += point.bookings
        monthly.set(key, bucket)
      })
      return Array.from(monthly.values())
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          month: item.month,
          revenue: Number(item.revenue.toFixed(2)),
          bookings: item.bookings,
          aov: item.bookings ? Number((item.revenue / item.bookings).toFixed(2)) : 0,
        }))
    }

    return filtered
      .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())
      .map((point) => ({
        month: point.rawDate,
        revenue: Number(point.revenue.toFixed(2)),
        bookings: point.bookings,
        aov: Number(point.aov.toFixed(2)),
      }))
  }, [analyticsPoints, range])

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading overview...</div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Admin Dashboard</h1>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-blue-50/40 to-blue-50/20 dark:from-blue-950/20 dark:to-blue-950/10 border-blue-200/30 dark:border-blue-900/30 hover:shadow-md transition-all duration-300 hover:border-blue-200/50 dark:hover:border-blue-900/50">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-center gap-3 sm:gap-4 flex-col sm:flex-row">
              <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0 ring-1 ring-blue-500/20">
                <Users className="h-5 sm:h-6 w-5 sm:w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-center sm:text-left flex-1">
                <p className="text-xl sm:text-3xl font-bold text-foreground">{stats.totalUsers.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50/40 to-blue-50/20 dark:from-blue-950/20 dark:to-blue-950/10 border-blue-200/30 dark:border-blue-900/30 hover:shadow-md transition-all duration-300 hover:border-blue-200/50 dark:hover:border-blue-900/50">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-center gap-3 sm:gap-4 flex-col sm:flex-row">
              <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0 ring-1 ring-blue-500/20">
                <UserCheck className="h-5 sm:h-6 w-5 sm:w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-center sm:text-left flex-1">
                <p className="text-xl sm:text-3xl font-bold text-foreground">{stats.totalTrainers}</p>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">Active Trainers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50/40 to-purple-50/20 dark:from-purple-950/20 dark:to-purple-950/10 border-purple-200/30 dark:border-purple-900/30 hover:shadow-md transition-all duration-300 hover:border-purple-200/50 dark:hover:border-purple-900/50">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-center gap-3 sm:gap-4 flex-col sm:flex-row">
              <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0 ring-1 ring-purple-500/20">
                <Calendar className="h-5 sm:h-6 w-5 sm:w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-center sm:text-left flex-1">
                <p className="text-xl sm:text-3xl font-bold text-foreground">{stats.totalBookings.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">Total Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50/40 to-emerald-50/20 dark:from-emerald-950/20 dark:to-emerald-950/10 border-emerald-200/30 dark:border-emerald-900/30 hover:shadow-md transition-all duration-300 hover:border-emerald-200/50 dark:hover:border-emerald-900/50">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-center gap-3 sm:gap-4 flex-col sm:flex-row">
              <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0 ring-1 ring-emerald-500/20">
                <DollarSign className="h-5 sm:h-6 w-5 sm:w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-center sm:text-left flex-1">
                <p className="text-xl sm:text-3xl font-bold text-foreground">Ksh {stats.totalRevenue.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-amber-50/60 to-amber-50/30 dark:from-amber-950/20 dark:to-amber-950/10 border-amber-200/40 dark:border-amber-900/30 hover:shadow-md transition-all duration-300 hover:border-amber-200/60 dark:hover:border-amber-900/50">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0 ring-1 ring-amber-500/20">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm sm:text-base text-foreground">Pending Documents</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stats.pendingDocuments} document{stats.pendingDocuments !== 1 ? 's' : ''} need{stats.pendingDocuments === 1 ? 's' : ''} review</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/document-review')} className="w-full sm:w-auto flex-shrink-0 border-amber-200/40 dark:border-amber-900/40 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 font-medium">
                Review
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50/60 to-orange-50/30 dark:from-orange-950/20 dark:to-orange-950/10 border-orange-200/40 dark:border-orange-900/30 hover:shadow-md transition-all duration-300 hover:border-orange-200/60 dark:hover:border-orange-900/50">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0 ring-1 ring-orange-500/20">
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm sm:text-base text-foreground">Pending Approvals</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stats.pendingApprovals} trainer application{stats.pendingApprovals !== 1 ? 's' : ''} need{stats.pendingApprovals === 1 ? 's' : ''} review</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/approvals')} className="w-full sm:w-auto flex-shrink-0 border-orange-200/40 dark:border-orange-900/40 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 text-orange-700 dark:text-orange-300 hover:text-orange-800 dark:hover:text-orange-200 font-medium">
                Review
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50/60 to-red-50/30 dark:from-red-950/20 dark:to-red-950/10 border-red-200/40 dark:border-red-900/30 hover:shadow-md transition-all duration-300 hover:border-red-200/60 dark:hover:border-red-900/50">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0 ring-1 ring-red-500/20">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm sm:text-base text-foreground">Active Disputes</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stats.activeDisputes} case{stats.activeDisputes !== 1 ? 's' : ''} require{stats.activeDisputes === 1 ? 's' : ''} attention</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/disputes')} className="w-full sm:w-auto flex-shrink-0 border-red-200/40 dark:border-red-900/40 hover:bg-red-50/50 dark:hover:bg-red-950/30 text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 font-medium">
                Handle
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Announcement Preview */}
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/40 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-3 sm:pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-primary/10 flex items-center justify-center ring-1 ring-gradient-primary/20">
                <Megaphone className="h-5 w-5 text-primary flex-shrink-0" />
              </div>
              <CardTitle className="text-foreground text-base sm:text-lg font-bold">Recent Announcements</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/announcements')} className="w-full sm:w-auto border-border/40 hover:bg-muted/50 font-medium">
              <span className="hidden sm:inline">Manage Announcements</span>
              <span className="sm:hidden">Manage</span>
              <ArrowRight className="h-3.5 sm:h-4 w-3.5 sm:w-4 ml-2" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentBroadcasts.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {recentBroadcasts.map((broadcast) => (
                <div key={broadcast.id} className="p-3 sm:p-4 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 hover:border-border/60 transition-all duration-200 cursor-pointer group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">{broadcast.title}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-2 line-clamp-2">{broadcast.message}</p>
                      <div className="flex items-center gap-2 sm:gap-3 mt-3 text-xs text-muted-foreground font-medium">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary">{broadcast.recipientCount} {broadcast.recipientType === 'all' ? 'users' : broadcast.recipientType}</span>
                        <span>•</span>
                        <span>{new Date(broadcast.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 sm:py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Megaphone className="h-7 w-7 text-muted-foreground opacity-50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">No announcements sent yet</p>
              <p className="text-xs text-muted-foreground mb-4">Start engaging with your community by creating your first announcement</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/announcements')} className="border-border/40 hover:bg-muted/50 font-medium">
                Create your first announcement
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Chart */}
      {revenueSeries.length > 0 && (
        <Card className="bg-gradient-to-br from-card to-card/50 border-border/40 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-4 sm:pb-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <CardTitle className="text-foreground text-base sm:text-lg font-bold">Revenue & Bookings</CardTitle>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as any)}
                className="text-xs sm:text-sm border border-border/40 rounded-lg px-3 py-2 bg-card hover:bg-muted/30 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              >
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="12m">Last 12 months</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={revenueSeries} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
                <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '12px' }} />
                <ReTooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}
                  labelStyle={{ color: 'var(--foreground)' }}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '16px' }}
                  iconType="square"
                />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (Ksh)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="bookings" fill="#8b5cf6" name="Bookings" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/40 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-foreground text-base sm:text-lg font-bold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityFeed.length ? (
            <div className="space-y-2 sm:space-y-3">
              {activityFeed.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-border/40 bg-muted/15 hover:bg-muted/30 hover:border-border/60 transition-all duration-200 group"
                >
                  <div className="flex-shrink-0 pt-0.5 sm:pt-1">
                    <div className={`w-3 h-3 rounded-full ${activityToneColors[item.tone]} ring-2 ring-offset-2 ring-${item.tone === 'alert' ? 'yellow' : item.tone === 'positive' ? 'green' : 'blue'}-200 dark:ring-offset-card`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-medium text-foreground group-hover:text-primary transition-colors">{item.message}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">{formatActivityTimestamp(item.timestamp)}</p>
                  </div>
                  {idx === 0 && (
                    <div className="flex-shrink-0 mt-0.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">New</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 sm:py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-7 w-7 text-muted-foreground opacity-50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">No activity yet</p>
              <p className="text-xs text-muted-foreground">Recent activity will appear here when bookings, payouts, disputes, or promotions are updated</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
