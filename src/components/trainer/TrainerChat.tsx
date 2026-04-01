import React, { useEffect, useState } from 'react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const TrainerChat: React.FC<{ booking: any, onClose?: () => void }> = ({ booking, onClose }) => {
  const { user } = useAuth()
  const trainerId = user?.id
  const clientId = booking?.client_id
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null)

  const quickReplies = [
    { text: 'On my way', icon: '🚗' },
    { text: 'I have arrived', icon: '✅' },
  ]

  const isSessionActive = booking?.session_phase === 'session_active' || booking?.session_phase === 'awaiting_completion'

  const sendQuickReply = async (replyText: string) => {
    if (!trainerId || !clientId) return
    const msg = {
      trainer_id: trainerId,
      client_id: clientId,
      content: replyText,
      booking_id: booking?.id || null,
      created_at: new Date().toISOString(),
      read_by_trainer: true,
      read_by_client: false,
    }
    setMessages(prev => [...prev, msg])
    try {
      await apiRequest('message_insert', msg, { headers: withAuth() })
    } catch (err) {
      console.warn('Persist message failed', err)
    }
    // notify client and admins
    try {
      const nowIso = new Date().toISOString()
      const rows:any[] = [
        { user_id: clientId, title: 'New message', body: `Trainer sent: ${msg.content.slice(0,120)}`, created_at: nowIso, read: false }
      ]
      try {
        const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
        for (const a of (admins||[])) rows.push({ user_id: a.user_id, title: 'Chat activity', body: `Trainer messaged client`, created_at: nowIso, read: false })
      } catch {}
      await apiRequest('notifications_insert', { notifications: rows }, { headers: withAuth() })
    } catch (err) {}
  }

  useEffect(() => {
    if (!trainerId || !clientId) return
    let mounted = true
    const load = async () => {
      try {
        const data = await apiRequest('messages_get', { trainer_id: trainerId, client_id: clientId }, { headers: withAuth() })
        if (mounted && data) setMessages(Array.isArray(data) ? data : [])

        // mark messages as read by trainer
        try {
          await apiRequest('messages_mark_read', { trainer_id: trainerId, client_id: clientId, read_by_trainer: true }, { headers: withAuth() })
        } catch (err) {
          // ignore
        }
      } catch (err) {
        console.warn('Load messages error', err)
      }
    }
    load()

    return () => {
      mounted = false
    }
  }, [trainerId, clientId])

  // scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!trainerId || !clientId || !text.trim()) return
    const msg = {
      trainer_id: trainerId,
      client_id: clientId,
      content: text.trim(),
      booking_id: booking?.id || null,
      created_at: new Date().toISOString(),
      read_by_trainer: true,
      read_by_client: false,
    }
    setMessages(prev => [...prev, msg])
    setText('')
    try {
      await apiRequest('message_insert', msg, { headers: withAuth() })
    } catch (err) {
      console.warn('Persist message failed', err)
    }
    // notify client and admins
    try {
      const nowIso = new Date().toISOString()
      const rows:any[] = [
        { user_id: clientId, title: 'New message', body: `Trainer sent: ${msg.content.slice(0,120)}`, created_at: nowIso, read: false }
      ]
      try {
        const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
        for (const a of (admins||[])) rows.push({ user_id: a.user_id, title: 'Chat activity', body: `Trainer messaged client`, created_at: nowIso, read: false })
      } catch {}
      await apiRequest('notifications_insert', { notifications: rows }, { headers: withAuth() })
    } catch (err) {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />
      <div className="relative w-full max-w-sm sm:max-w-md md:max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Chat with {booking?.clientName || 'Client'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-2 max-h-96 overflow-auto">
              {messages.map((m) => (
                <div key={m.id || `${m.content}-${m.created_at}`} className={`p-2 rounded ${m.client_id === clientId ? 'bg-muted' : 'bg-primary/10 self-end'}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">{m.content}</div>
                    <div className="ml-2 text-xs text-muted-foreground">
                      {m.client_id === clientId ? (m.read_by_trainer ? '✓ Read' : '• Received') : (m.read_by_client ? '✓ Read' : '')}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(m.created_at || Date.now()).toLocaleString()}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {isSessionActive && (
              <div className="mb-3 flex flex-wrap gap-2">
                {quickReplies.map((reply) => (
                  <button
                    key={reply.text}
                    onClick={() => sendQuickReply(reply.text)}
                    className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  >
                    {reply.icon} {reply.text}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message..." />
              <Button onClick={send}>Send</Button>
            </div>
            <div className="flex justify-end mt-2">
              <Button variant="outline" onClick={() => onClose?.()}>Close</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
