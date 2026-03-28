import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Star, MapPin, MessageCircle, Calendar, Users } from 'lucide-react'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { BookingForm } from './BookingForm'
import { Chat } from './Chat'
import { PINSignup } from './PINSignup'
import * as apiService from '@/lib/api-service'
import { formatGroupPricingDisplay, type GroupPricingConfig } from '@/lib/group-pricing-utils'

// Helper function for formatting trainer hourly rate
function formatHourlyRate(rate: number | null | undefined): string {
  if (rate == null || rate === 0) return '0'
  const num = Number(rate)
  if (!Number.isFinite(num)) return '0'
  if (num % 1 === 0) {
    return num.toLocaleString()
  }
  return num.toFixed(2).replace(/\.?0+$/, '')
}

export const TrainerDetails: React.FC<{ trainer: any, onClose: () => void, selectedCategory?: string | null }> = ({ trainer, onClose, selectedCategory }) => {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [categoryPricing, setCategoryPricing] = useState<any[]>([])
  const [groupTrainingData, setGroupTrainingData] = useState<GroupPricingConfig[]>([])
  const [showBooking, setShowBooking] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showPINSignup, setShowPINSignup] = useState(false)

  useEffect(() => {
    // try to fetch real profile by trainer id
    const fetchProfile = async () => {
      try {
        const data = await apiRequest('profile_get', { user_id: trainer.id }, { headers: withAuth() })
        if (data?.data) setProfile(data.data)
      } catch (err) {
        // ignore
      }
    }
    fetchProfile()
  }, [trainer.id])

  useEffect(() => {
    // Fetch trainer's categories
    const fetchCategories = async () => {
      try {
        const data = await apiService.getTrainerCategories(trainer.id)
        if (data?.data) {
          setCategories(data.data)
        }
      } catch (err) {
        console.warn('Failed to fetch trainer categories', err)
      }
    }
    fetchCategories()
  }, [trainer.id])

  useEffect(() => {
    // Fetch trainer's category pricing
    const fetchCategoryPricing = async () => {
      try {
        const data = await apiService.getTrainerCategoryPricing(trainer.id)
        if (data?.data && Array.isArray(data.data)) {
          setCategoryPricing(data.data)
        }
      } catch (err) {
        console.warn('Failed to fetch trainer category pricing', err)
      }
    }
    fetchCategoryPricing()
  }, [trainer.id])

  useEffect(() => {
    // Fetch trainer's group training pricing
    const fetchGroupTrainingData = async () => {
      try {
        const data = await apiService.getTrainerGroupPricing(trainer.id)
        if (data?.data && Array.isArray(data.data)) {
          setGroupTrainingData(data.data)
        }
      } catch (err) {
        console.warn('Failed to fetch group training data', err)
      }
    }
    fetchGroupTrainingData()
  }, [trainer.id])

  const openBooking = () => {
    if (!user) {
      setShowPINSignup(true)
    } else {
      setShowBooking(true)
    }
  }
  const openChat = () => {
    if (!user) {
      setShowPINSignup(true)
      toast({ title: 'Sign up first', description: 'Please sign up to chat with trainers.' })
    } else {
      setShowChat(true)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh]">
        <Card className="h-full sm:h-auto rounded-none sm:rounded-lg">
          {/* Mobile close button top-left */}
          <button aria-label="Close" className="absolute top-3 left-3 z-60 sm:hidden bg-white/90 p-2 rounded-full shadow" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-foreground" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>{trainer.name}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 max-h-[80vh] overflow-auto">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center text-3xl overflow-hidden">
                  {profile?.profile_image ? <img src={profile.profile_image} alt="Profile" className="w-full h-full object-cover" /> : trainer.image}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span className="font-semibold">{trainer.rating} ({trainer.reviews} reviews)</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{trainer.distance}</span>
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="font-semibold">Ksh {formatHourlyRate(profile?.hourly_rate || trainer.hourlyRate)}/hour</div>
                  <Badge variant={trainer.available ? 'default' : 'secondary'}>{trainer.available ? 'Available' : 'Busy'}</Badge>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">About</h4>
                <p className="text-sm text-muted-foreground">{profile?.bio || 'Experienced trainer in ' + trainer.discipline + '.'}</p>
              </div>

              {categories.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Service Categories</h4>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat:any,i:number)=>(
                      <Badge key={i} variant="outline" className="gap-1">
                        {cat.icon && <span>{cat.icon}</span>}
                        <span>{cat.name}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-2">Pricing</h4>
                {categoryPricing && categoryPricing.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm">
                      {categoryPricing.map((pricing: any, idx: number) => {
                        const isSelectedCategory = selectedCategory && pricing.name === selectedCategory
                        return (
                          <div key={idx} className={isSelectedCategory ? 'font-bold text-foreground' : 'text-muted-foreground'}>
                            {pricing.name}: <span className="font-semibold">Ksh {formatHourlyRate(pricing.hourly_rate)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : Array.isArray(profile?.hourly_rate_by_radius) && profile.hourly_rate_by_radius.length > 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {profile.hourly_rate_by_radius.map((tier:any, i:number) => (
                      <div key={i} className="flex justify-between">
                        <span>Within {tier.radius_km} km</span>
                        <span className="font-semibold">Ksh {formatHourlyRate(tier.rate)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Ksh {formatHourlyRate(profile?.hourly_rate || trainer.hourlyRate)}/hour</div>
                )}
              </div>

              {groupTrainingData && groupTrainingData.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Group Training
                  </h4>
                  <div className="space-y-4">
                    {groupTrainingData.map((groupPricing: GroupPricingConfig, idx: number) => (
                      <div key={idx} className="border border-border rounded-lg p-3 bg-muted/5">
                        <div className="font-medium text-sm mb-2">
                          {groupPricing.tiers && groupPricing.tiers.length > 0 ? (
                            <>Available Group Tiers ({groupPricing.pricing_model === 'per_person' ? 'per person' : 'fixed rate'})</>
                          ) : (
                            <>No group tiers configured</>
                          )}
                        </div>
                        {groupPricing.tiers && groupPricing.tiers.length > 0 && (
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {groupPricing.tiers.map((tier: any, tierIdx: number) => (
                              <div key={tierIdx} className="flex justify-between">
                                <span>{tier.group_size_name}</span>
                                <span className="font-medium">{formatGroupPricingDisplay(tier.rate, groupPricing.pricing_model)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(profile?.pricing_packages) && profile.pricing_packages.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Packages</h4>
                  <div className="space-y-2 text-sm">
                    {profile.pricing_packages.map((pkg: any, i: number) => (
                      <div key={i} className="flex justify-between border-b border-border pb-2">
                        <div>
                          <div className="font-medium">{pkg.name}</div>
                          {pkg.sessions && <div className="text-xs text-muted-foreground">{pkg.sessions} sessions</div>}
                          {pkg.description && <div className="text-xs text-muted-foreground">{pkg.description}</div>}
                        </div>
                        <div className="font-semibold text-foreground">Ksh {Number(pkg.price)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profile?.availability && (
                <div>
                  <h4 className="font-semibold mb-2">Availability</h4>
                  <div className="grid grid-cols-1 gap-1 text-sm">
                    {(() => {
                      let availability = profile.availability
                      // Parse availability if it's a string (JSON)
                      if (typeof availability === 'string') {
                        try {
                          availability = JSON.parse(availability)
                        } catch {
                          return <div className="text-muted-foreground">Unable to parse availability</div>
                        }
                      }

                      if (!availability || typeof availability !== 'object') {
                        return <div className="text-muted-foreground">No availability data</div>
                      }

                      return Object.entries(availability).map(([day, slots]: any) => (
                        <div key={day} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">{day}</span>
                          <span className="text-foreground">{Array.isArray(slots) && slots.length ? slots.join(', ') : '—'}</span>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}

              <div className="hidden sm:flex flex-col gap-1">
                <div className="flex gap-2">
                  <Button onClick={openBooking} className="bg-gradient-primary text-white"><Calendar className="h-4 w-4 mr-2" />Book Now</Button>
                  <Button variant="ghost" onClick={onClose}>Close</Button>
                </div>
              </div>

              {/* Mobile sticky footer actions (hidden while booking/chat open) */}
              {!showBooking && !showChat && (
                <div className="sm:hidden fixed bottom-0 left-0 right-0 z-60 bg-card border-t border-border p-3">
                  <div className="flex items-center gap-2">
                    <Button className="flex-1 bg-gradient-primary text-white" onClick={openBooking}><Calendar className="h-4 w-4 mr-2" />Book Now</Button>
                  </div>
                  <div className="mt-2 flex justify-center">
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                  </div>
                </div>
              )}

              {showPINSignup && (
                <div className="mt-2 max-h-[60vh] overflow-auto">
                  <PINSignup
                    onSuccess={() => {
                      setShowPINSignup(false)
                      setShowBooking(true)
                      toast({ title: 'Account created', description: 'You can now proceed with booking.' })
                    }}
                    onCancel={() => setShowPINSignup(false)}
                  />
                </div>
              )}

              {showBooking && !showPINSignup && (
                <div className="mt-2 max-h-[60vh] overflow-auto">
                  <BookingForm trainer={trainer} trainerProfile={profile} onDone={() => { setShowBooking(false); toast({ title: 'Booked', description: 'Booking request sent.' }); onClose(); }} />
                </div>
              )}

              {showChat && !showPINSignup && (
                <div className="mt-2">
                  <Chat trainer={trainer} onClose={() => setShowChat(false)} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
