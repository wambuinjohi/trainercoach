import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Header from '@/components/Header'

const Contact: React.FC = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const subject = encodeURIComponent(`Support request from ${name || email}`)
    const body = encodeURIComponent(message + '\n\nContact: ' + (email || name))
    window.location.href = `mailto:support@trainercoachconnect.com?subject=${subject}&body=${body}`
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="p-6">
        <div className="container max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Contact Us</h1>
        <p className="text-muted-foreground mb-4">Send us a message and we'll get back to you as soon as possible.</p>

        <Card>
          <CardHeader>
            <CardTitle>Send a message</CardTitle>
            <CardDescription>Support and partnership inquiries</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <Label>Message</Label>
                <textarea className="w-full p-2 border border-border rounded-md bg-input" value={message} onChange={(e)=>setMessage(e.target.value)} rows={6} />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Send</Button>
                <Link to="/">
                  <Button variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-sm text-muted-foreground">Or email us directly at <a className="text-primary" href="mailto:support@trainercoachconnect.com">support@trainercoachconnect.com</a></div>
      </div>
      </div>
    </div>
  )
}

export default Contact
