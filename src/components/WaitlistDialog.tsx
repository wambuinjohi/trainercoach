import React, { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import AuthLogo from '@/components/auth/AuthLogo'
import { getApiUrl } from '@/lib/api-config'
import { toast } from '@/hooks/use-toast'

interface Category {
  id: number
  name: string
  icon?: string
  description?: string
}

interface WaitlistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const WaitlistDialog: React.FC<WaitlistDialogProps> = ({ open, onOpenChange }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    telephone: '',
    isCoach: false,
    categoryId: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const apiUrl = getApiUrl()
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'get_categories' }),
        })

        const result = await response.json()
        if (result.status === 'success' && result.data) {
          setCategories(Array.isArray(result.data) ? result.data : [])
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      } finally {
        setLoadingCategories(false)
      }
    }

    if (open) {
      fetchCategories()
    }
  }, [open])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      isCoach: checked,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const apiUrl = getApiUrl()
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'waitlist_submit',
          name: formData.name,
          email: formData.email,
          telephone: formData.telephone,
          is_coach: formData.isCoach ? 1 : 0,
          ...(formData.categoryId && { category_id: parseInt(formData.categoryId) }),
        }),
      })

      const result = await response.json()

      if (result.status === 'success') {
        // Show success toast
        toast({
          title: 'Success!',
          description: 'You have been added to the waiting list. We\'ll notify you when Trainer launches in April 2026.',
        })

        // Reset form and close dialog on success
        setFormData({
          name: '',
          email: '',
          telephone: '',
          isCoach: false,
          categoryId: '',
        })
        onOpenChange(false)
      } else {
        // Show error toast
        toast({
          title: 'Error',
          description: result.message || 'Failed to join waiting list. Please try again.',
          variant: 'destructive',
        })
        console.error('API Error:', result.message)
      }
    } catch (error) {
      // Show error toast for network errors
      toast({
        title: 'Error',
        description: 'Network error. Please check your connection and try again.',
        variant: 'destructive',
      })
      console.error('Error submitting waitlist form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogTitle className="sr-only">Join the Trainer Waitlist</DialogTitle>
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Header Section with Logo and Tagline */}
          <div className="bg-gradient-to-b from-background to-background/50 px-6 py-8 space-y-6 border-b border-border">
            {/* Beautified Tagline with Border */}
            <div className="space-y-3 text-center">
              <div className="border-4 border-trainer-primary rounded-3xl px-6 py-4 inline-block mx-auto">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight leading-tight text-foreground">
                  FIND YOUR COACH.
                  <br />
                  FIND YOUR FREEDOM.
                </h2>
              </div>
            </div>

            {/* Logo and Arrow */}
            <div className="flex flex-col items-center gap-4">
              <AuthLogo compact containerClassName="h-96 w-96" className="h-72" />
              <ArrowUp className="w-8 h-8 text-trainer-primary animate-bounce" />
            </div>

            {/* Highlighted Launch Statement */}
            <div className="space-y-3 text-center">
              <div className="bg-trainer-primary/10 border border-trainer-primary rounded-lg px-4 py-3 inline-block mx-auto">
                <p className="text-sm font-semibold text-trainer-primary">
                  Launching April 2026 in Nairobi.
                </p>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="px-6 py-8 space-y-5 flex-1">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground font-medium">
              Name
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="border-input bg-background"
            />
          </div>

          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground font-medium">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="What kind of coach are you looking for?"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="border-input bg-background"
            />
          </div>

          {/* Telephone Input */}
          <div className="space-y-2">
            <Label htmlFor="telephone" className="text-foreground font-medium">
              Telephone
            </Label>
            <Input
              id="telephone"
              name="telephone"
              type="tel"
              placeholder="+254 XX XXX XXXX"
              value={formData.telephone}
              onChange={handleInputChange}
              required
              className="border-input bg-background"
            />
          </div>

          {/* Category Select */}
          <div className="space-y-2">
            <Label htmlFor="categoryId" className="text-foreground font-medium">
              Category of Interest
            </Label>
            {loadingCategories ? (
              <div className="text-sm text-muted-foreground">Loading categories...</div>
            ) : (
              <select
                id="categoryId"
                name="categoryId"
                value={formData.categoryId}
                onChange={handleSelectChange}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-trainer-primary"
              >
                <option value="">Select a category (optional)</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
          </div>

            {/* Coach Checkbox */}
            <div className="flex items-center gap-3 pt-2">
              <Checkbox
                id="isCoach"
                checked={formData.isCoach}
                onCheckedChange={handleCheckboxChange}
              />
              <Label htmlFor="isCoach" className="text-foreground font-normal cursor-pointer text-sm">
                I am a coach
              </Label>
            </div>

            {/* CTA Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-trainer-primary hover:bg-trainer-primary/90 text-white font-bold py-3 text-base rounded mt-6"
            >
              {isSubmitting ? 'Joining...' : 'JOIN THE WAITLIST'}
            </Button>

            {/* Footer Text */}
            <div className="text-center pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground">trainercoachconnect.com @trainerapp.ke</p>
              <p className="text-xs text-muted-foreground pt-3 font-medium">YOUR GROWTH, YOUR CHOICE.</p>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default WaitlistDialog
