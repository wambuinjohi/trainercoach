import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, DollarSign, TrendingUp, TrendingDown, Loader2, History } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { loadSettings } from '@/lib/settings'

interface Wallet {
  id: string
  user_id: string
  balance: number
  available_balance: number
  pending_balance: number
  created_at: string
  updated_at: string
}

interface Transaction {
  id: string
  user_id: string
  type: string
  amount: number
  reference: string
  description: string
  balance_after: number
  created_at: string
}

export const WalletManager: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [processingTopUp, setProcessingTopUp] = useState(false)
  const [processingWithdraw, setProcessingWithdraw] = useState(false)

  useEffect(() => {
    loadWallet()
    loadTransactions()
  }, [user?.id])

  const loadWallet = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const data = await apiRequest('wallet_get', { user_id: user.id }, { headers: withAuth() })
      if (data?.data) {
        setWallet(data.data)
      }
    } catch (err) {
      console.warn('Failed to load wallet', err)
    } finally {
      setLoading(false)
    }
  }

  const loadTransactions = async () => {
    if (!user?.id) return
    try {
      setLoadingTransactions(true)
      const data = await apiRequest('wallet_transactions_get', { user_id: user.id, limit: 20 }, { headers: withAuth() })
      if (data?.data) {
        setTransactions(Array.isArray(data.data) ? data.data : [])
      }
    } catch (err) {
      console.warn('Failed to load transactions', err)
    } finally {
      setLoadingTransactions(false)
    }
  }

  const handleTopUp = async () => {
    if (!topUpAmount || parseFloat(topUpAmount) <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount', variant: 'destructive' })
      return
    }

    const amount = parseFloat(topUpAmount)
    if (amount < 10) {
      toast({ title: 'Minimum amount', description: 'Top up amount must be at least Ksh 10', variant: 'destructive' })
      return
    }

    setProcessingTopUp(true)
    try {
      // Initiate STK push for wallet top-up
      const response = await fetch('/api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stk_push_initiate',
          phone: user?.phone || '',
          amount: amount,
          account_reference: `wallet_topup_${user?.id}`,
          transaction_description: `Wallet Top-up: Ksh ${amount}`
        })
      })

      const result = await response.json()
      const checkoutId = result.data?.CheckoutRequestID || result.CheckoutRequestID || result.result?.CheckoutRequestID

      if (checkoutId && result.status === 'success') {
        toast({ title: 'STK Prompt Sent', description: 'Check your phone to complete the top-up' })
        setTopUpAmount('')

        // Poll for payment completion
        let checkAttempts = 0
        const pollInterval = setInterval(async () => {
          checkAttempts++
          try {
            const queryResponse = await fetch('/api.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'stk_push_query',
                checkout_request_id: checkoutId
              })
            })
            const queryResult = await queryResponse.json()
            const resultCode = queryResult.data?.result_code || queryResult.resultCode || queryResult.result?.ResultCode

            if (resultCode === '0' || resultCode === 0) {
              clearInterval(pollInterval)
              // Update wallet with the top-up amount
              const updateData = await apiRequest(
                'wallet_update',
                {
                  user_id: user?.id,
                  amount: amount,
                  transaction_type: 'deposit',
                  reference: `stk_${checkoutId}`,
                  description: 'M-Pesa wallet top-up'
                },
                { headers: withAuth() }
              )
              
              if (updateData?.status === 'success') {
                toast({ title: 'Top-up successful!', description: `Ksh ${amount} added to your wallet` })
                loadWallet()
                loadTransactions()
              }
            } else if (checkAttempts >= 30) {
              clearInterval(pollInterval)
              setProcessingTopUp(false)
            }
          } catch (err) {
            console.warn('Poll error', err)
          }
        }, 2000)
      } else {
        toast({ title: 'Failed', description: result.errorMessage || 'Could not initiate top-up', variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to initiate top-up', variant: 'destructive' })
    } finally {
      setProcessingTopUp(false)
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount', variant: 'destructive' })
      return
    }

    const amount = parseFloat(withdrawAmount)
    if (!wallet || amount > wallet.available_balance) {
      toast({ title: 'Insufficient balance', description: 'You do not have enough balance to withdraw', variant: 'destructive' })
      return
    }

    setProcessingWithdraw(true)
    try {
      // Initiate B2C withdrawal
      const response = await apiRequest(
        'b2c_payment_initiate',
        {
          user_id: user?.id,
          amount: amount,
          phone_number: user?.phone,
          description: `Wallet Withdrawal: Ksh ${amount}`
        },
        { headers: withAuth() }
      )

      if (response?.status === 'success') {
        toast({ title: 'Withdrawal initiated', description: 'You will receive the funds shortly via M-Pesa' })
        setWithdrawAmount('')
        
        // Update wallet
        const updateData = await apiRequest(
          'wallet_update',
          {
            user_id: user?.id,
            amount: -amount,
            transaction_type: 'withdrawal',
            reference: response.data?.reference_id,
            description: 'Wallet withdrawal via M-Pesa B2C'
          },
          { headers: withAuth() }
        )

        if (updateData?.status === 'success') {
          loadWallet()
          loadTransactions()
        }
      } else {
        toast({ title: 'Failed', description: response?.message || 'Could not initiate withdrawal', variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to initiate withdrawal', variant: 'destructive' })
    } finally {
      setProcessingWithdraw(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!wallet) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-900">Failed to load wallet. Please try again.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Wallet Balance Overview */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground">Total Balance</Label>
              <div className="text-3xl font-bold text-blue-900">Ksh {wallet.balance.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Available</Label>
              <div className="text-2xl font-semibold text-green-600">Ksh {wallet.available_balance.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Pending</Label>
              <div className="text-2xl font-semibold text-orange-600">Ksh {wallet.pending_balance.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Top-up and Withdraw */}
      <Tabs defaultValue="topup" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="topup">Top Up Wallet</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
        </TabsList>

        {/* Top-up Tab */}
        <TabsContent value="topup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Add Funds to Wallet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-semibold">Use M-Pesa to top up</p>
                  <p>You will receive an STK prompt on your phone</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topup_amount">Amount (Ksh)</Label>
                <Input
                  id="topup_amount"
                  type="number"
                  placeholder="Enter amount (minimum 10)"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  disabled={processingTopUp}
                  min="10"
                  step="10"
                />
                <p className="text-xs text-muted-foreground">Minimum: Ksh 10 | Maximum: Ksh 150,000</p>
              </div>

              <Button
                onClick={handleTopUp}
                disabled={processingTopUp || !topUpAmount}
                className="w-full"
                size="lg"
              >
                {processingTopUp ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Top Up Now
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdraw Tab */}
        <TabsContent value="withdraw">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Withdraw Funds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-700">
                  <p className="font-semibold">Withdraw via M-Pesa</p>
                  <p>Funds will be sent to your registered phone number</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdraw_amount">Amount (Ksh)</Label>
                <Input
                  id="withdraw_amount"
                  type="number"
                  placeholder="Enter amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  disabled={processingWithdraw}
                  min="10"
                  max={wallet.available_balance}
                  step="10"
                />
                <p className="text-xs text-muted-foreground">Available: Ksh {wallet.available_balance.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</p>
              </div>

              <Button
                onClick={handleWithdraw}
                disabled={processingWithdraw || !withdrawAmount || parseFloat(withdrawAmount) > wallet.available_balance}
                className="w-full"
                size="lg"
                variant="outline"
              >
                {processingWithdraw ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Withdraw
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {txn.type === 'deposit' || txn.type === 'topup' ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <div>
                        <p className="font-medium capitalize">{txn.type.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground">{txn.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${txn.type === 'deposit' || txn.type === 'topup' ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.type === 'deposit' || txn.type === 'topup' ? '+' : '-'} Ksh {Math.abs(txn.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(txn.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
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
