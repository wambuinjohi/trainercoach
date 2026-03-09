import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import AdminSidebar from './AdminSidebar'
import ThemeToggleAdmin from './ThemeToggleAdmin'
import { RefundModal } from './RefundModal'
import { AdminPayoutManager } from './AdminPayoutManager'
import { EmojiPickerComponent } from './EmojiPickerComponent'
import { CategoryForm } from './CategoryForm'
import { CategoryList } from './CategoryList'
import { ContactsList } from './ContactsList'
import { WaitingListManager } from './WaitingListManager'
import { AdminSMSManager } from './AdminSMSManager'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  Users,
  DollarSign,
  Calendar,
  BarChart3,
  UserCheck,
  AlertCircle,
  Settings,
  TrendingUp,
  Eye,
  CheckCircle,
  XCircle,
  MessageSquare,
  Download,
  Plus,
  Trash2,
  Save,
  Pencil,
  Key
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { loadSettings, saveSettings, defaultSettings, defaultMpesaSettings, type PlatformSettings, type MpesaSettings, loadSettingsFromDb, saveSettingsToDb } from '@/lib/settings'
import { useTheme } from 'next-themes'
import { apiRequest } from '@/lib/api'
import { getUploadsBaseUrl } from '@/lib/api-config'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'

type DisputeStatus = 'pending' | 'investigating' | 'resolved'

type Dispute = {
  id: string | number
  case: string
  client: string
  trainer: string
  issue: string
  amount: number
  status: DisputeStatus
  submittedAt: string
  refunded?: boolean
  notes?: string
}

type AnalyticsPoint = {
  rawDate: string
  revenue: number
  bookings: number
  aov: number
}

type ActivityItemTone = 'positive' | 'neutral' | 'alert'

type ActivityItem = {
  id: string
  timestamp: string
  message: string
  tone: ActivityItemTone
}

const kesFormatter = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatKes = (value: number) => {
  const numeric = Number(value)
  const safe = Number.isFinite(numeric) ? numeric : 0
  return `Ksh ${kesFormatter.format(safe)}`
}
const monthFormatter = new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' })
const dayFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const safeDate = (value: string | null | undefined) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}
const buildAnalyticsPoints = (rows: any[]): AnalyticsPoint[] => {
  const buckets = new Map<string, { revenue: number; bookings: number }>()
  rows.forEach((row) => {
    const date = safeDate(row?.created_at)
    if (!date) return
    const key = date.toISOString().slice(0, 10)
    const summary = buckets.get(key) || { revenue: 0, bookings: 0 }
    // Support multiple field names for amount
    const amount = Number(row?.total_amount || row?.amount || row?.price || 0)
    summary.revenue += amount
    summary.bookings += 1
    buckets.set(key, summary)
  })
  return Array.from(buckets.entries())
    .map(([day, summary]) => {
      const rawDate = `${day}T00:00:00Z`
      const revenue = Number(summary.revenue.toFixed(2))
      const bookings = summary.bookings
      const aov = bookings ? revenue / bookings : 0
      return { rawDate, revenue, bookings, aov }
    })
    .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())
}
const formatActivityTimestamp = (value: string) => {
  const date = safeDate(value)
  return date ? date.toLocaleString() : ''
}

const activityToneColors: Record<ActivityItemTone, string> = {
  positive: 'bg-blue-500',
  neutral: 'bg-blue-500',
  alert: 'bg-yellow-500',
}

const initialStats = {
  totalUsers: 0,
  totalTrainers: 0,
  totalClients: 0,
  totalAdmins: 0,
  totalBookings: 0,
  totalRevenue: 0,
  pendingApprovals: 0,
  activeDisputes: 0,
}

