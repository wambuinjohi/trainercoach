import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, UserCheck, AlertCircle, Calendar, DollarSign, TrendingUp } from 'lucide-react'
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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        const [dashboard, trainerMetrics, analyticsTimeline, activityEvents, issuesData] = await Promise.all([
          getDashboardOverview(),
          getTrainerMetrics(),
          getAnalyticsTimeSeries(),
          getActivityFeed(4),
          apiService.getIssuesWithPagination({ page: 1, pageSize: 100 }),
        ])

        let documentsData = []
        try {
          documentsData = await apiService.listVerificationDocuments('pending')
        } catch (docError) {
          console.warn('Failed to load verification documents:', docError)
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
        setLoading(false)
      }
    }

    loadData()
  }, [])

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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalUsers.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalTrainers}</p>
                <p className="text-xs text-muted-foreground">Active Trainers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalBookings.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">Ksh {stats.totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="font-semibold text-foreground">Pending Documents</p>
                  <p className="text-sm text-muted-foreground">{stats.pendingDocuments} documents need review</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/document-review')}>
                Review
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="font-semibold text-foreground">Pending Approvals</p>
                  <p className="text-sm text-muted-foreground">{stats.pendingApprovals} trainer applications need review</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/approvals')}>
                Review
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-semibold text-foreground">Active Disputes</p>
                  <p className="text-sm text-muted-foreground">{stats.activeDisputes} cases require attention</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/disputes')}>
                Handle
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      {revenueSeries.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground">Revenue & Bookings</CardTitle>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as any)}
                className="text-sm border border-border rounded px-2 py-1"
              >
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="12m">Last 12 months</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ReTooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (Ksh)" />
                <Bar dataKey="bookings" fill="#8b5cf6" name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityFeed.length ? (
            <div className="space-y-4">
              {activityFeed.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <div className={`w-2 h-2 rounded-full ${activityToneColors[item.tone]}`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{item.message}</p>
                    <p className="text-xs text-muted-foreground">{formatActivityTimestamp(item.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Recent activity will appear here when bookings, payouts, disputes, or promotions are updated.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
