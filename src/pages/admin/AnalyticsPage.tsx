import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Calendar, BarChart3, TrendingUp } from 'lucide-react'
import { getAnalyticsTimeSeries, getUserMetrics } from '@/lib/analytics-service'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { toast } from '@/hooks/use-toast'

type AnalyticsPoint = {
  rawDate: string
  revenue: number
  bookings: number
  aov: number
}

const monthFormatter = new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' })
const kesFormatter = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatKes = (value: number) => {
  const numeric = Number(value)
  const safe = Number.isFinite(numeric) ? numeric : 0
  return `Ksh ${kesFormatter.format(safe)}`
}

export default function AnalyticsPage() {
  const [analyticsPoints, setAnalyticsPoints] = useState<AnalyticsPoint[]>([])
  const [stats, setStats] = useState({ totalUsers: 0, totalTrainers: 0, totalClients: 0 })
  const [range, setRange] = useState<'30d' | '90d' | '12m'>('12m')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [timeline, userMetrics] = await Promise.all([
        getAnalyticsTimeSeries(),
        getUserMetrics(),
      ])

      setAnalyticsPoints(timeline)
      setStats({
        totalUsers: (userMetrics?.totalClients || 0) + (userMetrics?.totalTrainers || 0) + (userMetrics?.totalAdmins || 0),
        totalTrainers: userMetrics?.totalTrainers || 0,
        totalClients: userMetrics?.totalClients || 0,
      })
    } catch (error) {
      console.error('Failed to load analytics:', error)
      toast({ title: 'Error', description: 'Failed to load analytics data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

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

  const userComposition = [
    { name: 'Clients', value: stats.totalClients },
    { name: 'Trainers', value: stats.totalTrainers },
  ]

  const kpiSummary = useMemo(() => {
    if (!revenueSeries.length) {
      return { totalRevenue: 0, totalBookings: 0, averageAov: 0 }
    }
    const totalRevenue = revenueSeries.reduce((sum, item) => sum + (Number(item.revenue) || 0), 0)
    const totalBookings = revenueSeries.reduce((sum, item) => sum + (Number(item.bookings) || 0), 0)
    const averageAov = totalBookings ? totalRevenue / totalBookings : 0
    return { totalRevenue, totalBookings, averageAov }
  }, [revenueSeries])

  const exportCSV = (filename: string, rows: Record<string, any>[]) => {
    const headers = Object.keys(rows[0] || { month: 'Month', revenue: 0 })
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => r[h]).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Analytics & Reports</h1>
        <div className="flex items-center gap-2">
          <Button variant={range === '30d' ? 'default' : 'outline'} size="sm" onClick={() => setRange('30d')}>
            30d
          </Button>
          <Button variant={range === '90d' ? 'default' : 'outline'} size="sm" onClick={() => setRange('90d')}>
            90d
          </Button>
          <Button variant={range === '12m' ? 'default' : 'outline'} size="sm" onClick={() => setRange('12m')}>
            12m
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="bg-card border-border xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Revenue & AOV
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {revenueSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueSeries} margin={{ left: 12, right: 12, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ReTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} name="Revenue" />
                  <Line type="monotone" dataKey="aov" stroke="#16a34a" strokeWidth={2} dot={false} name="AOV" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">User Composition</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {userComposition.some(u => u.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={userComposition} dataKey="value" nameKey="name" outerRadius={90} label>
                    {userComposition.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#6366f1' : '#f59e0b'} />
                    ))}
                  </Pie>
                  <Legend />
                  <ReTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No users</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="bg-card border-border xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground">{range === '12m' ? 'Monthly Bookings' : 'Daily Bookings'}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {revenueSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueSeries} margin={{ left: 12, right: 12, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ReTooltip />
                  <Bar dataKey="bookings" fill="#10b981" name="Bookings" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">KPIs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Total Revenue (period)</span>
                <span className="font-semibold text-foreground">{formatKes(kpiSummary.totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Total Bookings</span>
                <span className="font-semibold text-foreground">{kpiSummary.totalBookings}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Avg AOV</span>
                <span className="font-semibold text-foreground">{formatKes(kpiSummary.averageAov)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Generate Reports</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button variant="outline" className="justify-start border-border" onClick={() => exportCSV('monthly_revenue.csv', revenueSeries)}>
            <BarChart3 className="h-4 w-4 mr-2" /> Monthly Revenue
          </Button>
          <Button
            variant="outline"
            className="justify-start border-border"
            onClick={() => exportCSV('monthly_bookings.csv', revenueSeries.map(r => ({ month: r.month, bookings: r.bookings })))}
          >
            <Calendar className="h-4 w-4 mr-2" /> Bookings
          </Button>
          <Button
            variant="outline"
            className="justify-start border-border"
            onClick={() => exportCSV('user_composition.csv', userComposition.map(u => ({ name: u.name, value: u.value })))}
          >
            <Users className="h-4 w-4 mr-2" /> Users Breakdown
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
