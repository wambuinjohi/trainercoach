import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export const PaymentMethods: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth()
  const userId = user?.id
  const [methods, setMethods] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [newMethod, setNewMethod] = useState('')

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    apiRequest('payment_methods_get', { user_id: userId }, { headers: withAuth() })
      .then((data: any) => {
        setMethods(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const add = async () => {
    if (!userId || !newMethod.trim()) return
    setLoading(true)
    try {
      await apiRequest('payment_method_insert', { user_id: userId, method: newMethod.trim() }, { headers: withAuth() })
      setMethods(prev => [...prev, { method: newMethod.trim() }])
      setNewMethod('')
      toast({ title: 'Saved', description: 'Payment method added' })
    } catch (err) {
      console.error('Add payment method error', err)
      toast({ title: 'Error', description: (err as any)?.message || 'Failed to add', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {methods.map((m, i) => (
                <div key={i} className="p-2 border border-border rounded-md bg-card">{m.method || JSON.stringify(m)}</div>
              ))}

              <div>
                <Label>Add method</Label>
                <Input value={newMethod} onChange={(e) => setNewMethod(e.target.value)} placeholder="e.g. Card ****1234 or M-Pesa" />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onClose?.()} disabled={loading}>Close</Button>
                <Button onClick={add} disabled={loading}>{loading ? 'Adding...' : 'Add'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
