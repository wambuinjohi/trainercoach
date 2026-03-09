import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const approvedOf = (u: any) => {
  const v = u && (u.is_approved !== undefined ? u.is_approved : u)
  if (v === true) return true
  if (v === false) return false
  if (v == null) return false
  const s = String(v).trim().toLowerCase()
  return ['1', 'true', 'yes', 'y', 't'].includes(s)
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    title: string
    description: string
    action: () => Promise<void>
    isDestructive?: boolean
  }>({
    open: false,
    title: '',
    description: '',
    action: async () => {},
  })
  const [confirmLoading, setConfirmLoading] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const usersData = await apiService.getUsers()
      const usersList = Array.isArray(usersData) ? usersData : usersData?.data || []
      setUsers(usersList)
    } catch (error) {
      console.error('Failed to load users:', error)
      toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const deleteUser = async (userId: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete User',
      description: 'Are you sure you want to delete this user? This action cannot be undone.',
      isDestructive: true,
      action: async () => {
        try {
          setConfirmLoading(true)
          await apiService.deleteUser(userId)
          setUsers(users.filter(u => u.user_id !== userId))
          toast({ title: 'Success', description: 'User deleted' })
          setConfirmModal({ ...confirmModal, open: false })
        } catch (err: any) {
          console.error('Delete user error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to delete user', variant: 'destructive' })
        } finally {
          setConfirmLoading(false)
        }
      },
    })
  }

  const updateUserType = async (userId: string, newType: string) => {
    try {
      await apiService.updateUserType(userId, newType)
      setUsers(users.map(u => (u.user_id === userId ? { ...u, user_type: newType } : u)))
      toast({ title: 'Success', description: 'User type updated' })
    } catch (err: any) {
      console.error('Update user type error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to update user type', variant: 'destructive' })
    }
  }

  const approveTrainer = (userId: string) => {
    const trainer = users.find(t => t.user_id === userId)
    const trainerName = trainer?.full_name || userId
    setConfirmModal({
      open: true,
      title: 'Approve Trainer',
      description: `Are you sure you want to approve ${trainerName} as a trainer?`,
      action: async () => {
        try {
          setConfirmLoading(true)
          await apiService.approveTrainer(userId)
          setUsers(users.map(u => (u.user_id === userId ? { ...u, is_approved: true } : u)))
          toast({ title: 'Success', description: 'Trainer approved' })
          setConfirmModal({ ...confirmModal, open: false })
        } catch (err: any) {
          console.error('Approve trainer error:', err)
          toast({ title: 'Error', description: err?.message || 'Failed to approve trainer', variant: 'destructive' })
        } finally {
          setConfirmLoading(false)
        }
      },
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading users...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <Badge variant="secondary">{users.length}</Badge>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Approved</th>
                  <th className="p-2">Joined</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">{u.full_name || u.user_id}</td>
                    <td className="p-2">{u.email || u.phone_number || '-'}</td>
                    <td className="p-2">
                      <Select value={u.user_type || 'client'} onValueChange={(v) => updateUserType(u.user_id, v)}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="trainer">Trainer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">{approvedOf(u) ? 'Yes' : 'No'}</td>
                    <td className="p-2">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => deleteUser(u.user_id)}>
                          Delete
                        </Button>

                        {String(u.user_type || '').toLowerCase() === 'trainer' && !approvedOf(u) && (
                          <Button size="sm" variant="outline" onClick={() => approveTrainer(u.user_id)}>
                            Approve
                          </Button>
                        )}

                        <Button size="sm" variant="ghost" disabled title="Admin API not configured">
                          Reset PW
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          title="Admin API not configured"
                        >
                          {u.is_suspended ? 'Reinstate' : 'Suspend'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="mt-4">
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="text-sm text-muted-foreground">No users found. Add users via Supabase or check the admin API.</div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmModal.open} onOpenChange={(open) => {
        if (!open) setConfirmModal({ ...confirmModal, open: false })
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmModal.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmModal.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await confirmModal.action()
              }}
              disabled={confirmLoading}
              className={confirmModal.isDestructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {confirmLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
