import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Key } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import ThemeToggleAdmin from '@/components/admin/ThemeToggleAdmin'
import { loadSettings, saveSettings, defaultSettings, defaultMpesaSettings, type PlatformSettings, type MpesaSettings, loadSettingsFromDb, saveSettingsToDb } from '@/lib/settings'
import { apiRequest } from '@/lib/api'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings)
  const [mpesa, setMpesa] = useState<MpesaSettings>(defaultMpesaSettings)
  const [saving, setSaving] = useState(false)
  const [announcementTarget, setAnnouncementTarget] = useState<'all' | 'clients' | 'trainers' | 'admins'>('all')
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false)
  const [testStkPhone, setTestStkPhone] = useState('254722241745')
  const [testStkAmount, setTestStkAmount] = useState('5')
  const [testStkLoading, setTestStkLoading] = useState(false)
  const [testStkResult, setTestStkResult] = useState<any>(null)

  useEffect(() => {
    const loaded = loadSettings()
    setSettings(loaded)
    if (loaded.mpesa) setMpesa(loaded.mpesa)
    loadSettingsFromDb()
      .then((db) => {
        if (db) {
          setSettings(db)
          if (db.mpesa) setMpesa(db.mpesa)
        }
      })
      .catch(() => {})
  }, [])

  const update = (patch: Partial<PlatformSettings>) => setSettings((prev) => ({ ...prev, ...patch }))

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
      })
      toast({ title: 'Success', description: 'Announcement sent' })
      setAnnouncementTitle('')
      setAnnouncementBody('')
    } finally {
      setSendingAnnouncement(false)
    }
  }

  const handleTestStkPush = async () => {
    if (!testStkPhone.trim()) {
      toast({ title: 'Error', description: 'Please enter a phone number', variant: 'destructive' })
      return
    }
    if (!testStkAmount.trim() || isNaN(Number(testStkAmount)) || Number(testStkAmount) <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' })
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

      const responseText = await response.text()
      const result = JSON.parse(responseText)

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

  const handleSignOut = async () => {
    try {
      await signOut()
      window.location.href = '/'
    } catch (err) {
      // ignore errors during sign out
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground">System Settings</h1>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Admin Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={() => navigate('/admin/reset-passwords')} variant="outline" className="justify-start border-border h-auto py-4">
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
              <Input id="platformName" value={settings.platformName} onChange={(e) => update({ platformName: e.target.value })} className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input id="supportEmail" type="email" value={settings.supportEmail} onChange={(e) => update({ supportEmail: e.target.value })} className="bg-input border-border" />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={settings.currency} onValueChange={(v) => update({ currency: v as any })}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
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
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
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
              <Input id="commission" type="number" min={0} max={100} value={settings.commissionRate} onChange={(e) => update({ commissionRate: Number(e.target.value) })} className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="taxRate">Tax/VAT (%)</Label>
              <Input id="taxRate" type="number" min={0} max={100} value={settings.taxRate} onChange={(e) => update({ taxRate: Number(e.target.value) })} className="bg-input border-border" />
            </div>
            <div>
              <Label>Payout Schedule</Label>
              <Select value={settings.payoutSchedule} onValueChange={(v) => update({ payoutSchedule: v as any })}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
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
            <Select value={announcementTarget} onValueChange={(v) => setAnnouncementTarget(v as any)}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue />
              </SelectTrigger>
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
            <Input value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} className="bg-input border-border" />
          </div>
          <div>
            <Label>Message</Label>
            <textarea value={announcementBody} onChange={(e) => setAnnouncementBody(e.target.value)} className="w-full p-2 border border-border rounded-md bg-input" rows={4} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => {
              setAnnouncementTitle('')
              setAnnouncementBody('')
              setAnnouncementTarget('all')
            }}>
              Clear
            </Button>
            <Button onClick={sendAnnouncement} disabled={sendingAnnouncement}>
              {sendingAnnouncement ? 'Sending…' : 'Send Announcement'}
            </Button>
          </div>
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

      <div className="pt-6">
        <Button onClick={handleSignOut} variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
          Sign Out
        </Button>
      </div>
    </div>
  )
}
