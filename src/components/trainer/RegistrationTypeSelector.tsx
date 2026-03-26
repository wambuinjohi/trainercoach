import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'

interface RegistrationTypeSelectorProps {
  userId: string
  onComplete?: () => void
}

type RegistrationPath = 'direct' | 'sponsored'

interface PathOption {
  type: RegistrationPath
  title: string
  description: string
  requirements: string[]
}

const pathOptions: PathOption[] = [
  {
    type: 'direct',
    title: 'Direct Registration',
    description: 'Register as an independent trainer and build your own client base',
    requirements: [
      'Valid national ID',
      'Proof of residence (GPS location)',
      'Discipline certificate (professional certification)'
    ]
  },
  {
    type: 'sponsored',
    title: 'Sponsored Registration',
    description: 'Register through a coach/sponsor who will guide your journey',
    requirements: [
      'Valid national ID',
      'Proof of residence (GPS location)',
      'Sponsorship approval'
    ]
  }
]

export const RegistrationTypeSelector: React.FC<RegistrationTypeSelectorProps> = ({
  userId,
  onComplete
}) => {
  const [selectedType, setSelectedType] = useState<RegistrationPath | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSelect = (type: RegistrationPath) => {
    setSelectedType(type)
  }

  const handleConfirm = async () => {
    if (!selectedType) {
      toast({ title: 'Error', description: 'Please select a registration type', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      // Update the registration path and lock it
      const response = await apiService.updateUserProfile(userId, {
        registration_path: selectedType,
        path_locked: true
      })

      // Response could be direct data or wrapped in .data property
      const responseData = Array.isArray(response) ? response : (response?.data ?? response)
      if (responseData) {
        toast({
          title: 'Success',
          description: `You have been registered as a ${selectedType === 'direct' ? 'direct' : 'sponsored'} trainer`
        })
        onComplete?.()
      }
    } catch (error) {
      console.error('Failed to set registration type:', error)
      toast({
        title: 'Error',
        description: 'Failed to save your registration type. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl border-border shadow-card">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-foreground">Choose Your Path</CardTitle>
          <CardDescription className="text-base mt-2">
            Select how you want to start your journey as a trainer
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            {pathOptions.map((option) => (
              <div
                key={option.type}
                className={`relative p-6 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                  selectedType === option.type
                    ? 'border-trainer-primary bg-trainer-primary/5'
                    : 'border-border hover:border-trainer-primary/50'
                }`}
                onClick={() => handleSelect(option.type)}
              >
                {selectedType === option.type && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle2 className="h-6 w-6 text-trainer-primary" />
                  </div>
                )}

                <div className="pr-8">
                  <h3 className="text-xl font-semibold text-foreground mb-2">{option.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{option.description}</p>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Requirements</p>
                    <ul className="space-y-2">
                      {option.requirements.map((req, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-trainer-primary font-bold mt-0.5">•</span>
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> This choice is final and cannot be changed after confirmation.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setSelectedType(null)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Clear Selection
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedType || isSubmitting}
              className="flex-1 bg-trainer-primary text-white hover:bg-trainer-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                'Confirm & Continue'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default RegistrationTypeSelector
