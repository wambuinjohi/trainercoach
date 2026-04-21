import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { BookingForm } from './BookingForm'
import { apiRequest, withAuth } from '@/lib/api'

export const BookingModal: React.FC<{ trainer: any, onClose: () => void, selectedCategory?: string | null }> = ({ trainer, onClose, selectedCategory }) => {
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await apiRequest('profile_get', { user_id: trainer.id }, { headers: withAuth() })
        if (data?.data) setProfile(data.data)
      } catch (err) {
        console.warn('Failed to fetch trainer profile', err)
      }
    }
    fetchProfile()
  }, [trainer.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-h-[100vh] sm:max-h-[90vh] overflow-y-auto rounded-none sm:rounded-lg sm:max-w-lg pb-20 sm:pb-0">
        <Card className="rounded-none sm:rounded-lg flex flex-col h-full">
          {/* Mobile close button top-left */}
          <button aria-label="Close" className="absolute top-3 left-3 z-60 sm:hidden bg-white/90 dark:bg-slate-900/90 p-2 rounded-full shadow" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-foreground" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>

          <CardHeader className="p-3 sm:p-6 flex flex-row items-center gap-2 border-b sticky top-0 bg-background z-10">
            <Button variant="ghost" size="sm" onClick={onClose} className="-ml-2 sm:hidden">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="text-base sm:text-lg truncate">Book Session with {trainer.name}</CardTitle>
          </CardHeader>

          <CardContent className="p-0 flex-1 flex flex-col">
            <BookingForm
              trainer={trainer}
              trainerProfile={profile}
              selectedCategory={selectedCategory}
              onDone={() => {
                onClose()
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
