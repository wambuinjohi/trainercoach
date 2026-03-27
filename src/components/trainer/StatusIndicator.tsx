import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, AlertCircle, XCircle, FileCheck, DollarSign, MapPin, Smartphone } from 'lucide-react'
import { AccountStatus } from '@/types'

interface StatusIndicatorProps {
  status?: AccountStatus
  profileData?: {
    full_name?: string
    profile_image?: string | null
    bio?: string
    hourly_rate?: number
    service_radius?: number
    area_of_residence?: string
    mpesa_number?: string
    selectedCategories?: any[]
    disciplines?: any[]
    grace_period?: {
      status?: 'active' | 'expired'
      start_date?: string
      end_date?: string
      reason?: string
    }
  }
  onAction?: () => void
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status = 'registered', onAction, profileData }) => {
  const stages: Record<AccountStatus, { label: string; icon: React.ReactNode; color: string; description: string }> = {
    registered: {
      label: 'Registered',
      icon: <AlertCircle className="w-5 h-5" />,
      color: 'bg-blue-100 border-blue-300',
      description: 'Complete your profile to proceed'
    },
    profile_incomplete: {
      label: 'Complete Profile',
      icon: <Clock className="w-5 h-5" />,
      color: 'bg-yellow-100 border-yellow-300',
      description: 'Upload verification documents to proceed'
    },
    pending_approval: {
      label: 'Pending Approval',
      icon: <FileCheck className="w-5 h-5" />,
      color: 'bg-purple-100 border-purple-300',
      description: 'Your documents are under review. You\'ll be able to start receiving bookings once approved.'
    },
    approved: {
      label: 'Approved',
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: 'bg-green-100 border-green-300',
      description: 'You are approved to start training'
    },
    suspended: {
      label: 'Suspended',
      icon: <XCircle className="w-5 h-5" />,
      color: 'bg-red-100 border-red-300',
      description: 'Your account has been suspended'
    }
  }

  const stageOrder: AccountStatus[] = ['registered', 'profile_incomplete', 'pending_approval', 'approved']
  const currentStageIndex = Math.max(0, stageOrder.indexOf(status))

  const currentStage = stages[status]

  return (
    <Card className={`border-2 ${currentStage.color}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            <div className="text-blue-600 mt-1">{currentStage.icon}</div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">{currentStage.label}</h3>
            </div>
          </div>

          {/* Status Badge */}
          <Badge className="ml-4 whitespace-nowrap" variant={status === 'approved' ? 'default' : 'secondary'}>
            {currentStage.label}
          </Badge>
        </div>

        {/* Profile Summary */}
        {profileData && (
          <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200 space-y-3">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Profile Summary</div>

            {profileData.selectedCategories && profileData.selectedCategories.length > 0 && (
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Categories</p>
                <div className="flex flex-wrap gap-1">
                  {profileData.selectedCategories.map((cat: any) => (
                    <Badge key={cat.id} variant="outline" className="text-xs">
                      {cat.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {profileData.hourly_rate && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-600">Hourly Rate</p>
                    <p className="text-sm font-semibold">Ksh {profileData.hourly_rate}</p>
                  </div>
                </div>
              )}

              {profileData.service_radius && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-600">Service Radius</p>
                    <p className="text-sm font-semibold">{profileData.service_radius} km</p>
                  </div>
                </div>
              )}

              {profileData.area_of_residence && (
                <div className="flex items-center gap-2 col-span-2">
                  <MapPin className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className="text-xs text-gray-600">Location</p>
                    <p className="text-sm font-semibold">{profileData.area_of_residence}</p>
                  </div>
                </div>
              )}

              {profileData.mpesa_number && (
                <div className="flex items-center gap-2 col-span-2">
                  <Smartphone className="w-4 h-4 text-orange-600" />
                  <div>
                    <p className="text-xs text-gray-600">M-Pesa Number</p>
                    <p className="text-sm font-semibold font-mono">{profileData.mpesa_number}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Required Documents Section */}
        {status === 'profile_incomplete' && (
          <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200 space-y-2">
            <p className="text-sm font-semibold text-yellow-900">Document Submission:</p>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>✓ National ID (government-issued)</li>
              <li className="text-yellow-700">○ Proof of Residence (optional - GPS location from profile)</li>
              <li className="text-yellow-700">○ Certificate of Good Conduct (optional - to enhance credibility)</li>
              <li className="text-yellow-700">○ Discipline Certificate (optional - professional certification)</li>
              <li className="text-yellow-700">○ Sponsor Reference (optional - if sponsored)</li>
            </ul>
            <p className="text-xs text-yellow-700 mt-2 font-medium">All documents will be reviewed within 24-48 hours.</p>
          </div>
        )}

        {/* Grace Period Indicator */}
        {profileData?.grace_period?.status === 'active' && (
          <div className="mt-4 p-3 bg-orange-50 rounded border border-orange-200 space-y-2">
            <p className="text-sm font-semibold text-orange-900 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Grace Period Active
            </p>
            <p className="text-sm text-orange-800">
              Your Certificate of Good Conduct is in a 30-day grace period. Please upload a new certificate before the grace period expires.
            </p>
            {profileData.grace_period.end_date && (
              <p className="text-xs text-orange-700">
                Expires: {new Date(profileData.grace_period.end_date).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Next Steps */}
        {status !== 'approved' && status !== 'suspended' && (
          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200 space-y-2">
            {status === 'registered' && profileData && (() => {
              const pendingItems: string[] = []
              if (!profileData.profile_image) pendingItems.push('profile photo')
              if (!profileData.selectedCategories || profileData.selectedCategories.length === 0) pendingItems.push('training categories')
              if (!profileData.bio) pendingItems.push('bio')
              if (!profileData.hourly_rate) pendingItems.push('hourly rate')
              if (!profileData.service_radius) pendingItems.push('service area')
              if (!profileData.mpesa_number) pendingItems.push('M-Pesa payment method')

              if (pendingItems.length === 0) {
                return <>
                  <p className="text-sm font-semibold text-gray-900">Your profile is complete.</p>
                </>
              }
              return <>
                <p className="text-sm font-semibold text-gray-900"><strong>Pending Items:</strong></p>
                <ul className="text-sm text-gray-700 space-y-1 ml-4">
                  {pendingItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span className="capitalize">{item}</span>
                    </li>
                  ))}
                </ul>
              </>
            })()}
            {status === 'profile_incomplete' && (
              <>
                <p className="text-sm font-semibold text-gray-900"><strong>Next Step:</strong></p>
                <p className="text-sm text-gray-700">Submit your verification documents for approval:</p>
                <ul className="text-sm text-gray-700 space-y-1 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>National ID</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span>Proof of Residence</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span>Certificate of Good Conduct</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span>Discipline Certificate (optional)</span>
                  </li>
                </ul>
              </>
            )}
            {status === 'pending_approval' && (
              <>
                <p className="text-sm font-semibold text-gray-900"><strong>Status:</strong> Documents Under Review</p>
                <p className="text-sm text-gray-700">Your documents are being reviewed by our admin team. You'll be able to start receiving bookings once approved. This typically takes 1-3 business days.</p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
