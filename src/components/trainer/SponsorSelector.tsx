import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Search, Check, X, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'

interface Trainer {
  user_id: string
  full_name: string
  email: string
  phone_number?: string
  disciplines?: string[] | string
  hourly_rate?: number
  is_approved?: boolean
}

interface SponsorSelectorProps {
  currentSponsorId?: string | null
  currentSponsorName?: string | null
  onSponsorSelected: (sponsorId: string, sponsorName: string) => void
  onSponsorRemoved?: () => void
  required?: boolean
  registrationPath?: 'direct' | 'sponsored'
}

export const SponsorSelector: React.FC<SponsorSelectorProps> = ({
  currentSponsorId,
  currentSponsorName,
  onSponsorSelected,
  onSponsorRemoved,
  required = false,
  registrationPath = 'direct',
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedSponsor, setSelectedSponsor] = useState<Trainer | null>(null)
  const [sponsorIdManualEntry, setSponsorIdManualEntry] = useState('')
  const [validatingSponsorId, setValidatingSponsorId] = useState(false)
  const [sponsorValidationError, setSponsorValidationError] = useState<string | null>(null)
  const [showManualEntry, setShowManualEntry] = useState(false)

  useEffect(() => {
    if (currentSponsorId && currentSponsorName) {
      setSelectedSponsor({
        user_id: currentSponsorId,
        full_name: currentSponsorName,
        email: '',
      })
    }
  }, [currentSponsorId, currentSponsorName])

  const searchSponsors = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Empty search',
        description: 'Please enter a trainer name, email, or phone number',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setHasSearched(true)
    try {
      // Search for approved trainers matching the query
      const response = await apiService.getUsers()
      const users = Array.isArray(response) ? response : response?.data || []

      const filteredTrainers = users.filter((u: any) => {
        // Only show approved trainers
        if (!u.is_approved || u.user_type !== 'trainer') return false

        const query = searchQuery.toLowerCase()
        const fullName = (u.full_name || '').toLowerCase()
        const email = (u.email || '').toLowerCase()
        const phone = (u.phone_number || '').toLowerCase()

        return fullName.includes(query) || email.includes(query) || phone.includes(query)
      })

      setSearchResults(filteredTrainers.slice(0, 10)) // Limit to 10 results
    } catch (error) {
      console.error('Failed to search sponsors:', error)
      toast({
        title: 'Search failed',
        description: 'Could not search for trainers. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSelectSponsor = (trainer: Trainer) => {
    setSelectedSponsor(trainer)
    onSponsorSelected(trainer.user_id, trainer.full_name || trainer.email)
    setSearchQuery('')
    setSearchResults([])
    toast({
      title: 'Success',
      description: `${trainer.full_name || trainer.email} selected as your sponsor.`,
    })
  }

  const handleRemoveSponsor = () => {
    setSelectedSponsor(null)
    onSponsorRemoved?.()
    toast({
      title: 'Sponsor removed',
      description: 'Your sponsor reference has been cleared.',
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchSponsors()
    }
  }

  const validateAndSelectSponsorById = async () => {
    if (!sponsorIdManualEntry.trim()) {
      setSponsorValidationError('Please enter a Sponsor ID')
      return
    }

    setValidatingSponsorId(true)
    setSponsorValidationError(null)

    try {
      // Try to fetch the trainer profile by ID
      const response = await apiService.getUserProfile(sponsorIdManualEntry.trim())
      const profileList = Array.isArray(response) ? response : (response?.data && Array.isArray(response.data) ? response.data : [])

      if (profileList.length === 0) {
        setSponsorValidationError('Sponsor ID not found. Please check and try again.')
        return
      }

      const sponsorProfile = profileList[0]

      // Verify the user is a trainer and is approved
      if (sponsorProfile.user_type !== 'trainer') {
        setSponsorValidationError('This ID does not belong to a trainer.')
        return
      }

      if (!sponsorProfile.is_approved) {
        setSponsorValidationError('This trainer has not been approved yet. Please select an approved trainer.')
        return
      }

      // Valid sponsor found
      const sponsorName = sponsorProfile.full_name || sponsorProfile.email || sponsorProfile.user_id
      setSelectedSponsor({
        user_id: sponsorProfile.user_id,
        full_name: sponsorName,
        email: sponsorProfile.email,
      })
      onSponsorSelected(sponsorProfile.user_id, sponsorName)
      setSponsorIdManualEntry('')
      setShowManualEntry(false)
      toast({
        title: 'Success',
        description: `${sponsorName} validated and selected as your sponsor.`,
      })
    } catch (error) {
      console.error('Failed to validate sponsor ID:', error)
      setSponsorValidationError('Could not validate sponsor ID. Please try again.')
    } finally {
      setValidatingSponsorId(false)
    }
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          {registrationPath === 'sponsored' ? 'Select Your Sponsor' : 'Sponsor/Reference Selection'}
          {required && registrationPath === 'sponsored' && (
            <span className="text-red-600 ml-1">*</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-100 border-blue-300 dark:bg-blue-900/40 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            A sponsor is a registered and approved trainer who will vouch for your credentials. This helps build trust in the community.
          </AlertDescription>
        </Alert>

        {selectedSponsor && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/20 dark:border-green-900">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-200">
                    {selectedSponsor.full_name || selectedSponsor.email}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {selectedSponsor.email}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveSponsor}
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {!selectedSponsor && (
          <div className="space-y-3">
            {/* Search Tab */}
            {!showManualEntry && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="sponsor-search" className="text-sm font-medium">
                    Search for a Sponsor
                  </Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="sponsor-search"
                      placeholder="Enter trainer name, email, or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={loading}
                      className="flex-1"
                    />
                    <Button
                      onClick={searchSponsors}
                      disabled={loading || !searchQuery.trim()}
                      variant="outline"
                      size="sm"
                      className="px-3"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {hasSearched && (
                  <div className="space-y-2">
                    {searchResults.length === 0 ? (
                      <div className="p-3 text-center text-muted-foreground text-sm">
                        {loading ? 'Searching...' : 'No trainers found. Try a different search.'}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {searchResults.map((trainer) => (
                          <div
                            key={trainer.user_id}
                            className="p-3 border border-border rounded-lg hover:bg-white dark:hover:bg-slate-900 cursor-pointer transition"
                            onClick={() => handleSelectSponsor(trainer)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-foreground">
                                  {trainer.full_name || trainer.email}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {trainer.email}
                                </p>
                                {trainer.phone_number && (
                                  <p className="text-xs text-muted-foreground">
                                    {trainer.phone_number}
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline" className="ml-2">
                                Verified
                              </Badge>
                            </div>

                            {trainer.hourly_rate && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                Rate: KES {trainer.hourly_rate}/hour
                              </div>
                            )}

                            {Array.isArray(trainer.disciplines) && trainer.disciplines.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {(trainer.disciplines as string[]).slice(0, 3).map((discipline, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {discipline}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowManualEntry(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Or enter Sponsor ID manually →
                </button>
              </div>
            )}

            {/* Manual Entry Tab */}
            {showManualEntry && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="sponsor-id-manual" className="text-sm font-medium">
                    Enter Sponsor ID
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the Sponsor trainer's user ID for validation
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="sponsor-id-manual"
                      placeholder="Enter sponsor user ID..."
                      value={sponsorIdManualEntry}
                      onChange={(e) => {
                        setSponsorIdManualEntry(e.target.value)
                        setSponsorValidationError(null)
                      }}
                      disabled={validatingSponsorId}
                      className="flex-1"
                    />
                    <Button
                      onClick={validateAndSelectSponsorById}
                      disabled={validatingSponsorId || !sponsorIdManualEntry.trim()}
                      variant="outline"
                      size="sm"
                      className="px-3"
                    >
                      {validatingSponsorId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {sponsorValidationError && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      {sponsorValidationError}
                    </AlertDescription>
                  </Alert>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowManualEntry(false)
                    setSponsorIdManualEntry('')
                    setSponsorValidationError(null)
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  ← Back to search
                </button>
              </div>
            )}

            <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
              Only approved trainers can be selected as sponsors. Your sponsor details will be verified.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
