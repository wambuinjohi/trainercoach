import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmojiPickerComponent } from './EmojiPickerComponent'
import { Plus } from 'lucide-react'

interface CategoryFormProps {
  name: string
  icon: string
  description: string
  onNameChange: (value: string) => void
  onIconChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onSubmit: () => void
  loading?: boolean
}

export const CategoryForm: React.FC<CategoryFormProps> = ({
  name,
  icon,
  description,
  onNameChange,
  onIconChange,
  onDescriptionChange,
  onSubmit,
  loading = false,
}) => {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Add / Update Category</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="bg-input border-border"
            placeholder="Category name"
          />
        </div>
        <div>
          <Label htmlFor="category-icon">Icon (emoji)</Label>
          <EmojiPickerComponent
            value={icon}
            onChange={onIconChange}
            placeholder="Select emoji"
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="category-description">Description</Label>
          <Input
            id="category-description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="bg-input border-border"
            placeholder="Category description"
          />
        </div>
        <div className="md:col-span-4">
          <Button onClick={onSubmit} disabled={loading} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Category'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
