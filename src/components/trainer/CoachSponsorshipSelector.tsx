import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'

interface Sponsor {
  user_id: string
  full_name?: string
  email?: string
  profile_image?: string
  hourly_rate?: number
  rating?: number
  total_reviews?: number
  is_verified?: boolean
  account_status?: string
}

interface CoachSponsorshipSelectorProps {
  currentSponsorId?: string | null
  currentSponsorName?: string | null
  onSponsorSelected: (sponsorId: string, sponsorName: string) => void
  onSponsorRemoved: () => void
}

export const CoachSponsorshipSelector: React.FC<CoachSponsorshipSelectorProps> = ({
  currentSponsorId,
  currentSponsorName,
  onSponsorSelected,
  onSponsorRemoved
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null)
  const [showSearchResults, setShowSearchResults] = useState(false)

  useEffect(() => {
    if (currentSponsorId) {
      // Load current sponsor details
      loadSponsorDetails(currentSponsorId)
    }
  }, [currentSponsorId])

  const loadSponsorDetails = async (sponsorId: string) => {
    try {
      const profile = await apiService.getTrainerProfile(sponsorId)
      if (profile?.data && profile.data.length > 0) {
        const sponsorData = profile.data[0]
        setSelectedSponsor({
          user_id: sponsorId,
          full_name: sponsorData.full_name,
          email: sponsorData.email,
          profile_image: sponsorData.profile_image,
          hourly_rate: sponsorData.hourly_rate,
          rating: sponsorData.rating,
          total_reviews: sponsorData.total_reviews,
          is_verified: sponsorData.is_verified,
          account_status: sponsorData.account_status
        })
      }
    } catch (error) {
      console.error('Failed to load sponsor details:', error)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.trim().length < 2) {
      setSponsors([])
      setShowSearchResults(false)
      return
    }

    setSearching(true)
    try {
      // Search for trainers who can be sponsors
      const response = await apiService.getAvailableTrainers()
      const trainers = Array.isArray(response) ? response : (response?.data || [])

      // Filter approved trainers and exclude self-sponsorship
      const filtered = trainers.filter((t: any) =>
        t.account_status === 'approved' &&
        (t.full_name?.toLowerCase().includes(query.toLowerCase()) ||
          t.email?.toLowerCase().includes(query.toLowerCase())) &&
        t.user_id !== currentSponsorId // Don't show current sponsor in results
      )

      setSponsors(filtered)
      setShowSearchResults(true)
    } catch (error) {
      console.error('Failed to search sponsors:', error)
      toast({
        title: 'Search failed',
        description: 'Could not search for sponsors',
        variant: 'destructive'
      })
    } finally {
      setSearching(false)
    }
  }

  const handleSelectSponsor = async (sponsor: Sponsor) => {
    try {
      // Validate sponsor
      const validationResult = await apiService.validateSponsor(sponsor.user_id)
      if (!validationResult) {
        toast({
          title: 'Invalid sponsor',
          description: 'This trainer is not eligible to be a sponsor',
          variant: 'destructive'
        })
        return
      }

      setSelectedSponsor(sponsor)
      onSponsorSelected(sponsor.user_id, sponsor.full_name || 'Unknown')
      setSearchQuery('')
      setShowSearchResults(false)

      toast({
        title: 'Sponsor selected',
        description: `${sponsor.full_name} has been selected as your sponsor.`
      })
    } catch (error) {
      console.error('Failed to select sponsor:', error)
      toast({
        title: 'Selection failed',
        description: 'Could not select this sponsor',
        variant: 'destructive'
      })
    }
  }

  const handleRemoveSponsor = () => {
    setSelectedSponsor(null)
    onSponsorRemoved()
    setSearchQuery('')
    toast({
      title: 'Sponsor removed',
      description: 'Your sponsor has been removed.'
    })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Sponsorship</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Select a verified trainer to sponsor your account. Your sponsor will receive a commission (10%) from your bookings.
        </p>

        {selectedSponsor ? (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-blue-50 dark:bg-blue-950/30">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {selectedSponsor.profile_image && (
                  <img
                    src={selectedSponsor.profile_image}
                    alt={selectedSponsor.full_name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">{selectedSponsor.full_name}</h4>
                  <p className="text-sm text-muted-foreground">{selectedSponsor.email}</p>

                  <div className="flex items-center gap-3 mt-2">
                    {selectedSponsor.is_verified && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </Badge>
                    )}
                    {selectedSponsor.rating && (
                      <Badge variant="outline" className="text-xs">
                        ⭐ {selectedSponsor.rating} ({selectedSponsor.total_reviews} reviews)
                      </Badge>
                    )}
                    {selectedSponsor.hourly_rate && (
                      <Badge variant="outline" className="text-xs">
                        Ksh {selectedSponsor.hourly_rate}/hr
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveSponsor}
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Commission:</strong> Your sponsor will receive 10% commission from each of your bookings while you're under their sponsorship.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search trainer by name or email..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {showSearchResults && (
              <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
                {searching ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Searching trainers...
                  </div>
                ) : sponsors.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    {searchQuery.trim() ? 'No trainers found matching your search' : 'Start typing to search'}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {sponsors.map((sponsor) => (
                      <button
                        key={sponsor.user_id}
                        onClick={() => handleSelectSponsor(sponsor)}
                        className="w-full p-3 hover:bg-muted text-left transition-colors flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 flex-1">
                          {sponsor.profile_image && (
                            <img
                              src={sponsor.profile_image}
                              alt={sponsor.full_name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {sponsor.full_name}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {sponsor.email}
                            </p>
                            {sponsor.rating && (
                              <p className="text-xs text-muted-foreground mt-1">
                                ⭐ {sponsor.rating} ({sponsor.total_reviews} reviews)
                              </p>
                            )}
                          </div>
                        </div>
                        {sponsor.is_verified && (
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Optional:</strong> If you're being sponsored by another trainer, select them here. You can also leave this empty if you're training independently.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
