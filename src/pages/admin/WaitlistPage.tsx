import React from 'react'
import { WaitingListManager } from '@/components/admin/WaitingListManager'

export default function WaitlistPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Waiting List Management</h1>
        <p className="text-sm text-muted-foreground mt-2">Manage Trainer app launch waiting list entries</p>
      </div>
      <WaitingListManager />
    </div>
  )
}
