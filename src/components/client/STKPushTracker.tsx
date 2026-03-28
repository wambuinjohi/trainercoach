import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, CheckCircle, AlertCircle, Clock, Eye, EyeOff } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface STKSession {
  id: string
  phone_number: string
  amount: number
  booking_id?: string
  account_reference: string
  description?: string
  checkout_request_id: string
  status: string
  result_code?: string
  result_description?: string
  created_at: string
  updated_at: string
  retry_count?: number
  should_retry?: boolean
  next_retry_at?: string
}

export const STKPushTracker: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<STKSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<STKSession | null>(null)
  const [pollingSessions, setPollingSessions] = useState<Set<string>>(new Set())
  const [showDetails, setShowDetails] = useState<Set<string>>(new Set())
  const [retrySessions, setRetrySessions] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadSessions()
    const interval = setInterval(loadSessions, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const data = await apiRequest('stk_push_history', { limit: 20, offset: 0 }, { headers: withAuth() })
      if (data?.data) {
        setSessions(Array.isArray(data.data) ? data.data : [])
      }
    } catch (err) {
      console.warn('Failed to load STK sessions', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshSession = async (sessionId: string) => {
    try {
      const session = sessions.find(s => s.id === sessionId)
      if (!session) return

      setPollingSessions(prev => new Set(prev).add(sessionId))
      
      const data = await apiRequest('stk_push_query', { checkout_request_id: session.checkout_request_id }, { headers: withAuth() })
      
      if (data?.data) {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...data.data } : s))
        
        if (data.data.status === 'success') {
          toast({ title: 'Payment successful!', description: `Payment of Ksh ${session.amount} confirmed` })
        } else if (data.data.status === 'failed' || data.data.status === 'timeout') {
          toast({ title: 'Payment failed', description: data.data.result_description || 'Payment was not successful', variant: 'destructive' })
        }
      }
    } catch (err) {
      console.warn('Failed to refresh session', err)
      toast({ title: 'Error', description: 'Failed to check payment status', variant: 'destructive' })
    } finally {
      setPollingSessions(prev => {
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })
    }
  }

  const toggleDetails = (sessionId: string) => {
    setShowDetails(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  const retrySession = async (sessionId: string) => {
    try {
      const session = sessions.find(s => s.id === sessionId)
      if (!session) return

      setRetrySessions(prev => new Set(prev).add(sessionId))

      const data = await apiRequest('stk_push_retry', { checkout_request_id: session.checkout_request_id }, { headers: withAuth() })

      if (data?.data) {
        toast({ title: 'Retry scheduled', description: 'The system will attempt the payment again shortly' })
        // Refresh the session immediately to show updated status
        await new Promise(resolve => setTimeout(resolve, 500))
        await loadSessions()
      }
    } catch (err) {
      console.warn('Failed to retry payment', err)
      toast({ title: 'Error', description: 'Failed to schedule payment retry', variant: 'destructive' })
    } finally {
      setRetrySessions(prev => {
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return 'bg-green-100 text-green-800'
      case 'pending':
      case 'initiated':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
      case 'timeout':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'pending':
      case 'initiated':
        return <Clock className="h-5 w-5 text-yellow-600 animate-pulse" />
      case 'failed':
      case 'timeout':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const successCount = sessions.filter(s => s.status?.toLowerCase() === 'success').length
  const failedCount = sessions.filter(s => ['failed', 'timeout'].includes(s.status?.toLowerCase())).length
  const pendingCount = sessions.filter(s => ['pending', 'initiated'].includes(s.status?.toLowerCase())).length

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Transactions</p>
            <p className="text-2xl font-bold mt-1">{sessions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Successful</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{successCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{failedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sessions List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payment Transactions</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={loadSessions}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </CardHeader>
        <CardContent>
          {loading && sessions.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No payment transactions yet</p>
            </div>
          ) : (
            <Tabs defaultValue="all" className="w-full">
              <TabsList>
                <TabsTrigger value="all">All ({sessions.length})</TabsTrigger>
                <TabsTrigger value="success">Successful ({successCount})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
                <TabsTrigger value="failed">Failed ({failedCount})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-3 mt-4">
                {sessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onRefresh={() => refreshSession(session.id)}
                    isRefreshing={pollingSessions.has(session.id)}
                    showDetails={showDetails.has(session.id)}
                    onToggleDetails={() => toggleDetails(session.id)}
                    onRetry={() => retrySession(session.id)}
                    isRetrying={retrySessions.has(session.id)}
                  />
                ))}
              </TabsContent>

              <TabsContent value="success" className="space-y-3 mt-4">
                {sessions
                  .filter(s => s.status?.toLowerCase() === 'success')
                  .map(session => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onRefresh={() => refreshSession(session.id)}
                      isRefreshing={pollingSessions.has(session.id)}
                      showDetails={showDetails.has(session.id)}
                      onToggleDetails={() => toggleDetails(session.id)}
                      onRetry={() => retrySession(session.id)}
                      isRetrying={retrySessions.has(session.id)}
                    />
                  ))}
              </TabsContent>

              <TabsContent value="pending" className="space-y-3 mt-4">
                {sessions
                  .filter(s => ['pending', 'initiated'].includes(s.status?.toLowerCase()))
                  .map(session => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onRefresh={() => refreshSession(session.id)}
                      isRefreshing={pollingSessions.has(session.id)}
                      showDetails={showDetails.has(session.id)}
                      onToggleDetails={() => toggleDetails(session.id)}
                      onRetry={() => retrySession(session.id)}
                      isRetrying={retrySessions.has(session.id)}
                    />
                  ))}
              </TabsContent>

              <TabsContent value="failed" className="space-y-3 mt-4">
                {sessions
                  .filter(s => ['failed', 'timeout'].includes(s.status?.toLowerCase()))
                  .map(session => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onRefresh={() => refreshSession(session.id)}
                      isRefreshing={pollingSessions.has(session.id)}
                      showDetails={showDetails.has(session.id)}
                      onToggleDetails={() => toggleDetails(session.id)}
                      onRetry={() => retrySession(session.id)}
                      isRetrying={retrySessions.has(session.id)}
                    />
                  ))}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {onClose && (
        <Button variant="outline" onClick={onClose} className="w-full">
          Close
        </Button>
      )}
    </div>
  )
}

interface SessionCardProps {
  session: STKSession
  onRefresh: () => void
  isRefreshing: boolean
  showDetails: boolean
  onToggleDetails: () => void
  onRetry: () => void
  isRetrying: boolean
}

const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onRefresh,
  isRefreshing,
  showDetails,
  onToggleDetails,
  onRetry,
  isRetrying
}) => {
  const isRetryable = ['failed', 'timeout'].includes(session.status?.toLowerCase())
  const nextRetryTime = session.next_retry_at ? new Date(session.next_retry_at) : null
  const now = new Date()
  const retryReady = !nextRetryTime || nextRetryTime <= now

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {getStatusIcon(session.status)}
            <div>
              <p className="font-semibold">Ksh {session.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</p>
              <p className="text-sm text-muted-foreground">{session.description}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge className={getStatusColor(session.status)}>
            {session.status}
          </Badge>
          {isRetryable && session.retry_count !== undefined && (
            <span className="text-xs text-muted-foreground">
              Retries: {session.retry_count}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          <p>Phone: {session.phone_number}</p>
          <p className="text-xs">{new Date(session.created_at).toLocaleString()}</p>
        </div>
      </div>

      {isRetryable && nextRetryTime && !retryReady && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
          <p>Next retry: {nextRetryTime.toLocaleString()}</p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {['pending', 'initiated'].includes(session.status?.toLowerCase()) && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check Status'}
          </Button>
        )}
        {isRetryable && (
          <Button
            size="sm"
            variant={retryReady ? 'default' : 'outline'}
            onClick={onRetry}
            disabled={isRetrying || !retryReady}
          >
            {isRetrying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Retry Payment'}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onToggleDetails}
        >
          {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>

      {showDetails && (
        <div className="bg-gray-50 p-3 rounded text-sm space-y-2 border-t mt-3 pt-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">Checkout ID:</p>
            <p className="font-mono text-xs break-all">{session.checkout_request_id}</p>
          </div>
          {session.result_code && (
            <div>
              <p className="font-mono text-xs text-muted-foreground">Result Code:</p>
              <p className="font-mono text-xs">{session.result_code}</p>
            </div>
          )}
          {session.result_description && (
            <div>
              <p className="font-mono text-xs text-muted-foreground">Result:</p>
              <p className="font-mono text-xs">{session.result_description}</p>
            </div>
          )}
          <div>
            <p className="font-mono text-xs text-muted-foreground">Reference:</p>
            <p className="font-mono text-xs">{session.account_reference}</p>
          </div>
          {isRetryable && session.retry_count !== undefined && (
            <>
              <div>
                <p className="font-mono text-xs text-muted-foreground">Retry Count:</p>
                <p className="font-mono text-xs">{session.retry_count}</p>
              </div>
              {session.next_retry_at && (
                <div>
                  <p className="font-mono text-xs text-muted-foreground">Next Retry:</p>
                  <p className="font-mono text-xs">{new Date(session.next_retry_at).toLocaleString()}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function getStatusIcon(status: string) {
  switch (status?.toLowerCase()) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-green-600" />
    case 'pending':
    case 'initiated':
      return <Clock className="h-5 w-5 text-yellow-600 animate-pulse" />
    case 'failed':
    case 'timeout':
      return <AlertCircle className="h-5 w-5 text-red-600" />
    default:
      return <Clock className="h-5 w-5 text-gray-600" />
  }
}
