import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { MessageSquare, Send, RotateCw, Trash2, Edit2, Eye, Plus } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

interface SmsSettings {
  sms_configured: boolean
  sms_enabled: boolean
  sms_sender_id: string
  api_key_exists: boolean
  client_id_exists: boolean
  access_key_exists: boolean
}

interface SmsTemplate {
  id: string
  name: string
  event_type: string
  template_text: string
  active: boolean
  created_at: string
  updated_at: string
}

interface SmsLog {
  id: string
  user_id?: string
  phone_number: string
  message: string
  template_id?: string
  event_type: string
  event_id?: string
  status: string
  sent_at?: string
  created_at: string
}

const EVENT_TYPES = ['registration', 'payment', 'booking', 'payout', 'custom']

export const AdminSMSManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('settings')
  const [smsSettings, setSmsSettings] = useState<SmsSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    sms_api_key: '',
    sms_client_id: '',
    sms_access_key: '',
    sms_sender_id: 'trainerltd',
    enabled: true,
  })

  // Templates
  const [templates, setTemplates] = useState<SmsTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<SmsTemplate | null>(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateForm, setTemplateForm] = useState({
    id: '',
    name: '',
    event_type: 'custom',
    template_text: '',
    active: true,
  })

  // Send SMS
  const [sendForm, setSendForm] = useState({
    phone_numbers: '',
    message: '',
    user_group: 'all',
  })
  const [sendMode, setSendMode] = useState<'manual' | 'group'>('manual')
  const [sending, setSending] = useState(false)

  // Logs
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsFilters, setLogsFilters] = useState({
    event_type: 'all',
    status: 'all',
    limit: 50,
    offset: 0,
  })
  const [totalLogs, setTotalLogs] = useState(0)

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    action: () => Promise<void>
    isDangerous?: boolean
  }>({
    open: false,
    title: '',
    description: '',
    action: async () => {},
    isDangerous: false,
  })
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Load initial data
  useEffect(() => {
    loadSmsSettings()
    loadTemplates()
  }, [])

  // Reload logs when filters change
  useEffect(() => {
    if (activeTab === 'history') {
      loadSmsLogs()
    }
  }, [activeTab, logsFilters])

  const loadSmsSettings = async () => {
    setLoading(true)
    try {
      const res = await apiRequest('settings_sms_get', {})
      if (res.data) {
        setSmsSettings(res.data)
        if (res.data.sms_configured) {
          setSettingsForm((prev) => ({
            ...prev,
            sms_sender_id: res.data.sms_sender_id || 'trainerltd',
            enabled: res.data.sms_enabled !== false,
          }))
        }
      }
    } catch (error) {
      console.error('Failed to load SMS settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to load SMS settings',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settingsForm.sms_api_key || !settingsForm.sms_client_id || !settingsForm.sms_access_key) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields: API Key, Client ID, Access Key',
        variant: 'destructive',
      })
      return
    }

    setSavingSettings(true)
    try {
      await apiRequest('settings_sms_save', {
        sms_settings: settingsForm,
      })
      toast({
        title: 'Success',
        description: 'SMS settings saved successfully',
      })
      loadSmsSettings()
    } catch (error) {
      console.error('Failed to save SMS settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to save SMS settings',
        variant: 'destructive',
      })
    } finally {
      setSavingSettings(false)
    }
  }

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const res = await apiRequest('sms_templates_get', {})
      if (res.data && Array.isArray(res.data)) {
        setTemplates(res.data)
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const openTemplateForm = (template?: SmsTemplate) => {
    if (template) {
      setTemplateForm({
        id: template.id,
        name: template.name,
        event_type: template.event_type,
        template_text: template.template_text,
        active: template.active,
      })
    } else {
      setTemplateForm({
        id: '',
        name: '',
        event_type: 'custom',
        template_text: '',
        active: true,
      })
    }
    setShowTemplateModal(true)
  }

  const saveTemplate = async () => {
    if (!templateForm.name || !templateForm.event_type || !templateForm.template_text) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    setSavingSettings(true)
    try {
      await apiRequest('sms_templates_save', {
        template: templateForm,
      })
      toast({
        title: 'Success',
        description: `Template ${templateForm.id ? 'updated' : 'created'} successfully`,
      })
      setShowTemplateModal(false)
      loadTemplates()
    } catch (error) {
      console.error('Failed to save template:', error)
      toast({
        title: 'Error',
        description: 'Failed to save template',
        variant: 'destructive',
      })
    } finally {
      setSavingSettings(false)
    }
  }

  const deleteTemplate = async (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Template',
      description: 'Are you sure you want to delete this SMS template? This action cannot be undone.',
      isDangerous: true,
      action: async () => {
        try {
          await apiRequest('sms_templates_delete', { template_id: id })
          toast({
            title: 'Success',
            description: 'Template deleted successfully',
          })
          loadTemplates()
        } catch (error) {
          toast({
            title: 'Error',
            description: 'Failed to delete template',
            variant: 'destructive',
          })
        }
      },
    })
  }

  const sendSMS = async () => {
    if (!sendForm.message.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a message',
        variant: 'destructive',
      })
      return
    }

    if (sendMode === 'manual' && !sendForm.phone_numbers.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter at least one phone number',
        variant: 'destructive',
      })
      return
    }

    if (sendMode === 'group' && !sendForm.user_group) {
      toast({
        title: 'Validation Error',
        description: 'Please select a user group',
        variant: 'destructive',
      })
      return
    }

    setSending(true)
    try {
      const payload: any = {
        message: sendForm.message,
      }

      if (sendMode === 'manual') {
        payload.phone_numbers = sendForm.phone_numbers
          .split('\n')
          .map((p) => p.trim())
          .filter((p) => p)
      } else {
        payload.user_group = sendForm.user_group
      }

      const res = await apiRequest('sms_send_manual', payload)
      
      toast({
        title: 'Success',
        description: `SMS sent to ${res.data?.sent_count || 0} recipient(s)`,
      })

      // Reset form
      setSendForm({
        phone_numbers: '',
        message: '',
        user_group: 'all',
      })

      // Reload logs
      loadSmsLogs()
    } catch (error) {
      console.error('Failed to send SMS:', error)
      toast({
        title: 'Error',
        description: 'Failed to send SMS',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  const loadSmsLogs = async () => {
    setLogsLoading(true)
    try {
      const payload: any = {
        limit: logsFilters.limit,
        offset: logsFilters.offset,
      }

      if (logsFilters.event_type !== 'all') {
        payload.event_type = logsFilters.event_type
      }

      if (logsFilters.status !== 'all') {
        payload.status = logsFilters.status
      }

      const res = await apiRequest('sms_logs_get', payload)
      if (res.data) {
        setSmsLogs(res.data.data || [])
        setTotalLogs(res.data.total || 0)
      }
    } catch (error) {
      console.error('Failed to load SMS logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      sent: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
    }
    return <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>{status}</Badge>
  }

  const getEventTypeBadge = (eventType: string) => {
    const colors: Record<string, string> = {
      registration: 'bg-blue-100 text-blue-800',
      payment: 'bg-green-100 text-green-800',
      booking: 'bg-purple-100 text-purple-800',
      payout: 'bg-indigo-100 text-indigo-800',
      admin_manual: 'bg-orange-100 text-orange-800',
    }
    return <Badge className={colors[eventType] || 'bg-gray-100 text-gray-800'}>{eventType}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="w-6 h-6" />
        <h2 className="text-3xl font-bold">SMS Management</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="send">Send SMS</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SMS Service Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {smsSettings?.sms_configured ? (
                <div className="bg-green-50 p-4 rounded border border-green-200">
                  <p className="text-green-800 font-semibold">SMS service is configured</p>
                  <p className="text-sm text-green-700">Provider: Onfonmedia</p>
                </div>
              ) : (
                <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                  <p className="text-yellow-800 font-semibold">SMS service not yet configured</p>
                  <p className="text-sm text-yellow-700">Please add your Onfonmedia API credentials below</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="api-key">API Key *</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Enter your Onfonmedia API Key"
                    value={settingsForm.sms_api_key}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        sms_api_key: e.target.value,
                      }))
                    }
                    className="mt-1"
                  />
                  {smsSettings?.api_key_exists && (
                    <p className="text-xs text-gray-500 mt-1">✓ Credentials already stored</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="client-id">Client ID *</Label>
                  <Input
                    id="client-id"
                    type="password"
                    placeholder="Enter your Onfonmedia Client ID"
                    value={settingsForm.sms_client_id}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        sms_client_id: e.target.value,
                      }))
                    }
                    className="mt-1"
                  />
                  {smsSettings?.client_id_exists && (
                    <p className="text-xs text-gray-500 mt-1">✓ Credentials already stored</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="access-key">Access Key *</Label>
                  <Input
                    id="access-key"
                    type="password"
                    placeholder="Enter your Onfonmedia Access Key"
                    value={settingsForm.sms_access_key}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        sms_access_key: e.target.value,
                      }))
                    }
                    className="mt-1"
                  />
                  {smsSettings?.access_key_exists && (
                    <p className="text-xs text-gray-500 mt-1">✓ Credentials already stored</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="sender-id">Sender ID</Label>
                  <Input
                    id="sender-id"
                    placeholder="trainerltd"
                    value={settingsForm.sms_sender_id}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        sms_sender_id: e.target.value,
                      }))
                    }
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">The name that will appear as SMS sender</p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    id="sms-enabled"
                    checked={settingsForm.enabled}
                    onCheckedChange={(checked) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        enabled: checked,
                      }))
                    }
                  />
                  <Label htmlFor="sms-enabled" className="cursor-pointer">
                    Enable SMS sending
                  </Label>
                </div>
              </div>

              <Button
                onClick={saveSettings}
                disabled={savingSettings}
                className="w-full"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">About Onfonmedia</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Onfonmedia provides bulk SMS services in Kenya. To get started:
              </p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>1. Visit https://sms.onfonmedia.co.ke and create an account</li>
                <li>2. Get your API Key, Client ID, and Access Key from the portal</li>
                <li>3. Add them to this form to enable SMS sending</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">SMS Templates</h3>
            <Button onClick={() => openTemplateForm()} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>

          {templates.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                No templates created yet. Create one to get started.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {templates.map((template) => (
                <Card key={template.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{template.name}</h4>
                          {getEventTypeBadge(template.event_type)}
                          {template.active ? (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap max-h-20 overflow-hidden">
                          {template.template_text}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          Created: {new Date(template.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTemplateForm(template)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteTemplate(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Template Modal */}
          {showTemplateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <Card className="w-full max-w-lg mx-4">
                <CardHeader>
                  <CardTitle>
                    {templateForm.id ? 'Edit Template' : 'Create Template'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="template-name">Template Name *</Label>
                    <Input
                      id="template-name"
                      placeholder="e.g., registration_welcome"
                      value={templateForm.name}
                      onChange={(e) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="event-type">Event Type *</Label>
                    <Select value={templateForm.event_type} onValueChange={(value) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        event_type: value,
                      }))
                    }>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="template-text">Message Template *</Label>
                    <Textarea
                      id="template-text"
                      placeholder="Enter SMS template. Use placeholders like {{user_name}}, {{amount}}, {{date}}, {{time}}, {{booking_id}}, {{trainer_name}}"
                      value={templateForm.template_text}
                      onChange={(e) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          template_text: e.target.value,
                        }))
                      }
                      className="mt-1 min-h-24"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Available placeholders: {'{'}user_name{'}'}, {'{'}amount{'}'}, {'{'}date{'}'}, {'{'}time{'}'}, {'{'}booking_id{'}'}, {'{'}trainer_name{'}'}, {'{'}first_name{'}'}, {'{'}reference{'}'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Switch
                      id="template-active"
                      checked={templateForm.active}
                      onCheckedChange={(checked) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          active: checked,
                        }))
                      }
                    />
                    <Label htmlFor="template-active" className="cursor-pointer">
                      Active
                    </Label>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowTemplateModal(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={saveTemplate}
                      disabled={savingSettings}
                      className="flex-1"
                    >
                      {savingSettings ? 'Saving...' : 'Save Template'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* SEND SMS TAB */}
        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Send Bulk SMS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                <Button
                  variant={sendMode === 'manual' ? 'default' : 'outline'}
                  onClick={() => setSendMode('manual')}
                >
                  Send to Specific Numbers
                </Button>
                <Button
                  variant={sendMode === 'group' ? 'default' : 'outline'}
                  onClick={() => setSendMode('group')}
                >
                  Send to User Group
                </Button>
              </div>

              {sendMode === 'manual' ? (
                <div>
                  <Label htmlFor="phone-numbers">Phone Numbers (one per line)</Label>
                  <Textarea
                    id="phone-numbers"
                    placeholder="254712345678&#10;254712345679&#10;254712345680"
                    value={sendForm.phone_numbers}
                    onChange={(e) =>
                      setSendForm((prev) => ({
                        ...prev,
                        phone_numbers: e.target.value,
                      }))
                    }
                    className="mt-1 min-h-24"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="user-group">Select User Group</Label>
                  <Select value={sendForm.user_group} onValueChange={(value) =>
                    setSendForm((prev) => ({
                      ...prev,
                      user_group: value,
                    }))
                  }>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="trainers">All Trainers</SelectItem>
                      <SelectItem value="clients">All Clients</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Enter your SMS message"
                  value={sendForm.message}
                  onChange={(e) =>
                    setSendForm((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  className="mt-1 min-h-24"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Characters: {sendForm.message.length}
                </p>
              </div>

              <Button
                onClick={sendSMS}
                disabled={sending}
                size="lg"
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? 'Sending...' : 'Send SMS'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SMS History & Logs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="filter-event">Event Type</Label>
                  <Select
                    value={logsFilters.event_type}
                    onValueChange={(value) =>
                      setLogsFilters((prev) => ({
                        ...prev,
                        event_type: value,
                        offset: 0,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="registration">Registration</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="booking">Booking</SelectItem>
                      <SelectItem value="payout">Payout</SelectItem>
                      <SelectItem value="admin_manual">Manual Send</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="filter-status">Status</Label>
                  <Select
                    value={logsFilters.status}
                    onValueChange={(value) =>
                      setLogsFilters((prev) => ({
                        ...prev,
                        status: value,
                        offset: 0,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="filter-limit">Limit</Label>
                  <Select
                    value={logsFilters.limit.toString()}
                    onValueChange={(value) =>
                      setLogsFilters((prev) => ({
                        ...prev,
                        limit: parseInt(value),
                        offset: 0,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {logsLoading ? (
                <div className="text-center py-8 text-gray-500">Loading logs...</div>
              ) : smsLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No SMS logs found</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Phone</th>
                          <th className="text-left py-2 px-2">Event Type</th>
                          <th className="text-left py-2 px-2">Status</th>
                          <th className="text-left py-2 px-2">Sent At</th>
                          <th className="text-left py-2 px-2">Message Preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {smsLogs.map((log) => (
                          <tr key={log.id} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-2 font-mono text-xs">{log.phone_number}</td>
                            <td className="py-2 px-2">{getEventTypeBadge(log.event_type)}</td>
                            <td className="py-2 px-2">{getStatusBadge(log.status)}</td>
                            <td className="py-2 px-2 text-xs">
                              {log.sent_at
                                ? new Date(log.sent_at).toLocaleDateString()
                                : new Date(log.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-2 px-2 text-xs text-gray-600 max-w-xs truncate">
                              {log.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center pt-4">
                    <p className="text-sm text-gray-600">
                      Showing {smsLogs.length} of {totalLogs} logs
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={logsFilters.offset === 0}
                        onClick={() =>
                          setLogsFilters((prev) => ({
                            ...prev,
                            offset: Math.max(0, prev.offset - prev.limit),
                          }))
                        }
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={logsFilters.offset + logsFilters.limit >= totalLogs}
                        onClick={() =>
                          setLogsFilters((prev) => ({
                            ...prev,
                            offset: prev.offset + prev.limit,
                          }))
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmLoading(true)
                try {
                  await confirmDialog.action()
                  setConfirmDialog((prev) => ({ ...prev, open: false }))
                } finally {
                  setConfirmLoading(false)
                }
              }}
              disabled={confirmLoading}
              className={confirmDialog.isDangerous ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {confirmLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default AdminSMSManager
