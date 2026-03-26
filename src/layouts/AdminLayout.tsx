import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { AnnouncementBanner } from '@/components/shared/AnnouncementBanner'

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, userType, signOut, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-primary mx-auto mb-4 animate-pulse"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || userType !== 'admin') {
    return <Navigate to="/" replace />
  }

  // Extract the current page from the route
  const currentPage = location.pathname.split('/admin/')[1] || 'overview'

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background">
      <AdminSidebar
        value={currentPage}
        onChange={(page) => {
          // Navigation is handled by the router through route links
          // This is just for UI state
        }}
        onSignOut={handleSignOut}
      />
      <main className="flex-1 overflow-auto">
        {user && (
          <div className="p-6 pt-0">
            <AnnouncementBanner
              userId={user.id}
              userType="admin"
            />
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
