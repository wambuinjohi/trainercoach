import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, AlertCircle, XCircle, FileCheck, DollarSign, MapPin, Smartphone } from 'lucide-react'
import { AccountStatus } from '@/types'

interface StatusIndicatorProps {
  status: AccountStatus
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
  }
  onAction?: () => void
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, onAction, profileData }) => {
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
      description: 'Admin is reviewing your application'
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
              <p className="text-sm text-gray-600 mb-4">{currentStage.description}</p>

              {/* Progress Stages */}
              <div className="mt-4">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-3">
                  <span>Account Status Progress</span>
                </div>
                <div className="flex gap-2">
                  {stageOrder.map((stage, index) => (
                    <div key={stage} className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          index <= currentStageIndex
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </div>
                      {index < stageOrder.length - 1 && (
                        <div
                          className={`h-1 w-8 ${
                            index < currentStageIndex ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        ></div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2 text-xs text-gray-600">
                  <div>1. Register</div>
                  <div>→</div>
                  <div>2. Profile</div>
                  <div>→</div>
                  <div>3. Documents</div>
                  <div>→</div>
                  <div>4. Approved</div>
                </div>
              </div>
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

        {/* Next Steps */}
        {status !== 'approved' && status !== 'suspended' && (
          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm text-gray-700">
              {status === 'registered' && (() => {
                const missingFields: string[] = []
                if (!profileData?.profile_image) missingFields.push('photo')
                if (!profileData?.selectedCategories || profileData.selectedCategories.length === 0) missingFields.push('categories')
                if (!profileData?.bio) missingFields.push('bio')
                if (!profileData?.hourly_rate) missingFields.push('hourly rate')
                if (!profileData?.service_radius || !profileData?.area_of_residence) missingFields.push('service area')
                if (!profileData?.mpesa_number) missingFields.push('M-Pesa number')

                if (missingFields.length === 0) {
                  return <>
                    <strong>Next Step:</strong> Your profile is complete. Click "Edit Profile" to submit verification documents for approval.
                  </>
                }
                return <>
                  <strong>Next Step:</strong> Complete your profile with your {missingFields.join(', ')}.
                </>
              })()}
              {status === 'profile_incomplete' && (
                <>
                  <strong>Next Step:</strong> Upload all required verification documents (National ID, Proof of Residence, Good Conduct Certificate, Discipline Certificate, and Sponsor Reference).
                </>
              )}
              {status === 'pending_approval' && (
                <>
                  <strong>Status:</strong> Your documents are being reviewed by our admin team. You'll be notified once approved.
                </>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