export const AdminDashboard: React.FC = () => {
  const { user, userType, signOut, loading } = useAuth()
  const navigate = useNavigate()

  const [confirmLoading, setConfirmLoading] = useState(false)
  const [analyticsPoints, setAnalyticsPoints] = useState<AnalyticsPoint[]>([])
  const [range, setRange] = useState<'30d' | '90d' | '12m'>('12m')
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTrainers: 0,
    totalClients: 0,
    totalAdmins: 0,
    totalBookings: 0,
    totalRevenue: 0,
    pendingApprovals: 0,
    activeDisputes: 0,
  })
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings)
  const [saving, setSaving] = useState(false)
  const [approvals, setApprovals] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [issues, setIssues] = useState<any[]>([])
  const [issuePage, setIssuePage] = useState(1)
  const [issueTotalCount, setIssueTotalCount] = useState(0)
  const [issuePageSize] = useState(10)
  const [promotions, setPromotions] = useState<any[]>([])
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [displayedDisputeCount, setDisplayedDisputeCount] = useState(10)
  const [loadingIssues, setLoadingIssues] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', icon: '', description: '' })
  const [catLoading, setCatLoading] = useState(false)
  const [refundDispute, setRefundDispute] = useState<any | null>(null)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [activeDispute, setActiveDispute] = useState<any | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    title: string
    description: string
    action: () => Promise<void>
    isDestructive?: boolean
  }>({
    open: false,
    title: '',
    description: '',
    action: async () => {},
  })

  useEffect(() => {
    const loaded = loadSettings()
    setSettings(loaded)
    if (loaded.mpesa) setMpesa(loaded.mpesa)
    loadSettingsFromDb().then((db) => { if (db) { setSettings(db); if (db.mpesa) setMpesa(db.mpesa) } }).catch(() => {})
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
        month: dayFormatter.format(new Date(point.rawDate)),
        revenue: Number(point.revenue.toFixed(2)),
        bookings: point.bookings,
        aov: Number(point.aov.toFixed(2)),
      }))
  }, [analyticsPoints, range])

  const userComposition = useMemo(() => ([
  { name: 'Clients', value: stats.totalClients || Math.max(0, stats.totalUsers - stats.totalTrainers) },
  { name: 'Trainers', value: stats.totalTrainers },
]), [stats])

  const kpiSummary = useMemo(() => {
    if (!revenueSeries.length) {
      return { totalRevenue: 0, totalBookings: 0, averageAov: 0 }
    }
    const totalRevenue = revenueSeries.reduce((sum, item) => sum + (Number(item.revenue) || 0), 0)
    const totalBookings = revenueSeries.reduce((sum, item) => sum + (Number(item.bookings) || 0), 0)
    const averageAov = totalBookings ? totalRevenue / totalBookings : 0
    return { totalRevenue, totalBookings, averageAov }
  }, [revenueSeries])

  const update = (patch: Partial<PlatformSettings>) => setSettings(prev => ({ ...prev, ...patch }))

  const [announcementTarget, setAnnouncementTarget] = useState<'all'|'clients'|'trainers'|'admins'>('all')
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      saveSettings(settings)
      const ok = await saveSettingsToDb(settings)
      if (ok) {
        toast({ title: 'Settings saved' })
      } else {
        toast({ title: 'Saved locally', description: 'DB persist unavailable (check table or RLS).', variant: 'default' })
      }
    } finally {
      setSaving(false)
    }
  }

  const sendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      toast({ title: 'Missing content', description: 'Please provide title and message', variant: 'destructive' })
      return
    }
    setSendingAnnouncement(true)
    try {
      await apiRequest('announcement_create', {
        title: announcementTitle,
        message: announcementBody,
        target: announcementTarget,
        created_by: user?.id,
        is_active: 1
      })

      toast({ title: 'Success', description: 'Announcement sent successfully!' })
      setAnnouncementTitle('')
      setAnnouncementBody('')
      setAnnouncementTarget('all')
    } catch (err: any) {
      console.warn('Send announcement failed', err)
      toast({ title: 'Error', description: err?.message || 'Failed to send announcement', variant: 'destructive' })
    } finally {
      setSendingAnnouncement(false)
    }
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
      
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Button variant="outline" size="sm" onClick={() => setActiveTab('approvals')}>
                Review
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-semibold text-foreground">Active Disputes</p>
                  <p className="text-sm text-muted-foreground">{stats.activeDisputes} cases require attention</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveTab('disputes')}>
                Handle
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

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

  const renderApprovals = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Trainer Approvals</h1>
        <Badge variant="secondary">{approvals.length} pending</Badge>
      </div>

      <div className="space-y-4">
        {approvals.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">No pending trainer approvals.</CardContent>
          </Card>
        ) : approvals.map((trainer) => (
          <Card key={trainer.id || trainer.user_id} className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{trainer.full_name || trainer.user_id || 'Unnamed'}</h3>
                  <p className="text-muted-foreground">{trainer.email || trainer.phone_number || ''}</p>
                  <p className="text-sm text-muted-foreground mt-1">Applied {trainer.created_at ? new Date(trainer.created_at).toLocaleDateString() : ''}</p>
                </div>
                <Badge variant="outline">Pending Review</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Disciplines</p>
                  <p className="text-sm text-muted-foreground">{Array.isArray(trainer.disciplines)? trainer.disciplines.join(', '): trainer.disciplines || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Experience (years)</p>
                  <p className="text-sm text-muted-foreground">{trainer.experience_years ?? '-'}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-foreground mb-2">Certifications</p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(trainer.certifications)? trainer.certifications : (trainer.certifications? [trainer.certifications]: [])).map((cert: any, index: number) => (
                    <Badge key={index} variant="secondary">{cert}</Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => rejectTrainer(trainer.user_id)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button size="sm" className="bg-gradient-primary text-white" onClick={() => approveTrainer(trainer.user_id)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const toCSV = (rows: any[]) => [
    'case,client,trainer,issue,amount,status,submittedAt,refunded',
    ...rows.map(r => [r.case,r.client,r.trainer,`"${r.issue}"`,r.amount,r.status,r.submittedAt,!!r.refunded].join(','))
  ].join('\n')

  const issueToDispute = (issue: any, usersList: any[]): Dispute => {
    const clientUser = usersList.find((u: any) => u.user_id === issue.user_id)
    const trainerUser = usersList.find((u: any) => u.user_id === issue.trainer_id)
    const statusMap: Record<string, DisputeStatus> = {
      'open': 'pending',
      'pending': 'pending',
      'investigating': 'investigating',
      'resolved': 'resolved',
    }
    const mappedStatus = statusMap[String(issue.status || 'open').toLowerCase()] || 'pending'
    return {
      id: issue.id,
      case: `#${issue.id?.substring(0, 8) || Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      client: clientUser?.full_name || issue.user_id || 'Unknown Client',
      trainer: trainerUser?.full_name || issue.trainer_id || 'N/A',
      issue: issue.description || 'No description',
      amount: 0,
      status: mappedStatus,
      submittedAt: issue.created_at ? new Date(issue.created_at).toLocaleDateString() : 'Unknown',
      refunded: false,
      notes: issue.resolution || undefined,
    }
  }

  const transformedDisputes = useMemo(() => {
    return issues.map(issue => issueToDispute(issue, users))
  }, [issues, users])

  const filtered = useMemo(() => {
    return transformedDisputes.filter(d => {
      const q = query.toLowerCase()
      const matches = !q || [d.case,d.client,d.trainer,d.issue].some(v => String(v).toLowerCase().includes(q))
      const statusOk = statusFilter === 'all' ? true : d.status === statusFilter
      return matches && statusOk
    })
  }, [transformedDisputes, query, statusFilter])

  const setStatus = async (id: any, status: DisputeStatus) => {
    const issueId = String(id)
    try {
      await apiService.updateIssueStatus(issueId, status)
      setIssues(iss => iss.map(i => i.id === issueId ? { ...i, status } : i))
      if (activeDispute?.id === id) {
        setActiveDispute({ ...activeDispute, status })
      }
      toast({ title: 'Success', description: `Dispute status updated to ${status}` })
    } catch (err: any) {
      console.error('Update dispute status error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to update dispute status', variant: 'destructive' })
    }
  }

  const resolve = (id: any) => {
    const dispute = filtered.find(d => d.id === id)
    const caseLabel = dispute?.case || `Case #${id}`
    setConfirmModal({
      open: true,
      title: 'Resolve Dispute',
      description: `Are you sure you want to mark ${caseLabel} as resolved? Make sure all necessary actions (refund, notes) have been completed.`,
      action: async () => {
        await setStatus(id, 'resolved')
      },
    })
  }

  const refund = (id: any) => {
    const dispute = filtered.find(d => d.id === id)
    if (dispute) {
      setRefundDispute(dispute)
      setShowRefundModal(true)
    }
  }


  const approvedOf = (u:any) => {
    const v = u && (u.is_approved !== undefined ? u.is_approved : u)
    if (v === true) return true
    if (v === false) return false
    if (v == null) return false
    const s = String(v).trim().toLowerCase()
    return ['1','true','yes','y','t'].includes(s)
  }

  const approveTrainer = (userId: string) => {
    const trainer = approvals.find(t => t.user_id === userId)
    const trainerName = trainer?.full_name || userId
    setConfirmModal({
      open: true,
      title: 'Approve Trainer',
      description: `Are you sure you want to approve ${trainerName} as a trainer? They will have access to the platform immediately.`,
      action: async () => {
        try {
          await apiService.approveTrainer(userId)
          // Update local state instead of reloading
          const updatedApprovals = approvals.filter(t => t.user_id !== userId)
          setApprovals(updatedApprovals)
          setStats(prev => ({
            ...prev,
            pendingApprovals: updatedApprovals.length,
            totalTrainers: prev.totalTrainers + 1
          }))
          toast({ title: 'Success', description: 'Trainer approved' })
        } catch (err: any) {
          console.error('Approve trainer error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to approve trainer', variant: 'destructive' })
        }
      },
    })
  }

  const rejectTrainer = (userId: string) => {
    const trainer = approvals.find(t => t.user_id === userId)
    const trainerName = trainer?.full_name || userId
    setConfirmModal({
      open: true,
      title: 'Reject Trainer',
      description: `Are you sure you want to reject ${trainerName}? This action cannot be undone.`,
      isDestructive: true,
      action: async () => {
        try {
          await apiService.rejectTrainer(userId)
          setUsers(users.filter(u => u.user_id !== userId))
          setApprovals(approvals.filter(a => a.user_id !== userId))
          toast({ title: 'Success', description: 'Trainer rejected' })
        } catch (err: any) {
          console.error('Reject trainer error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to reject trainer', variant: 'destructive' })
        }
      },
    })
  }

  const deleteUser = async (userId: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete User',
      description: 'Are you sure you want to delete this user? This action cannot be undone.',
      isDestructive: true,
      action: async () => {
        try {
          await apiService.deleteUser(userId)
          setUsers(users.filter(u => u.user_id !== userId))
          toast({ title: 'Success', description: 'User deleted' })
        } catch (err: any) {
          console.error('Delete user error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to delete user', variant: 'destructive' })
        }
      },
    })
  }

  const updateUserType = async (userId: string, newType: string) => {
    try {
      await apiService.updateUserType(userId, newType)
      setUsers(users.map(u => u.user_id === userId ? { ...u, user_type: newType } : u))
      toast({ title: 'Success', description: 'User type updated' })
    } catch (err: any) {
      console.error('Update user type error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to update user type', variant: 'destructive' })
    }
  }

  const [smtp, setSmtp] = useState<{ host: string; port: string | number; user?: string; pass?: string; from?: string }>({ host:'', port:'', user:'', pass:'', from:'' })
  const [mpesa, setMpesa] = useState<MpesaSettings>(defaultMpesaSettings)

  const [testStkPhone, setTestStkPhone] = useState('254722241745')
  const [testStkAmount, setTestStkAmount] = useState('5')
  const [testStkLoading, setTestStkLoading] = useState(false)
  const [testStkResult, setTestStkResult] = useState<any>(null)

  const handleTestStkPush = async () => {
    if (!testStkPhone.trim()) {
      toast({ title: 'Error', description: 'Please enter a phone number', variant: 'destructive' })
      return
    }
    if (!testStkAmount.trim() || isNaN(Number(testStkAmount)) || Number(testStkAmount) <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' })
      return
    }
    // Check for required credentials (either main shortcode or Buy Goods shortcode)
    if (!mpesa.consumerKey || !mpesa.consumerSecret || !mpesa.passkey) {
      toast({ title: 'Error', description: 'M-Pesa credentials are not configured. Please configure them first.', variant: 'destructive' })
      return
    }
    // Ensure either main shortcode or Buy Goods shortcode is configured
    if (!mpesa.shortcode && !mpesa.buyGoodsShortCode) {
      toast({ title: 'Error', description: 'M-Pesa shortcode or Buy Goods shortcode must be configured.', variant: 'destructive' })
      return
    }
    // For Buy Goods, also require merchant code
    if (mpesa.buyGoodsShortCode && !mpesa.buyGoodsMerchantCode) {
      toast({ title: 'Error', description: 'Buy Goods merchant code is required.', variant: 'destructive' })
      return
    }

    setTestStkLoading(true)
    setTestStkResult(null)

    try {
      const response = await fetch('/api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stk_push_initiate',
          phone: testStkPhone,
          amount: Number(testStkAmount),
          account_reference: 'admin_test',
          transaction_description: 'Admin STK Push Test',
          booking_id: null,
        }),
      })

      let responseText = ''
      try {
        const clonedResponse = response.clone()
        responseText = await clonedResponse.text()
      } catch (err) {
        throw new Error('Failed to read response body')
      }

      let result
      try {
        result = JSON.parse(responseText)
      } catch (err) {
        console.error('Failed to parse JSON:', responseText.substring(0, 500))
        throw new Error('Server returned invalid response')
      }

      if (result.status === 'error') {
        setTestStkResult({ success: false, error: result.message })
        toast({ title: 'Error', description: result.message, variant: 'destructive' })
        return
      }

      setTestStkResult({ success: true, data: result.data })
      toast({ title: 'Success', description: 'STK Push initiated successfully' })
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to initiate STK Push'
      setTestStkResult({ success: false, error: errorMessage })
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
    } finally {
      setTestStkLoading(false)
    }
  }

  useEffect(() => {
    const loadAdmin = async () => {
      try {
        const usersData = await apiService.getUsers()
        if (usersData?.data) {
          setUsers(usersData.data)

          const allUsers = usersData.data
          const trainers = allUsers.filter((u: any) => u.user_type === 'trainer')
          const clients = allUsers.filter((u: any) => u.user_type === 'client')
          const admins = allUsers.filter((u: any) => u.user_type === 'admin')
          const approvedTrainers = trainers.filter((u: any) => u.is_approved)
          const pendingTrainers = trainers.filter((u: any) => !u.is_approved)

          setApprovals(pendingTrainers)
          setStats({
            totalUsers: allUsers.length,
            totalTrainers: trainers.length,
            totalClients: clients.length,
            totalAdmins: admins.length,
            totalBookings: 0,
            totalRevenue: 0,
            pendingApprovals: pendingTrainers.length,
            activeDisputes: 0
          })
        }

        const categoriesData = await apiService.getCategories()
        if (categoriesData?.data) {
          setCategories(categoriesData.data)
        }

        try {
          const result = await apiService.getIssuesWithPagination({
            page: issuePage,
            pageSize: issuePageSize,
          })
          if (result?.data) {
            setIssues(result.data)
            if (result.count !== undefined) {
              setIssueTotalCount(result.count)
              const openIssuesCount = result.data.filter((it: any) => String(it.status || 'open').toLowerCase() !== 'resolved').length
              setStats(prev => ({ ...prev, activeDisputes: openIssuesCount }))
            }
          }
        } catch (err) {
          console.warn('Failed to load issues', err)
        }

        try {
          const bookingsData = await apiService.getAllBookings()
          if (bookingsData?.data) {
            const analyticsData = buildAnalyticsPoints(bookingsData.data)
            setAnalyticsPoints(analyticsData)
            if (analyticsData.length > 0) {
              const totalRevenue = analyticsData.reduce((sum, point) => sum + point.revenue, 0)
              const totalBookings = analyticsData.reduce((sum, point) => sum + point.bookings, 0)
              setStats(prev => ({ ...prev, totalRevenue, totalBookings }))
            }
          }
        } catch (err) {
          console.warn('Failed to load analytics data', err)
        }

        try {
          const promotionsData = await apiService.getPromotionRequestsForAdmin('pending')
          if (promotionsData?.data) {
            setPromotions(Array.isArray(promotionsData.data) ? promotionsData.data : [promotionsData.data])
          }
        } catch (err) {
          console.warn('Failed to load promotions', err)
        }

        setActivityFeed([])
      } catch (err) {
        console.warn('Failed to load admin data', err)
      }
    }
    loadAdmin()
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      window.location.href = '/'
    } catch (err) {
      // ignore errors during sign out
    }
  }

  const approvePromotion = (id: string | number) => {
    const promotion = promotions.find(p => p.id === id)
    const trainerName = promotion?.full_name || 'Unknown'
    setConfirmModal({
      open: true,
      title: 'Approve Promotion Request',
      description: `Are you sure you want to approve the promotion request from ${trainerName}?`,
      action: async () => {
        try {
          await apiService.approvePromotionRequest(String(id), user?.id)
          setPromotions(promotions.filter(p => p.id !== id))
          toast({ title: 'Success', description: 'Promotion request approved' })
        } catch (err: any) {
          console.error('Approve promotion error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to approve promotion', variant: 'destructive' })
        }
      },
    })
  }

  const rejectPromotion = (id: string | number) => {
    const promotion = promotions.find(p => p.id === id)
    const trainerName = promotion?.full_name || 'Unknown'
    setConfirmModal({
      open: true,
      title: 'Reject Promotion Request',
      description: `Are you sure you want to reject the promotion request from ${trainerName}?`,
      isDestructive: true,
      action: async () => {
        try {
          await apiService.rejectPromotionRequest(String(id), user?.id)
          setPromotions(promotions.filter(p => p.id !== id))
          toast({ title: 'Success', description: 'Promotion request rejected' })
        } catch (err: any) {
          console.error('Reject promotion error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to reject promotion', variant: 'destructive' })
        }
      },
    })
  }

  const addCategory = async () => {
    if (!catForm.name.trim()) {
      toast({ title: 'Error', description: 'Category name is required', variant: 'destructive' })
      return
    }

    setCatLoading(true)
    try {
      const result = await apiService.addCategory(catForm.name, catForm.icon, catForm.description)
      const categoryId = result?.id || Date.now()
      setCategories([...categories, { id: categoryId, ...catForm, created_at: new Date().toISOString() }])
      setCatForm({ name: '', icon: '', description: '' })
      toast({ title: 'Success', description: 'Category added' })
    } catch (err: any) {
      console.error('Add category error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to add category', variant: 'destructive' })
    } finally {
      setCatLoading(false)
    }
  }

  const updateCategory = async (id: any, patch: any) => {
    try {
      await apiService.updateCategory(id, patch)
      toast({ title: 'Success', description: 'Category updated' })
    } catch (err: any) {
      console.error('Update category error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to update category', variant: 'destructive' })
    }
  }

  const viewIssue = (it: any) => setActiveIssue(it)

  const loadIssuesPage = async (page: number) => {
    setLoadingIssues(true)
    try {
      const result = await apiService.getIssuesWithPagination({
        page,
        pageSize: issuePageSize,
        searchQuery: query,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      if (result?.data) {
        setIssues(result.data)
        if (result.count !== undefined) {
          setIssueTotalCount(result.count)
        }
      }
      setIssuePage(page)
    } catch (err: any) {
      console.error('Load issues page error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to load issues', variant: 'destructive' })
    } finally {
      setLoadingIssues(false)
    }
  }

  const markIssueResolved = (it: any) => {
    if (!it?.id) {
      toast({ title: 'Error', description: 'Invalid issue', variant: 'destructive' })
      return
    }
    const issueTitle = it.complaint_type || 'Issue'
    setConfirmModal({
      open: true,
      title: 'Resolve Issue',
      description: `Are you sure you want to mark "${issueTitle}" as resolved?`,
      action: async () => {
        try {
          await apiService.updateIssueStatus(it.id, 'resolved')
          setIssues(issues.map(iss => iss.id === it.id ? { ...iss, status: 'resolved' } : iss))
          setActiveIssue(null)
          toast({ title: 'Success', description: 'Issue marked as resolved' })
        } catch (err: any) {
          console.error('Mark issue resolved error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to resolve issue', variant: 'destructive' })
        }
      },
    })
  }

  const softDeleteIssue = (issueId: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete Issue',
      description: 'Are you sure you want to delete this issue? This action can be undone.',
      isDestructive: true,
      action: async () => {
        try {
          await apiService.softDeleteIssue(issueId)
          setIssues(issues.filter(iss => iss.id !== issueId))
          setActiveIssue(null)
          toast({ title: 'Success', description: 'Issue deleted' })
        } catch (err: any) {
          console.error('Soft delete issue error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to delete issue', variant: 'destructive' })
        }
      },
    })
  }

  const restoreIssue = async (issueId: string) => {
    try {
      await apiService.restoreIssue(issueId)
      await loadIssuesPage(issuePage)
      toast({ title: 'Success', description: 'Issue restored' })
    } catch (err: any) {
      console.error('Restore issue error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to restore issue', variant: 'destructive' })
    }
  }

  const deleteCategory = async (id: any) => {
    setConfirmModal({
      open: true,
      title: 'Delete Category',
      description: 'Are you sure you want to delete this category? This action cannot be undone.',
      isDestructive: true,
      action: async () => {
        try {
          await apiService.deleteCategory(id)
          setCategories(categories.filter(c => c.id !== id))
          toast({ title: 'Success', description: 'Category deleted' })
        } catch (err: any) {
          console.error('Delete category error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to delete category', variant: 'destructive' })
        }
      },
    })
  }

  const renderIssues = () => {
    const openIssues = issues.filter((it: any) => String(it.status || 'pending').toLowerCase() !== 'resolved').length
    const totalPages = Math.ceil(issueTotalCount / issuePageSize)

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reported Issues</h1>
            <p className="text-sm text-muted-foreground">Review, investigate, and resolve client or trainer complaints.</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{issueTotalCount} total</Badge>
            <Badge variant={openIssues ? 'destructive' : 'secondary'}>{openIssues} open</Badge>
          </div>
        </div>

        {issueTotalCount === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="h-14 w-14 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-2xl">✓</div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">No issues reported</h3>
                <p className="text-sm text-muted-foreground">You&apos;re all caught up. New reports will appear here instantly.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {loadingIssues ? (
              <Card className="border-border bg-card">
                <CardContent className="flex items-center justify-center gap-3 py-8">
                  <div className="text-muted-foreground">Loading issues...</div>
                </CardContent>
              </Card>
            ) : (
              <>
                {issues.map((it: any) => {
                  const status = String(it.status || 'pending').toLowerCase()
                  const resolved = status === 'resolved'
                  return (
                    <Card key={it.id} className="bg-card border-border">
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-semibold text-foreground">{it.complaint_type || 'Issue'}</h3>
                              <Badge variant={resolved ? 'secondary' : status === 'investigating' ? 'outline' : 'destructive'} className="capitalize">{status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{it.description || 'No description provided.'}</p>
                            <p className="text-xs text-muted-foreground">Reported by {it.user_name || it.user_email || it.user_id || 'Unknown user'} on {it.created_at ? new Date(it.created_at).toLocaleString() : 'unknown date'}</p>
                            {(it.booking_reference || it.booking_id) && (
                              <p className="text-xs text-muted-foreground">Booking reference: {it.booking_reference || it.booking_id}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 md:items-end">
                            <Button size="sm" variant="outline" onClick={() => viewIssue(it)}>
                              View details
                            </Button>
                            <Button size="sm" disabled={resolved} onClick={() => markIssueResolved(it)}>
                              {resolved ? 'Resolved' : 'Mark resolved'}
                            </Button>
                            <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => softDeleteIssue(it.id)}>
                              <Trash2 className="h-3 w-3 mr-1" /> Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
                    <div className="text-sm text-muted-foreground">
                      Page {issuePage} of {totalPages} ({issueTotalCount} total)
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={issuePage === 1 || loadingIssues}
                        onClick={() => loadIssuesPage(issuePage - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={issuePage === totalPages || loadingIssues}
                        onClick={() => loadIssuesPage(issuePage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      <AlertDialog open={!!activeIssue} onOpenChange={(open) => {
        if (!open) setActiveIssue(null)
      }}>
        {activeIssue && (
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Issue {activeIssue.id}</AlertDialogTitle>
              <AlertDialogDescription>Type: {activeIssue.complaint_type}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Description</p>
                <p className="text-sm text-muted-foreground">{activeIssue.description}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Booking Reference</p>
                <p className="text-sm text-muted-foreground">{activeIssue.booking_reference || 'Not provided'}</p>
              </div>
              {(() => {
                const attachments = activeIssue.attachments
                let attachmentList: string[] = []
                if (attachments) {
                  if (typeof attachments === 'string') {
                    try {
                      attachmentList = JSON.parse(attachments)
                      if (!Array.isArray(attachmentList)) attachmentList = [attachments]
                    } catch {
                      attachmentList = [attachments]
                    }
                  } else if (Array.isArray(attachments)) {
                    attachmentList = attachments
                  }
                }
                const normalizeUrl = (url: string): string => {
                  if (!url) return url
                  const uploadsBase = getUploadsBaseUrl()
                  // Replace old domain
                  let normalized = url.replace(/https?:\/\/skatryk\.co\.ke\/uploads/gi, uploadsBase)
                  // Handle relative paths like /uploads/...
                  if (normalized.startsWith('/uploads/')) {
                    normalized = uploadsBase + normalized.substring(8)
                  }
                  return normalized
                }
                const isImageUrl = (url: string): boolean => {
                  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i
                  return imageExtensions.test(url)
                }
                const images = attachmentList.filter(isImageUrl).map(normalizeUrl)
                const otherFiles = attachmentList.filter(url => !isImageUrl(url)).map(normalizeUrl)
                return attachmentList.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Attachments</p>
                    {images.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-2">Images:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {images.map((img:string, i:number)=>(
                            <a key={i} href={img} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border bg-muted hover:opacity-80 transition-opacity">
                              <img src={img} alt={`Attachment ${i+1}`} className="w-full h-32 object-cover" onError={(e)=>{ e.currentTarget.src = '' }} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {otherFiles.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Files:</p>
                        <div className="grid grid-cols-1 gap-2">
                          {otherFiles.map((file:string, i:number)=>(
                            <a key={i} href={file} target="_blank" rel="noreferrer" className="text-sm text-primary underline break-all">Attachment {images.length > 0 ? i + images.length + 1 : i + 1}</a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null
              })()}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
              <Button onClick={()=>{ markIssueResolved(activeIssue); setActiveIssue(null) }} className="bg-gradient-primary text-white">Mark Resolved</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
      </div>
    )
  }

  const renderPromotions = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Promotion Requests</h1>
        <Badge variant="secondary">{promotions.length}</Badge>
      </div>

      <div className="space-y-4">
        {promotions.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">No promotion requests.</CardContent>
          </Card>
        ) : promotions.map((p) => {
          const trainer = users.find((u:any) => u.user_id === (p.trainer_id || p.trainer_user_id || p.trainer))
          const trainerLabel = trainer?.full_name || trainer?.user_id || p.trainer_id || p.trainer_user_id || 'Unknown'
          const commissionRaw = (p.commission_rate ?? p.requested_commission)
          const commissionText = (commissionRaw === null || commissionRaw === undefined || Number.isNaN(Number(commissionRaw))) ? 'N/A' : `${Number(commissionRaw).toFixed(0)}%`
          const createdAt = p.created_at ? new Date(p.created_at).toLocaleString() : ''
          return (
            <Card key={p.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">Trainer: {trainerLabel}</h3>
                    <p className="text-sm text-muted-foreground">Commission requested: {commissionText}</p>
                    <p className="text-sm text-muted-foreground">Status: {p.status || 'pending'} {createdAt ? `• ${createdAt}` : ''}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approvePromotion(p.id)} disabled={p.status === 'approved'}>{p.status === 'approved' ? 'Approved' : 'Approve'}</Button>
                    <Button variant="outline" size="sm" className="border-destructive text-destructive" onClick={() => rejectPromotion(p.id)} disabled={p.status === 'rejected'}>{p.status === 'rejected' ? 'Rejected' : 'Reject'}</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )

  const renderCategories = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Categories</h1>
        <Badge variant="secondary">{categories.length}</Badge>
      </div>

      <CategoryForm
        name={catForm.name}
        icon={catForm.icon}
        description={catForm.description}
        onNameChange={(value) => setCatForm({ ...catForm, name: value })}
        onIconChange={(emoji) => setCatForm({ ...catForm, icon: emoji })}
        onDescriptionChange={(value) => setCatForm({ ...catForm, description: value })}
        onSubmit={addCategory}
        loading={catLoading}
      />

      <CategoryList
        categories={categories}
        onUpdate={updateCategory}
        onDelete={deleteCategory}
        onCategoryChange={(id, field, value) =>
          setCategories((cs) =>
            cs.map((c) => (c.id === id ? { ...c, [field]: value } : c))
          )
        }
      />
    </div>
  )

  const renderDisputes = () => {
    const sortedDisputes = [...filtered].sort((a, b) => {
      const dateA = new Date(a.submittedAt).getTime()
      const dateB = new Date(b.submittedAt).getTime()
      return dateB - dateA
    })

    const displayedDisputes = sortedDisputes.slice(0, displayedDisputeCount)
    const hasMore = sortedDisputes.length > displayedDisputeCount

    return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">Dispute Management</h1>
        <div className="flex items-center gap-2">
          <Input placeholder="Search cases, users…" value={query} onChange={(e)=>{setQuery(e.target.value); setDisplayedDisputeCount(10)}} className="w-52 bg-input border-border" />
          <Select value={statusFilter} onValueChange={(v)=>{setStatusFilter(v as any); setDisplayedDisputeCount(10)}}>
            <SelectTrigger className="w-40 bg-input border-border"><SelectValue placeholder="All statuses"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="border-border" onClick={()=>{
            const blob = new Blob([toCSV(filtered)], {type:'text/csv;charset=utf-8;'})
            const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='disputes.csv'; a.click(); URL.revokeObjectURL(url)
          }}>
            <Download className="h-4 w-4 mr-2"/> Export
          </Button>
          <Badge variant="destructive">{filtered.filter(d=>d.status!=='resolved').length} active</Badge>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">No disputes found.</CardContent>
          </Card>
        ) : displayedDisputes.map((dispute) => (
          <Card key={dispute.id} className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Case {dispute.case}</h3>
                  <p className="text-muted-foreground">{dispute.issue}</p>
                  <p className="text-sm text-muted-foreground mt-1">Submitted {dispute.submittedAt}</p>
                </div>
                <Badge variant={dispute.status === 'pending' ? 'destructive' : dispute.status==='resolved' ? 'secondary' : 'outline'}>
                  {dispute.status}{dispute.refunded ? ' • refunded' : ''}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Client</p>
                  <p className="text-sm text-muted-foreground">{dispute.client}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Trainer</p>
                  <p className="text-sm text-muted-foreground">{dispute.trainer}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Amount</p>
                  <p className="text-sm text-muted-foreground">Ksh {dispute.amount}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="flex-1 min-w-[140px]" onClick={()=>setActiveDispute(dispute)}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  View Details
                </Button>
                <Button variant="outline" size="sm" onClick={()=>refund(dispute.id)} disabled={dispute.refunded || dispute.status==='resolved'}>
                  Refund Client
                </Button>
                <Button size="sm" className="bg-gradient-primary text-white" onClick={()=>resolve(dispute.id)} disabled={dispute.status==='resolved'}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolve Case
                </Button>
                <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={()=>softDeleteIssue(String(dispute.id))}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => setDisplayedDisputeCount(prev => prev + 10)}
              variant="outline"
              className="border-border"
            >
              Load More Disputes ({displayedDisputeCount} of {sortedDisputes.length})
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={!!activeDispute} onOpenChange={(open) => {
        if (!open) setActiveDispute(null)
      }}>
        {activeDispute && (
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Case {activeDispute.case}</AlertDialogTitle>
              <AlertDialogDescription>{activeDispute.issue}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Client:</span> <span className="text-foreground">{activeDispute.client}</span></div>
                <div><span className="text-muted-foreground">Trainer:</span> <span className="text-foreground">{activeDispute.trainer}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="text-foreground">Ksh {activeDispute.amount}</span></div>
                <div><span className="text-muted-foreground">Submitted:</span> <span className="text-foreground">{activeDispute.submittedAt}</span></div>
              </div>
              <div>
                <Label htmlFor="dispute-notes">Internal notes</Label>
                <Input id="dispute-notes" value={activeDispute.notes || ''} onChange={(e)=>setActiveDispute({...activeDispute, notes:e.target.value})} className="bg-input border-border" />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
              <Button variant="outline" onClick={async ()=>{
                if(activeDispute){
                  try {
                    await apiService.updateData('reported_issues', { resolution: activeDispute.notes }, `id = '${activeDispute.id}'`)
                    setIssues(iss => iss.map(i => i.id === activeDispute.id ? { ...i, resolution: activeDispute.notes } : i))
                    setActiveDispute(null)
                    toast({ title: 'Success', description: 'Notes saved' })
                  } catch (err: any) {
                    console.error('Save error:', err)
                    toast({ title: 'Error', description: 'Failed to save notes', variant: 'destructive' })
                  }
                }
              }}>Save Notes</Button>
              <Button onClick={()=>{ if(activeDispute){ resolve(activeDispute.id); setActiveDispute(null);} }} className="bg-gradient-primary text-white">Mark Resolved</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {showRefundModal && refundDispute && (
        <RefundModal
          dispute={{
            id: refundDispute.id,
            client: refundDispute.client,
            amount: refundDispute.amount,
            issue: refundDispute.issue,
          }}
          clientPhone=""
          onClose={() => {
            setShowRefundModal(false)
            setRefundDispute(null)
          }}
          onSuccess={() => {
            setIssues(iss => iss.map(i => i.id === refundDispute.id ? { ...i, status: 'resolved' } : i))
          }}
        />
      )}

    </div>
    )
  }

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

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Analytics & Reports</h1>
        <div className="flex items-center gap-2">
          <Button variant={range==='30d'?'default':'outline'} size="sm" onClick={() => setRange('30d')}>30d</Button>
          <Button variant={range==='90d'?'default':'outline'} size="sm" onClick={() => setRange('90d')}>90d</Button>
          <Button variant={range==='12m'?'default':'outline'} size="sm" onClick={() => setRange('12m')}>12m</Button>
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
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">User Composition</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={userComposition} dataKey="value" nameKey="name" outerRadius={90} label>
                  {userComposition.map((_, i) => <Cell key={i} fill={i===0?'#6366f1':'#f59e0b'} />)}
                </Pie>
                <Legend />
                <ReTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="bg-card border-border xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground">{range === '12m' ? 'Monthly Bookings' : 'Daily Bookings'}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueSeries} margin={{ left: 12, right: 12, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ReTooltip />
                <Bar dataKey="bookings" fill="#10b981" name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">KPIs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="text-muted-foreground text-sm">Total Revenue (period)</span><span className="font-semibold text-foreground">{formatKes(kpiSummary.totalRevenue)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground text-sm">Total Bookings</span><span className="font-semibold text-foreground">{kpiSummary.totalBookings}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground text-sm">Avg AOV</span><span className="font-semibold text-foreground">{formatKes(kpiSummary.averageAov)}</span></div>
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
          <Button variant="outline" className="justify-start border-border" onClick={() => exportCSV('monthly_bookings.csv', revenueSeries.map(r=>({ month:r.month, bookings:r.bookings })))}>
            <Calendar className="h-4 w-4 mr-2" /> Bookings
          </Button>
          <Button variant="outline" className="justify-start border-border" onClick={() => exportCSV('user_composition.csv', userComposition.map(u=>({ name:u.name, value:u.value })))}>
            <Users className="h-4 w-4 mr-2" /> Users Breakdown
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <Badge variant="secondary">{users.length}</Badge>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Approved</th>
                  <th className="p-2">Joined</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">{u.full_name || u.user_id}</td>
                    <td className="p-2">{u.email || u.phone_number || '-'}</td>
                    <td className="p-2">
                      <Select value={u.user_type || 'client'} onValueChange={(v)=>{
                        updateUserType(u.user_id, v)
                      }}>
                        <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="trainer">Trainer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">{approvedOf(u) ? 'Yes' : 'No'}</td>
                    <td className="p-2">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => deleteUser(u.user_id)}>Delete</Button>

                        {String(u.user_type || '').toLowerCase() === 'trainer' && !approvedOf(u) && (
                          <Button size="sm" variant="outline" onClick={() => approveTrainer(u.user_id)}>Approve</Button>
                        )}

                        <Button size="sm" variant="ghost" disabled title="Admin API not configured">Reset PW</Button>
                        <Button size="sm" variant="outline" disabled title="Admin API not configured">{u.is_suspended? 'Reinstate' : 'Suspend'}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="mt-4">
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="text-sm text-muted-foreground">No users found. Add users via Supabase or check the admin API.</div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  )

  const renderSettings = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">System Settings</h1>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Admin Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => navigate('/admin/reset-passwords')}
              variant="outline"
              className="justify-start border-border h-auto py-4"
            >
              <Key className="h-5 w-5 mr-3" />
              <div className="text-left">
                <p className="font-semibold text-foreground">Reset All Passwords</p>
                <p className="text-xs text-muted-foreground">Reset test user passwords to a new value</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Platform Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="platformName">Platform Name</Label>
              <Input id="platformName" value={settings.platformName}
                onChange={(e) => update({ platformName: e.target.value })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input id="supportEmail" type="email" value={settings.supportEmail}
                onChange={(e) => update({ supportEmail: e.target.value })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={settings.currency} onValueChange={(v) => update({ currency: v as any })}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="KES">KES</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timezone</Label>
              <Select value={settings.timezone} onValueChange={(v) => update({ timezone: v as any })}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Nairobi">Africa/Nairobi</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="commission">Platform Commission (%)</Label>
              <Input id="commission" type="number" min={0} max={100} value={settings.commissionRate}
                onChange={(e) => update({ commissionRate: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="taxRate">Tax/VAT (%)</Label>
              <Input id="taxRate" type="number" min={0} max={100} value={settings.taxRate}
                onChange={(e) => update({ taxRate: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label>Payout Schedule</Label>
              <Select value={settings.payoutSchedule} onValueChange={(v) => update({ payoutSchedule: v as any })}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Label>Theme</Label>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-sm text-muted-foreground">Toggle site theme (Light / Dark)</p>
              <div className="ml-auto">
                <ThemeToggleAdmin />
              </div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} variant="outline" size="sm" className="border-border">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Target</Label>
            <Select value={announcementTarget} onValueChange={(v)=>setAnnouncementTarget(v as any)}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="clients">Clients</SelectItem>
                <SelectItem value="trainers">Trainers</SelectItem>
                <SelectItem value="admins">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={announcementTitle} onChange={(e)=>setAnnouncementTitle(e.target.value)} className="bg-input border-border" />
          </div>
          <div>
            <Label>Message</Label>
            <textarea value={announcementBody} onChange={(e)=>setAnnouncementBody(e.target.value)} className="w-full p-2 border border-border rounded-md bg-input" rows={4} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={()=>{ setAnnouncementTitle(''); setAnnouncementBody(''); setAnnouncementTarget('all') }}>Clear</Button>
            <Button onClick={sendAnnouncement} disabled={sendingAnnouncement}>{sendingAnnouncement ? 'Sending…' : 'Send Announcement'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Booking Policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="cancelHrs">Cancellation window (hours)</Label>
              <Input id="cancelHrs" type="number" min={0} value={settings.cancellationHours}
                onChange={(e) => update({ cancellationHours: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="reschedHrs">Reschedule window (hours)</Label>
              <Input id="reschedHrs" type="number" min={0} value={settings.rescheduleHours}
                onChange={(e) => update({ rescheduleHours: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="maxDaily">Max sessions per trainer/day</Label>
              <Input id="maxDaily" type="number" min={1} value={settings.maxDailySessionsPerTrainer}
                onChange={(e) => update({ maxDailySessionsPerTrainer: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} variant="outline" size="sm" className="border-border">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">SMTP Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Host</Label>
            <Input value={smtp.host} onChange={(e)=>setSmtp({...smtp, host:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Port</Label>
            <Input type="number" value={smtp.port as any} onChange={(e)=>setSmtp({...smtp, port:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>User</Label>
            <Input value={smtp.user || ''} onChange={(e)=>setSmtp({...smtp, user:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={smtp.pass || ''} onChange={(e)=>setSmtp({...smtp, pass:e.target.value})} className="bg-input border-border" />
          </div>
          <div className="md:col-span-2">
            <Label>From</Label>
            <Input value={smtp.from || ''} onChange={(e)=>setSmtp({...smtp, from:e.target.value})} className="bg-input border-border" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button variant="outline" onClick={async ()=>{
              toast({ title: 'Feature unavailable', description: 'Supabase dependency removed', variant: 'destructive' })
            }}>Save SMTP</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">MPesa Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Environment</Label>
            <Select value={mpesa.environment} onValueChange={(v)=>setMpesa({...mpesa, environment:v})}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Consumer Key</Label>
            <Input value={mpesa.consumerKey || ''} onChange={(e)=>setMpesa({...mpesa, consumerKey:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Consumer Secret</Label>
            <Input type="password" value={mpesa.consumerSecret || ''} onChange={(e)=>setMpesa({...mpesa, consumerSecret:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Passkey</Label>
            <Input type="password" value={mpesa.passkey || ''} onChange={(e)=>setMpesa({...mpesa, passkey:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Initiator Name</Label>
            <Input value={mpesa.initiatorName || ''} onChange={(e)=>setMpesa({...mpesa, initiatorName:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Security Credential</Label>
            <Input type="password" value={mpesa.securityCredential || ''} onChange={(e)=>setMpesa({...mpesa, securityCredential:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Shortcode (Paybill)</Label>
            <Input value={mpesa.shortcode || ''} onChange={(e)=>setMpesa({...mpesa, shortcode:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Payment Type</Label>
            <Select value={mpesa.paymentType || 'paybill'} onValueChange={(v)=>setMpesa({...mpesa, paymentType:v})}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paybill">Paybill</SelectItem>
                <SelectItem value="buygods">Buy Goods</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mpesa.paymentType === 'buygods' && (
            <>
              <div>
                <Label>Buy Goods Short Code</Label>
                <Input value={mpesa.buyGoodsShortCode || ''} onChange={(e)=>setMpesa({...mpesa, buyGoodsShortCode:e.target.value})} className="bg-input border-border" placeholder="e.g., 6677963" />
              </div>
              <div>
                <Label>Buy Goods Merchant Code (PartyB)</Label>
                <Input value={mpesa.buyGoodsMerchantCode || ''} onChange={(e)=>setMpesa({...mpesa, buyGoodsMerchantCode:e.target.value})} className="bg-input border-border" placeholder="e.g., 4073538" />
              </div>
            </>
          )}
          <div>
            <Label>Result URL</Label>
            <Input value={mpesa.resultUrl || ''} onChange={(e)=>setMpesa({...mpesa, resultUrl:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Queue Timeout URL</Label>
            <Input value={mpesa.queueTimeoutUrl || ''} onChange={(e)=>setMpesa({...mpesa, queueTimeoutUrl:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>C2B Callback URL</Label>
            <Input value={mpesa.c2bCallbackUrl || ''} onChange={(e)=>setMpesa({...mpesa, c2bCallbackUrl:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>B2C Callback URL</Label>
            <Input value={mpesa.b2cCallbackUrl || ''} onChange={(e)=>setMpesa({...mpesa, b2cCallbackUrl:e.target.value})} className="bg-input border-border" />
          </div>
          <div className="md:col-span-2">
            <Label>Command ID</Label>
            <Input value={mpesa.commandId || ''} onChange={(e)=>setMpesa({...mpesa, commandId:e.target.value})} className="bg-input border-border" />
          </div>
          <div className="md:col-span-2">
            <Label>Transaction Type</Label>
            <Input value={mpesa.transactionType || ''} onChange={(e)=>setMpesa({...mpesa, transactionType:e.target.value})} className="bg-input border-border" />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="outline" onClick={async ()=>{
              setMpesa(settings.mpesa || defaultMpesaSettings)
            }}>Reset</Button>
            <Button onClick={async ()=>{
              setSaving(true)
              try {
                const updated = { ...settings, mpesa }
                setSettings(updated)
                saveSettings(updated)
                await saveSettingsToDb(updated)
                toast({ title: 'Success', description: 'M-Pesa settings saved successfully' })
              } catch (err: any) {
                toast({ title: 'Error', description: err?.message || 'Failed to save settings', variant: 'destructive' })
              } finally {
                setSaving(false)
              }
            }} disabled={saving}>Save M-Pesa Settings</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">M-Pesa STK Push Test (Buy Goods)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Test M-Pesa STK Push payment initiation using Buy Goods algorithm (CustomerBuyGoodsOnline). This will send a prompt to the specified phone number. <span className="font-medium">Minimum amount: 5 KES</span></p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="testPhone">Phone Number</Label>
              <Input
                id="testPhone"
                placeholder="254722241745"
                value={testStkPhone}
                onChange={(e) => setTestStkPhone(e.target.value)}
                className="bg-input border-border"
              />
            </div>
            <div>
              <Label htmlFor="testAmount">Amount (KES)</Label>
              <Input
                id="testAmount"
                type="number"
                placeholder="5"
                value={testStkAmount}
                onChange={(e) => setTestStkAmount(e.target.value)}
                className="bg-input border-border"
                min="5"
                max="150000"
                step="1"
              />
            </div>
          </div>

          <Button
            onClick={handleTestStkPush}
            disabled={testStkLoading}
            className="w-full"
          >
            {testStkLoading ? 'Initiating...' : 'Send STK Push'}
          </Button>

          {testStkResult && (
            <div className={`p-4 rounded-md border ${testStkResult.success ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'}`}>
              <p className={`font-semibold mb-2 ${testStkResult.success ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                {testStkResult.success ? '✓ Success' : '✗ Error'}
              </p>
              {testStkResult.success ? (
                <div className="text-sm text-green-800 dark:text-green-200 space-y-2">
                  <p><strong>Phone:</strong> {testStkPhone}</p>
                  <p><strong>Amount:</strong> KES {testStkAmount}</p>
                  <p><strong>Checkout Request ID:</strong> {testStkResult.data?.checkout_request_id || 'N/A'}</p>
                  <p><strong>Merchant Request ID:</strong> {testStkResult.data?.merchant_request_id || 'N/A'}</p>
                  <p><strong>Response Code:</strong> {testStkResult.data?.response_code || 'N/A'}</p>
                  {testStkResult.data?.response_description && (
                    <p><strong>Description:</strong> {testStkResult.data.response_description}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-800 dark:text-red-200">{testStkResult.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Feature Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Enable Referral Program</p>
              <p className="text-sm text-muted-foreground">Allow discounts and commission benefits</p>
            </div>
            <Switch checked={settings.enableReferralProgram} onCheckedChange={(v) => update({ enableReferralProgram: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Send system emails to users</p>
            </div>
            <Switch checked={settings.emailNotifications} onCheckedChange={(v) => update({ emailNotifications: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Maintenance Mode</p>
              <p className="text-sm text-muted-foreground">Show maintenance banner and restrict actions</p>
            </div>
            <Switch checked={settings.maintenanceMode} onCheckedChange={(v) => update({ maintenanceMode: v })} />
          </div>
          <Button onClick={handleSave} disabled={saving} variant="outline" size="sm" className="border-border">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Referral Program</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientDiscount">Client Discount (%)</Label>
              <Input id="clientDiscount" type="number" min={0} max={100} value={settings.referralClientDiscount}
                onChange={(e) => update({ referralClientDiscount: Number(e.target.value) })}
                className="bg-input border-border" />
              <Label htmlFor="clientBookings" className="mt-3 block">Client Discount Lasts (bookings)</Label>
              <Input id="clientBookings" type="number" min={1} value={settings.referralClientBookings}
                onChange={(e) => update({ referralClientBookings: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="trainerDiscount">Trainer Commission Discount (%)</Label>
              <Input id="trainerDiscount" type="number" min={0} max={100} value={settings.referralTrainerDiscount}
                onChange={(e) => update({ referralTrainerDiscount: Number(e.target.value) })}
                className="bg-input border-border" />
              <Label htmlFor="trainerBookings" className="mt-3 block">Trainer Discount Lasts (bookings)</Label>
              <Input id="trainerBookings" type="number" min={1} value={settings.referralTrainerBookings}
                onChange={(e) => update({ referralTrainerBookings: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="referrerPct">Affiliate: Referrer Award (%)</Label>
              <Input id="referrerPct" type="number" min={0} max={100} value={settings.referralReferrerPercent}
                onChange={(e)=>update({ referralReferrerPercent: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="referredPct">Affiliate: Referred Award (%)</Label>
              <Input id="referredPct" type="number" min={0} max={100} value={settings.referralReferredPercent}
                onChange={(e)=>update({ referralReferredPercent: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Require referral code on first booking</p>
              <p className="text-sm text-muted-foreground">Show a prompt to enter a referral code on the first booking.</p>
            </div>
            <Switch checked={settings.promptReferralOnFirstBooking} onCheckedChange={(v)=>update({ promptReferralOnFirstBooking: v })} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Apply referral discount immediately</p>
              <p className="text-sm text-muted-foreground">If a valid code is provided, discount is applied to the current booking.</p>
            </div>
            <Switch checked={settings.applyReferralDiscountImmediately} onCheckedChange={(v)=>update({ applyReferralDiscountImmediately: v })} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Use referrer's phone number as referral code</p>
              <p className="text-sm text-muted-foreground">When enabled, the referrer's primary phone number will be used as the referral code.</p>
            </div>
            <Switch checked={settings.useReferrerPhoneAsCode} onCheckedChange={(v) => update({ useReferrerPhoneAsCode: v })} />
          </div>

          <Button onClick={handleSave} disabled={saving} variant="outline" size="sm" className="border-border">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Platform Charges</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="chargeTrainer">Charge Trainer (%)</Label>
            <Input id="chargeTrainer" type="number" min={0} max={100} value={settings.platformChargeTrainerPercent}
              onChange={(e)=>update({ platformChargeTrainerPercent: Number(e.target.value) })}
              className="bg-input border-border" />
          </div>
          <div>
            <Label htmlFor="chargeClient">Charge Client (%)</Label>
            <Input id="chargeClient" type="number" min={0} max={100} value={settings.platformChargeClientPercent}
              onChange={(e)=>update({ platformChargeClientPercent: Number(e.target.value) })}
              className="bg-input border-border" />
          </div>
          <div>
            <Label htmlFor="compPct">Compensation Fee (%)</Label>
            <Input id="compPct" type="number" min={0} max={100} value={settings.compensationFeePercent}
              onChange={(e)=>update({ compensationFeePercent: Number(e.target.value) })}
              className="bg-input border-border" />
          </div>
          <div>
            <Label htmlFor="maintPct">Maintenance Fee (%)</Label>
            <Input id="maintPct" type="number" min={0} max={100} value={settings.maintenanceFeePercent}
              onChange={(e)=>update({ maintenanceFeePercent: Number(e.target.value) })}
              className="bg-input border-border" />
          </div>
          <div className="md:col-span-2">
            <Button onClick={handleSave} disabled={saving} variant="outline" size="sm" className="border-border">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="pt-6">
        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          Sign Out
        </Button>
      </div>
    </div>
  )

  if (loading) return null
  if (!user || userType !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="">
          <div className="flex flex-col md:flex-row gap-6">
            <AdminSidebar value={activeTab} onChange={setActiveTab} onSignOut={handleSignOut} />

            <main className="flex-1">
              <div className="hidden md:block mb-4">
              </div>

              <div className="space-y-6">
                <TabsContent value="overview">{renderOverview()}</TabsContent>
                <TabsContent value="approvals">{renderApprovals()}</TabsContent>
                <TabsContent value="users">{renderUsers()}</TabsContent>
                <TabsContent value="disputes">{renderDisputes()}</TabsContent>
                <TabsContent value="issues">{renderIssues()}</TabsContent>
                <TabsContent value="contacts">
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-3xl font-bold text-foreground">Contacts Management</h1>
                      <p className="text-sm text-muted-foreground mt-2">Manage contacts - capture name, phone, and type (Client or Trainer)</p>
                    </div>
                    <ContactsList onRefresh={() => setActiveTab('contacts')} />
                  </div>
                </TabsContent>
                <TabsContent value="analytics">{renderAnalytics()}</TabsContent>
                <TabsContent value="promotions">{renderPromotions()}</TabsContent>
                <TabsContent value="payouts"><AdminPayoutManager /></TabsContent>
                <TabsContent value="sms"><AdminSMSManager /></TabsContent>
                <TabsContent value="categories">{renderCategories()}</TabsContent>
                <TabsContent value="waitlist">
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-3xl font-bold text-foreground">Waiting List Management</h1>
                      <p className="text-sm text-muted-foreground mt-2">Manage Trainer app launch waiting list entries</p>
                    </div>
                    <WaitingListManager />
                  </div>
                </TabsContent>
                <TabsContent value="settings">{renderSettings()}</TabsContent>
              </div>
            </main>
          </div>
        </Tabs>
      </div>

      <AlertDialog open={confirmModal.open} onOpenChange={(open) => {
        if (!open) setConfirmModal({ ...confirmModal, open: false })
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmModal.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmModal.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmLoading(true)
                try {
                  await confirmModal.action()
                } finally {
                  setConfirmLoading(false)
                  setConfirmModal({ ...confirmModal, open: false })
                }
              }}
              disabled={confirmLoading}
              className={confirmModal.isDestructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {confirmLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
