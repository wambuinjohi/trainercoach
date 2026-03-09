import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { CategoryForm } from '@/components/admin/CategoryForm'
import { CategoryList } from '@/components/admin/CategoryList'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [catForm, setCatForm] = useState({ name: '', icon: '', description: '' })
  const [catLoading, setCatLoading] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const data = await apiService.getCategories()
      const categoriesList = Array.isArray(data) ? data : data?.data || []
      setCategories(categoriesList)
    } catch (error) {
      console.error('Failed to load categories:', error)
      toast({ title: 'Error', description: 'Failed to load categories', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const addCategory = async () => {
    if (!catForm.name.trim()) {
      toast({ title: 'Error', description: 'Category name is required', variant: 'destructive' })
      return
    }

    setCatLoading(true)
    try {
      const result = await apiService.addCategory(catForm.name, catForm.icon, catForm.description)
      const categoryId = result?.id || Date.now()
      setCategories([...categories, { id: categoryId, ...catForm, created_at: new Date().toISOString() }])
      setCatForm({ name: '', icon: '', description: '' })
      toast({ title: 'Success', description: 'Category added' })
    } catch (err: any) {
      console.error('Add category error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to add category', variant: 'destructive' })
    } finally {
      setCatLoading(false)
    }
  }

  const updateCategory = async (id: any, patch: any) => {
    try {
      await apiService.updateCategory(id, patch)
      setCategories(categories.map(c => (c.id === id ? { ...c, ...patch } : c)))
      toast({ title: 'Success', description: 'Category updated' })
    } catch (err: any) {
      console.error('Update category error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to update category', variant: 'destructive' })
    }
  }

  const deleteCategory = async (id: any) => {
    try {
      await apiService.deleteCategory(id)
      setCategories(categories.filter(c => c.id !== id))
      toast({ title: 'Success', description: 'Category deleted' })
    } catch (err: any) {
      console.error('Delete category error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to delete category', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading categories...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Categories</h1>
        <Badge variant="secondary">{categories.length}</Badge>
      </div>

      <CategoryForm
        name={catForm.name}
        icon={catForm.icon}
        description={catForm.description}
        onNameChange={(value) => setCatForm({ ...catForm, name: value })}
        onIconChange={(emoji) => setCatForm({ ...catForm, icon: emoji })}
        onDescriptionChange={(value) => setCatForm({ ...catForm, description: value })}
        onSubmit={addCategory}
        loading={catLoading}
      />

      <CategoryList
        categories={categories}
        onUpdate={updateCategory}
        onDelete={deleteCategory}
        onCategoryChange={(id, field, value) => setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, [field]: value } : c)))}
      />
    </div>
  )
}
