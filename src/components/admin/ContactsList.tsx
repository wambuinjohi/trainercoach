import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Plus, Trash2, Pencil, Search } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/api'
import * as apiService from '@/lib/api-service'

interface Contact {
  id: string
  name: string
  phone: string
  user_type: 'client' | 'trainer'
  created_at?: string
  updated_at?: string
}

interface ContactsListProps {
  onRefresh?: () => void
}

export const ContactsList: React.FC<ContactsListProps> = ({ onRefresh }) => {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [formData, setFormData] = useState({ name: '', phone: '', user_type: 'client' as const })
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const pageSize = 10

  const fetchContacts = async (page = 0) => {
    setLoading(true)
    try {
      const response = await apiService.getContactsWithPagination({
        page: page + 1, // Convert 0-based page to 1-based
        pageSize
      })

      if (response) {
        // Handle both formats: direct array or object with data property
        let data: Contact[] = []
        if (Array.isArray(response)) {
          data = response
        } else if (response.data && Array.isArray(response.data)) {
          data = response.data
        }
        setContacts(data)
        // Extract total count from response - with count:'exact' it should be available
        if (response.count !== undefined) {
          setTotalCount(response.count)
        } else if (response.total !== undefined) {
          setTotalCount(response.total)
        } else {
          // Fallback: use data length (shouldn't happen with proper API response)
          setTotalCount(data.length)
        }
        setCurrentPage(page)
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch contacts',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts(0)
  }, [])


  const handleAddContact = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Name is required',
        variant: 'destructive'
      })
      return
    }

    if (!formData.phone.trim()) {
      toast({
        title: 'Error',
        description: 'Phone is required',
        variant: 'destructive'
      })
      return
    }

    setSubmitting(true)
    try {
      await apiRequest('insert', {
        table: 'contacts',
        data: {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          user_type: formData.user_type
        }
      })

      toast({
        title: 'Success',
        description: 'Contact added successfully'
      })
      setFormData({ name: '', phone: '', user_type: 'client' })
      setIsAddDialogOpen(false)
      await fetchContacts(0)
      onRefresh?.()
    } catch (error) {
      console.error('Error adding contact:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to add contact'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditContact = async () => {
    if (!selectedContact) return

    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Name is required',
        variant: 'destructive'
      })
      return
    }

    if (!formData.phone.trim()) {
      toast({
        title: 'Error',
        description: 'Phone is required',
        variant: 'destructive'
      })
      return
    }

    setSubmitting(true)
    try {
      await apiRequest('update', {
        table: 'contacts',
        data: {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          user_type: formData.user_type
        },
        where: `id = '${selectedContact.id}'`
      })

      toast({
        title: 'Success',
        description: 'Contact updated successfully'
      })
      setFormData({ name: '', phone: '', user_type: 'client' })
      setIsEditDialogOpen(false)
      setSelectedContact(null)
      await fetchContacts(currentPage)
      onRefresh?.()
    } catch (error) {
      console.error('Error updating contact:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update contact'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteContact = async () => {
    if (!selectedContact) return

    setSubmitting(true)
    try {
      await apiRequest('delete', {
        table: 'contacts',
        where: `id = '${selectedContact.id}'`
      })

      toast({
        title: 'Success',
        description: 'Contact deleted successfully'
      })
      setIsDeleteDialogOpen(false)
      setSelectedContact(null)
      await fetchContacts(currentPage > 0 ? currentPage : 0)
      onRefresh?.()
    } catch (error) {
      console.error('Error deleting contact:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete contact'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openAddDialog = () => {
    setFormData({ name: '', phone: '', user_type: 'client' })
    setIsAddDialogOpen(true)
  }

  const openEditDialog = (contact: Contact) => {
    setSelectedContact(contact)
    setFormData({
      name: contact.name,
      phone: contact.phone,
      user_type: contact.user_type
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (contact: Contact) => {
    setSelectedContact(contact)
    setIsDeleteDialogOpen(true)
  }

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm)
  )

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={openAddDialog} className="w-full sm:w-auto" disabled={submitting}>
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {contacts.length === 0 && loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">Loading contacts...</div>
          </CardContent>
        </Card>
      )}

      {contacts.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">No contacts yet</div>
          </CardContent>
        </Card>
      )}

      {filteredContacts.length === 0 && contacts.length > 0 && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">No contacts matching your search</div>
          </CardContent>
        </Card>
      )}

      {filteredContacts.length > 0 && (
        <>
          <div className="space-y-2">
            {filteredContacts.map(contact => (
              <Card key={contact.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{contact.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{contact.phone}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Type</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            contact.user_type === 'trainer'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {contact.user_type.charAt(0).toUpperCase() + contact.user_type.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 sm:flex-col lg:flex-row">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(contact)}
                        className="flex-1 sm:flex-none"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(contact)}
                        className="flex-1 sm:flex-none text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {currentPage + 1} of {totalPages} ({totalCount} total contacts)
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchContacts(currentPage - 1)}
                  disabled={currentPage === 0 || loading}
                  className="min-w-24"
                >
                  {loading ? '...' : 'Previous'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchContacts(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1 || loading}
                  className="min-w-24"
                >
                  {loading ? '...' : 'Next'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Contact Dialog */}
      <AlertDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Add New Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the contact details
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="add-name">Name</Label>
              <Input
                id="add-name"
                placeholder="Enter contact name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-2"
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="add-phone">Phone</Label>
              <Input
                id="add-phone"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-2"
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="add-type">Type</Label>
              <Select
                value={formData.user_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, user_type: value as 'client' | 'trainer' })
                }
                disabled={submitting}
              >
                <SelectTrigger id="add-type" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddContact} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Contact'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Contact Dialog */}
      <AlertDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Update the contact details
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                placeholder="Enter contact name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-2"
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-2"
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="edit-type">Type</Label>
              <Select
                value={formData.user_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, user_type: value as 'client' | 'trainer' })
                }
                disabled={submitting}
              >
                <SelectTrigger id="edit-type" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditContact} disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Contact'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Contact Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedContact?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ContactsList
