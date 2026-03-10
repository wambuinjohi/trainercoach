import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, AlertCircle, XCircle, FileCheck } from 'lucide-react'
import { AccountStatus } from '@/types'

interface StatusIndicatorProps {
  status: AccountStatus
  onAction?: () => void
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, onAction }) => {
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

        {/* Next Steps */}
        {status !== 'approved' && status !== 'suspended' && (
          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm text-gray-700">
              {status === 'registered' && (
                <>
                  <strong>Next Step:</strong> Complete your profile with your photo, discipline, bio, hourly rate, service area, and M-Pesa number.
                </>
              )}
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
