import React, { useEffect, useState } from 'react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export const Chat: React.FC<{ trainer: any, onClose?: () => void, booking?: any }> = ({ trainer, onClose, booking }) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')

  const messagesEndRef = React.useRef<HTMLDivElement | null>(null)

  const quickReplies = [
    { text: 'On my way', icon: '🚗' },
    { text: 'I have arrived', icon: '✅' },
  ]

  const isSessionActive = booking?.session_phase === 'session_active' || booking?.session_phase === 'awaiting_completion'

  const sendQuickReply = async (replyText: string) => {
    if (!user) return
    const msg = {
      trainer_id: trainer.id,
      client_id: user.id,
      content: replyText,
      created_at: new Date().toISOString(),
      read_by_trainer: false,
      read_by_client: true,
    }
    setMessages(prev => [...prev, msg])
    try {
      await apiRequest('message_insert', msg, { headers: withAuth() })
    } catch (err) {
      console.warn('Persist message failed', err)
    }
    // notify trainer and admins
    try {
      const nowIso = new Date().toISOString()
      const rows:any[] = [
        { user_id: trainer.id, title: 'New message', body: `Client sent: ${msg.content.slice(0,120)}`, created_at: nowIso, read: false }
      ]
      try {
        const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
        for (const a of (admins||[])) rows.push({ user_id: a.user_id, title: 'Chat activity', body: `Client messaged trainer`, created_at: nowIso, read: false })
      } catch {}
      await apiRequest('notifications_insert', { notifications: rows }, { headers: withAuth() })
    } catch (err) {
      // ignore
    }
  }

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const data = await apiRequest('messages_get', { trainer_id: trainer.id, client_id: user?.id }, { headers: withAuth() })
        if (mounted && data) setMessages(Array.isArray(data) ? data : [])

        // mark messages as read by client
        try {
          await apiRequest('messages_mark_read', { trainer_id: trainer.id, client_id: user?.id, read_by_client: true }, { headers: withAuth() })
        } catch (err) {
          // ignore
        }
      } catch (err) {
        // ignore
      }
    }
    load()
    return () => { mounted = false }
  }, [trainer.id, user?.id])

  // scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!user || !text.trim()) return
    const msg = {
      trainer_id: trainer.id,
      client_id: user.id,
      content: text.trim(),
      created_at: new Date().toISOString(),
      read_by_trainer: false,
      read_by_client: true,
    }
    setMessages(prev => [...prev, msg])
    setText('')
    try {
      await apiRequest('message_insert', msg, { headers: withAuth() })
    } catch (err) {
      console.warn('Persist message failed', err)
    }
    // notify trainer and admins
    try {
      const nowIso = new Date().toISOString()
      const rows:any[] = [
        { user_id: trainer.id, title: 'New message', body: `Client sent: ${msg.content.slice(0,120)}`, created_at: nowIso, read: false }
      ]
      try {
        const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
        for (const a of (admins||[])) rows.push({ user_id: a.user_id, title: 'Chat activity', body: `Client messaged trainer`, created_at: nowIso, read: false })
      } catch {}
      await apiRequest('notifications_insert', { notifications: rows }, { headers: withAuth() })
    } catch (err) {
      // ignore
    }
  }

  return (
    <div className="p-3 border border-border rounded-md bg-card">
      <div className="space-y-2 mb-2 max-h-40 overflow-auto">
        {messages.map((m, i) => (
          <div key={i} className={`p-2 rounded ${m.client_id === user?.id ? 'bg-primary/10 self-end' : 'bg-muted'}`}>
            <div className="flex items-center justify-between">
              <div className="text-sm">{m.content}</div>
              <div className="ml-2 text-xs text-muted-foreground">
                {m.client_id === user?.id ? (m.read_by_trainer ? '✓ Read' : '• Sent') : (m.read_by_client ? '✓ Read' : '')}
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
    </div>
  )
}
