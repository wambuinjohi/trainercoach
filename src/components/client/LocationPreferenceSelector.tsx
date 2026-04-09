import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Home, Dumbbell, Trees, MapPin, Building2 } from 'lucide-react'

export interface LocationPreference {
  type: 'home' | 'gym' | 'park' | 'trainer_location' | 'other'
  label: string
  customLocation?: string
}

interface LocationPreferenceSelectorProps {
  value?: LocationPreference
  onChange: (preference: LocationPreference) => void
  onClose?: () => void
}

export const LocationPreferenceSelector: React.FC<LocationPreferenceSelectorProps> = ({
  value,
  onChange,
  onClose,
}) => {
  const [customLocation, setCustomLocation] = React.useState(value?.customLocation || '')

  const preferences: Array<{ type: LocationPreference['type']; label: string; icon: React.ComponentType<{ className: string }> }> = [
    { type: 'home', label: 'My Home', icon: Home },
    { type: 'gym', label: 'Gym/Studio', icon: Dumbbell },
    { type: 'park', label: 'Park/Outdoor', icon: Trees },
    { type: 'trainer_location', label: 'Trainer\'s Location', icon: Building2 },
    { type: 'other', label: 'Other Location', icon: MapPin },
  ]

  const handleSelect = (type: LocationPreference['type']) => {
    if (type === 'other') {
      onChange({
        type,
        label: 'Other Location',
        customLocation: customLocation || 'Custom location',
      })
    } else {
      onChange({
        type,
        label: preferences.find(p => p.type === type)?.label || 'Location',
      })
    }
  }

  const isSelected = (type: LocationPreference['type']) => value?.type === type

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Where will the session be?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {preferences.map(pref => {
            const Icon = pref.icon
            return (
              <button
                key={pref.type}
                onClick={() => handleSelect(pref.type)}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  isSelected(pref.type)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs sm:text-sm font-medium text-center">{pref.label}</span>
              </button>
            )
          })}
        </div>

        {value?.type === 'other' && (
          <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
            <Label className="text-sm">Specify location</Label>
            <input
              type="text"
              placeholder="e.g., Coffee shop, Friend's apartment"
              value={customLocation}
              onChange={e => setCustomLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose} className="text-sm">
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (value?.type === 'other' && !customLocation.trim()) {
                alert('Please specify a location')
                return
              }
              onClose?.()
            }}
            className="bg-gradient-primary text-white text-sm"
          >
            Confirm Location
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
