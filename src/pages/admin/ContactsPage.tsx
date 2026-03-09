import React from 'react'
import { ContactsList } from '@/components/admin/ContactsList'

export default function ContactsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Contacts Management</h1>
        <p className="text-sm text-muted-foreground mt-2">Manage contacts - capture name, phone, and type (Client or Trainer)</p>
      </div>
      <ContactsList onRefresh={() => {}} />
    </div>
  )
}
