import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Save, Trash2 } from 'lucide-react'

interface Category {
  id: string | number
  name?: string
  icon?: string
  description?: string
  created_at?: string
}

interface CategoryListProps {
  categories: Category[]
  onUpdate: (id: string | number, category: Partial<Category>) => void
  onDelete: (id: string | number) => void
  onCategoryChange: (id: string | number, field: 'name' | 'description', value: string) => void
}

export const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  onUpdate,
  onDelete,
  onCategoryChange,
}) => {
  if (categories.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 text-sm text-muted-foreground">
          No categories added yet. Create your first category above.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <Card key={category.id} className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-lg cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                    title="Emoji icon"
                  >
                    {category.icon || '🏷️'}
                  </div>
                  <Input
                    value={category.name || ''}
                    onChange={(e) => onCategoryChange(category.id, 'name', e.target.value)}
                    className="bg-input border-border text-sm"
                    placeholder="Category name"
                  />
                </div>
                <Input
                  value={category.description || ''}
                  onChange={(e) => onCategoryChange(category.id, 'description', e.target.value)}
                  className="bg-input border-border text-sm"
                  placeholder="Description"
                />
                <div className="flex gap-2 justify-start md:justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onUpdate(category.id, {
                        name: category.name,
                        description: category.description,
                        icon: category.icon,
                      })
                    }
                    className="text-xs"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10 text-xs"
                    onClick={() => onDelete(category.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
