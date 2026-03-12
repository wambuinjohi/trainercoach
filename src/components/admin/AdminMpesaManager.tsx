import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, Save, Plus, Trash2, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'

interface MpesaCredential {
  id?: number
  consumerKey: string
  consumerSecret: string
  shortcode: string
  passkey: string
  buyGoodsShortCode?: string
  buyGoodsMerchantCode?: string
  environment: 'sandbox' | 'production'
  resultUrl?: string
  initiatorName?: string
  securityCredential?: string
  c2bCallbackUrl?: string
  b2cCallbackUrl?: string
  paymentType?: string
  created_at?: string
  updated_at?: string
  source?: string
}

export const AdminMpesaManager: React.FC = () => {
  const [credentials, setCredentials] = useState<MpesaCredential | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)
  const [credentialStatus, setCredentialStatus] = useState<'valid' | 'incomplete' | 'none'>('none')

  const [formData, setFormData] = useState<MpesaCredential>({
    consumerKey: '',
    consumerSecret: '',
    shortcode: '',
    passkey: '',
    buyGoodsShortCode: '',
    buyGoodsMerchantCode: '',
    environment: 'sandbox',
    resultUrl: '',
    initiatorName: '',
    securityCredential: '',
    c2bCallbackUrl: '',
    b2cCallbackUrl: '',
    paymentType: 'paybill',
  })

  useEffect(() => {
    loadCredentials()
  }, [])

  const loadCredentials = async () => {
    setLoading(true)
    try {
      // Try to fetch M-Pesa credentials
      const response = await apiService.getMpesaCredentials()
      if (response) {
        const cred = Array.isArray(response) ? response[0] : (response?.data ? response.data : response)
        if (cred) {
          setCredentials(cred)
          setFormData(cred)
          validateCredentials(cred)
        } else {
          setCredentialStatus('none')
        }
      } else {
        setCredentialStatus('none')
      }
    } catch (err) {
      console.warn('Failed to load M-Pesa credentials:', err)
      setCredentialStatus('none')
    } finally {
      setLoading(false)
    }
  }

  const validateCredentials = (cred: MpesaCredential) => {
    if (!cred.consumerKey || !cred.consumerSecret) {
      setCredentialStatus('incomplete')
      return
    }
    if (cred.paymentType === 'paybill' && (!cred.shortcode || !cred.passkey)) {
      setCredentialStatus('incomplete')
      return
    }
    if (cred.paymentType === 'buygods' && (!cred.buyGoodsShortCode || !cred.buyGoodsMerchantCode)) {
      setCredentialStatus('incomplete')
      return
    }
    setCredentialStatus('valid')
  }

  const handleInputChange = (field: string, value: string) => {
    const updated = { ...formData, [field]: value }
    setFormData(updated)
    validateCredentials(updated)
  }

  const handleSave = async () => {
    // Validate required fields
    if (!formData.consumerKey || !formData.consumerSecret) {
      toast({
        title: 'Validation Error',
        description: 'Consumer Key and Consumer Secret are required',
        variant: 'destructive'
      })
      return
    }

    if (formData.paymentType === 'paybill' && (!formData.shortcode || !formData.passkey)) {
      toast({
        title: 'Validation Error',
        description: 'For Paybill: Shortcode and Passkey are required',
        variant: 'destructive'
      })
      return
    }

    if (formData.paymentType === 'buygods' && (!formData.buyGoodsShortCode || !formData.buyGoodsMerchantCode)) {
      toast({
        title: 'Validation Error',
        description: 'For Buy Goods: Shortcode and Merchant Code are required',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      await apiService.saveMpesaCredentials(formData)
      toast({
        title: 'Success',
        description: 'M-Pesa credentials saved successfully',
        variant: 'default'
      })
      await loadCredentials()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save credentials'
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete the M-Pesa credentials?')) {
      return
    }

    setSaving(true)
    try {
      await apiService.deleteMpesaCredentials()
      toast({
        title: 'Success',
        description: 'M-Pesa credentials deleted',
        variant: 'default'
      })
      setCredentials(null)
      setFormData({
        consumerKey: '',
        consumerSecret: '',
        shortcode: '',
        passkey: '',
        buyGoodsShortCode: '',
        buyGoodsMerchantCode: '',
        environment: 'sandbox',
        resultUrl: '',
        initiatorName: '',
        securityCredential: '',
        c2bCallbackUrl: '',
        b2cCallbackUrl: '',
        paymentType: 'paybill',
      })
      setCredentialStatus('none')
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete credentials',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className={credentialStatus === 'valid' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : credentialStatus === 'incomplete' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : 'border-red-500 bg-red-50 dark:bg-red-950/20'}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">M-Pesa Configuration Status</CardTitle>
            {credentialStatus === 'valid' && <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>}
            {credentialStatus === 'incomplete' && <Badge className="bg-yellow-600"><AlertCircle className="h-3 w-3 mr-1" />Incomplete</Badge>}
            {credentialStatus === 'none' && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Not Configured</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {credentialStatus === 'valid' && (
            <div className="text-sm text-green-700 dark:text-green-400">
              M-Pesa is properly configured. Clients can use M-Pesa payments for bookings.
              {credentials?.source && <div className="mt-1 text-xs opacity-75">Source: {credentials.source}</div>}
            </div>
          )}
          {credentialStatus === 'incomplete' && (
            <div className="text-sm text-yellow-700 dark:text-yellow-400">
              M-Pesa configuration is incomplete. Please fill in all required fields below.
            </div>
          )}
          {credentialStatus === 'none' && (
            <div className="text-sm text-red-700 dark:text-red-400">
              M-Pesa is not configured. Clients will need to use Mock payment for testing. Add credentials below to enable M-Pesa payments.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credentials Form */}
      <Card>
        <CardHeader>
          <CardTitle>M-Pesa API Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OAuth Credentials */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="font-semibold">OAuth Credentials (Required)</h3>
            
            <div>
              <Label htmlFor="consumerKey">Consumer Key</Label>
              <Input
                id="consumerKey"
                type={showSecrets ? 'text' : 'password'}
                value={formData.consumerKey}
                onChange={(e) => handleInputChange('consumerKey', e.target.value)}
                placeholder="From M-Pesa API portal"
              />
              <p className="text-xs text-muted-foreground mt-1">Your M-Pesa API Consumer Key</p>
            </div>

            <div>
              <Label htmlFor="consumerSecret">Consumer Secret</Label>
              <div className="relative">
                <Input
                  id="consumerSecret"
                  type={showSecrets ? 'text' : 'password'}
                  value={formData.consumerSecret}
                  onChange={(e) => handleInputChange('consumerSecret', e.target.value)}
                  placeholder="From M-Pesa API portal"
                />
                <button
                  type="button"
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Your M-Pesa API Consumer Secret</p>
            </div>

            <div>
              <Label htmlFor="environment">Environment</Label>
              <Select value={formData.environment} onValueChange={(value) => handleInputChange('environment', value as 'sandbox' | 'production')}>
                <SelectTrigger id="environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Use Sandbox for testing, Production for real payments</p>
            </div>
          </div>

          {/* Payment Type Selection */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="font-semibold">Payment Type</h3>
            
            <div>
              <Label htmlFor="paymentType">Payment Type</Label>
              <Select value={formData.paymentType || 'paybill'} onValueChange={(value) => handleInputChange('paymentType', value)}>
                <SelectTrigger id="paymentType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paybill">Paybill (STK Push)</SelectItem>
                  <SelectItem value="buygods">Buy Goods</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Select the payment flow type</p>
            </div>
          </div>

          {/* Paybill Configuration */}
          {(formData.paymentType === 'paybill' || !formData.paymentType) && (
            <div className="space-y-4 border-b pb-4">
              <h3 className="font-semibold">Paybill Configuration</h3>
              
              <div>
                <Label htmlFor="shortcode">Paybill Shortcode (Required)</Label>
                <Input
                  id="shortcode"
                  value={formData.shortcode}
                  onChange={(e) => handleInputChange('shortcode', e.target.value)}
                  placeholder="e.g., 123456"
                />
                <p className="text-xs text-muted-foreground mt-1">Your M-Pesa Paybill shortcode</p>
              </div>

              <div>
                <Label htmlFor="passkey">Passkey (Required)</Label>
                <Input
                  id="passkey"
                  type={showSecrets ? 'text' : 'password'}
                  value={formData.passkey}
                  onChange={(e) => handleInputChange('passkey', e.target.value)}
                  placeholder="Your Paybill passkey"
                />
                <p className="text-xs text-muted-foreground mt-1">Your M-Pesa Passkey for STK Push</p>
              </div>
            </div>
          )}

          {/* Buy Goods Configuration */}
          {formData.paymentType === 'buygods' && (
            <div className="space-y-4 border-b pb-4">
              <h3 className="font-semibold">Buy Goods Configuration</h3>
              
              <div>
                <Label htmlFor="buyGoodsShortCode">Buy Goods Shortcode (Required)</Label>
                <Input
                  id="buyGoodsShortCode"
                  value={formData.buyGoodsShortCode}
                  onChange={(e) => handleInputChange('buyGoodsShortCode', e.target.value)}
                  placeholder="e.g., 654321"
                />
                <p className="text-xs text-muted-foreground mt-1">Your M-Pesa Buy Goods shortcode</p>
              </div>

              <div>
                <Label htmlFor="buyGoodsMerchantCode">Buy Goods Merchant Code (Required)</Label>
                <Input
                  id="buyGoodsMerchantCode"
                  value={formData.buyGoodsMerchantCode}
                  onChange={(e) => handleInputChange('buyGoodsMerchantCode', e.target.value)}
                  placeholder="Your merchant code"
                />
                <p className="text-xs text-muted-foreground mt-1">Your Buy Goods merchant code</p>
              </div>
            </div>
          )}

          {/* Optional Configuration */}
          <div className="space-y-4">
            <h3 className="font-semibold">Optional Configuration</h3>
            
            <div>
              <Label htmlFor="resultUrl">Result URL</Label>
              <Input
                id="resultUrl"
                value={formData.resultUrl}
                onChange={(e) => handleInputChange('resultUrl', e.target.value)}
                placeholder="https://your-domain.com/callbacks/mpesa/stk"
              />
              <p className="text-xs text-muted-foreground mt-1">Callback URL for transaction results</p>
            </div>

            <div>
              <Label htmlFor="c2bCallbackUrl">C2B Callback URL</Label>
              <Input
                id="c2bCallbackUrl"
                value={formData.c2bCallbackUrl}
                onChange={(e) => handleInputChange('c2bCallbackUrl', e.target.value)}
                placeholder="https://your-domain.com/callbacks/mpesa/c2b"
              />
              <p className="text-xs text-muted-foreground mt-1">Callback URL for C2B confirmations</p>
            </div>

            <div>
              <Label htmlFor="b2cCallbackUrl">B2C Callback URL</Label>
              <Input
                id="b2cCallbackUrl"
                value={formData.b2cCallbackUrl}
                onChange={(e) => handleInputChange('b2cCallbackUrl', e.target.value)}
                placeholder="https://your-domain.com/callbacks/mpesa/b2c"
              />
              <p className="text-xs text-muted-foreground mt-1">Callback URL for B2C payouts</p>
            </div>

            <div>
              <Label htmlFor="initiatorName">Initiator Name</Label>
              <Input
                id="initiatorName"
                value={formData.initiatorName}
                onChange={(e) => handleInputChange('initiatorName', e.target.value)}
                placeholder="B2C initiator name"
              />
              <p className="text-xs text-muted-foreground mt-1">Used for B2C/B2B transactions</p>
            </div>

            <div>
              <Label htmlFor="securityCredential">Security Credential</Label>
              <Input
                id="securityCredential"
                type={showSecrets ? 'text' : 'password'}
                value={formData.securityCredential}
                onChange={(e) => handleInputChange('securityCredential', e.target.value)}
                placeholder="Encrypted credential for B2C"
              />
              <p className="text-xs text-muted-foreground mt-1">Encrypted credential for B2C payouts</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Credentials'}
            </Button>

            {credentials && (
              <Button
                onClick={handleDelete}
                disabled={saving}
                variant="destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Credentials
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to Get M-Pesa Credentials</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>1. Visit the <a href="https://developer.safaricom.co.ke/docs" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">M-Pesa Developer Portal</a></p>
          <p>2. Create an application and navigate to the Keys section</p>
          <p>3. Copy your Consumer Key and Consumer Secret</p>
          <p>4. For Paybill: Add your Paybill shortcode and passkey</p>
          <p>5. For Buy Goods: Add your shortcode and merchant code</p>
          <p>6. Set the appropriate callbacks in your M-Pesa portal</p>
          <p>7. Test in Sandbox environment first</p>
        </CardContent>
      </Card>
    </div>
  )
}
