import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Play, CheckCircle, AlertCircle, Clock, RefreshCw, Download, Copy } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface MigrationLog {
  id: string
  timestamp: string
  status: 'success' | 'error' | 'progress'
  message: string
  details?: string
}

interface MigrationResult {
  status: string
  message: string
  tables_created: number
  tables_failed: number
  created_tables: string[]
  failed_tables: Array<{ table: string; error: string }>
  timestamp: string
}

interface MigrationHistory {
  id: string
  timestamp: string
  result: MigrationResult
  duration: number
}

export default function MpesaMigration() {
  const [loading, setLoading] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [logs, setLogs] = useState<MigrationLog[]>([])
  const [results, setResults] = useState<MigrationResult | null>(null)
  const [history, setHistory] = useState<MigrationHistory[]>([])
  const [activeTab, setActiveTab] = useState('migrate')

  // Load migration history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('mpesa_migration_history')
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory))
      } catch (err) {
        console.warn('Failed to load migration history', err)
      }
    }
  }, [])

  // Add log entry
  const addLog = (status: 'success' | 'error' | 'progress', message: string, details?: string) => {
    const newLog: MigrationLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      status,
      message,
      details
    }
    setLogs(prev => [newLog, ...prev])
  }

  // Trigger migration
  const triggerMigration = async () => {
    setMigrating(true)
    setLogs([])
    setResults(null)

    const startTime = Date.now()

    try {
      addLog('progress', 'Starting M-Pesa tables migration...', 'Connecting to API')

      const response = await fetch('/admin/mpesamigration', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: MigrationResult = await response.json()

      addLog('progress', 'Migration request completed', `Status: ${data.status}`)

      // Simulate real-time progress
      if (data.created_tables) {
        for (let i = 0; i < data.created_tables.length; i++) {
          const tableName = data.created_tables[i]
          const isError = data.created_tables[i].includes('(already exists)')
          await new Promise(resolve => setTimeout(resolve, 200))
          addLog(
            'success',
            `Table created/verified: ${tableName}`,
            `Progress: ${i + 1}/${data.created_tables.length}`
          )
        }
      }

      // Report failures if any
      if (data.failed_tables && data.failed_tables.length > 0) {
        for (const failure of data.failed_tables) {
          addLog('error', `Failed to create table: ${failure.table}`, failure.error)
        }
      }

      // Final result
      const duration = Math.round((Date.now() - startTime) / 1000)
      setResults(data)

      addLog(
        data.tables_failed === 0 ? 'success' : 'error',
        data.tables_failed === 0 ? 'Migration completed successfully!' : 'Migration completed with errors',
        `${data.tables_created} tables created, ${data.tables_failed} failed in ${duration}s`
      )

      // Save to history
      const newHistory: MigrationHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        result: data,
        duration
      }
      const updated = [newHistory, ...history].slice(0, 20)
      setHistory(updated)
      localStorage.setItem('mpesa_migration_history', JSON.stringify(updated))

      // Show success toast
      toast({
        title: 'Migration Complete',
        description: `${data.tables_created} tables created successfully`,
        variant: data.tables_failed === 0 ? 'default' : 'destructive'
      })
    } catch (err: any) {
      addLog('error', 'Migration failed', err?.message || 'Unknown error')
      toast({
        title: 'Migration Failed',
        description: err?.message || 'An error occurred',
        variant: 'destructive'
      })
    } finally {
      setMigrating(false)
    }
  }

  // Copy logs to clipboard
  const copyLogsToClipboard = () => {
    const logText = logs.map(l => `[${l.timestamp}] ${l.status.toUpperCase()}: ${l.message}${l.details ? ` - ${l.details}` : ''}`).join('\n')
    navigator.clipboard.writeText(logText)
    toast({ title: 'Copied', description: 'Logs copied to clipboard' })
  }

  // Clear logs
  const clearLogs = () => {
    setLogs([])
    setResults(null)
  }

  // Clear history
  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem('mpesa_migration_history')
    toast({ title: 'Cleared', description: 'Migration history cleared' })
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">M-Pesa Database Migration</h1>
          <p className="text-muted-foreground">Create and manage M-Pesa payment system tables</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="migrate">Migration</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Migration Tab */}
          <TabsContent value="migrate" className="space-y-6">
            {/* Control Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Migration Control</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearLogs}
                      disabled={logs.length === 0 || migrating}
                    >
                      Clear Logs
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={triggerMigration}
                  disabled={migrating}
                  size="lg"
                  className="w-full"
                >
                  {migrating ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Migration in Progress...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Migration
                    </>
                  )}
                </Button>

                {results && (
                  <div className="space-y-3">
                    <Alert className={results.tables_failed === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                      <AlertCircle className={`h-4 w-4 ${results.tables_failed === 0 ? 'text-green-600' : 'text-red-600'}`} />
                      <AlertTitle className={results.tables_failed === 0 ? 'text-green-900' : 'text-red-900'}>
                        {results.message}
                      </AlertTitle>
                      <AlertDescription className={results.tables_failed === 0 ? 'text-green-800' : 'text-red-800'}>
                        {results.tables_created} tables created, {results.tables_failed} failed
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <p className="text-blue-600 font-semibold text-lg">{results.tables_created}</p>
                        <p className="text-blue-700 text-xs">Tables Created</p>
                      </div>
                      <div className={`${results.tables_failed === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded p-3`}>
                        <p className={`${results.tables_failed === 0 ? 'text-green-600' : 'text-red-600'} font-semibold text-lg`}>
                          {results.tables_failed}
                        </p>
                        <p className={`${results.tables_failed === 0 ? 'text-green-700' : 'text-red-700'} text-xs`}>Failed</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Real-time Progress Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Real-time Progress</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={copyLogsToClipboard}
                      disabled={logs.length === 0}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96 border rounded-lg bg-black p-4">
                  {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>No migration logs yet. Start migration to see progress.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 font-mono text-sm">
                      {logs.map(log => (
                        <div key={log.id} className={`flex gap-2 ${
                          log.status === 'success' ? 'text-green-400' :
                          log.status === 'error' ? 'text-red-400' :
                          'text-blue-400'
                        }`}>
                          <span className="flex-shrink-0 text-xs text-muted-foreground">[{log.timestamp}]</span>
                          <span className="flex-shrink-0">
                            {log.status === 'success' ? '✓' : log.status === 'error' ? '✗' : '○'}
                          </span>
                          <div className="flex-1">
                            <div>{log.message}</div>
                            {log.details && <div className="text-xs opacity-75">{log.details}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Created Tables */}
            {results?.created_tables && results.created_tables.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Created Tables</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {results.created_tables.map(table => (
                      <div key={table} className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-green-900 font-mono">{table}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Failed Tables */}
            {results?.failed_tables && results.failed_tables.length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-red-900">Failed Tables</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {results.failed_tables.map((failure, idx) => (
                      <div key={idx} className="border-l-4 border-red-600 pl-3 py-2">
                        <p className="font-mono text-sm font-bold text-red-900">{failure.table}</p>
                        <p className="text-xs text-red-700 mt-1">{failure.error}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Migration History</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={clearHistory}
                    disabled={history.length === 0}
                  >
                    Clear History
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">No migration history yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map(entry => (
                      <div key={entry.id} className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {new Date(entry.timestamp).toLocaleString()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Duration: {entry.duration}s
                            </p>
                          </div>
                          <Badge className={entry.result.tables_failed === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {entry.result.tables_failed === 0 ? 'Success' : 'Failed'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="bg-blue-50 border border-blue-200 rounded p-2">
                            <p className="font-semibold text-blue-900">{entry.result.tables_created}</p>
                            <p className="text-xs text-blue-700">Created</p>
                          </div>
                          <div className="bg-red-50 border border-red-200 rounded p-2">
                            <p className="font-semibold text-red-900">{entry.result.tables_failed}</p>
                            <p className="text-xs text-red-700">Failed</p>
                          </div>
                          <div className="bg-gray-50 border border-gray-200 rounded p-2">
                            <p className="font-semibold text-gray-900">{entry.duration}s</p>
                            <p className="text-xs text-gray-700">Time</p>
                          </div>
                        </div>

                        {entry.result.failed_tables.length > 0 && (
                          <div className="text-xs bg-red-50 border border-red-200 rounded p-2 text-red-700">
                            <p className="font-semibold mb-1">Failed tables:</p>
                            {entry.result.failed_tables.map((f, idx) => (
                              <p key={idx}>• {f.table}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Table Info Card */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">What Gets Created</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-900 space-y-2">
                <p>• <span className="font-mono">stk_push_sessions</span> - STK Push payment tracking</p>
                <p>• <span className="font-mono">user_wallets</span> - User wallet balances</p>
                <p>• <span className="font-mono">wallet_transactions</span> - Transaction history</p>
                <p>• <span className="font-mono">payments</span> - Payment records</p>
                <p>• <span className="font-mono">b2c_payments</span> - B2C payouts</p>
                <p>• <span className="font-mono">b2c_payment_callbacks</span> - M-Pesa callbacks</p>
                <p>• <span className="font-mono">payout_requests</span> - Trainer payout requests</p>
                <p>• <span className="font-mono">payment_methods</span> - Saved payment methods</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
