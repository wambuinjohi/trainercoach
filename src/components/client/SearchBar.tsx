import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, Clock, TrendingUp, Zap } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { highlightQuery } from '@/lib/search-utils'

export interface SearchBarProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onSubmit?: (value: string) => void
  suggestions?: string[]
  recentSearches?: string[]
  popularSearches?: string[]
  categories?: Array<{ id: number; name: string; icon?: string }>
  onCategorySelect?: (categoryName: string) => void
  isLoading?: boolean
  className?: string
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search...',
  value,
  onChange,
  onSubmit,
  suggestions = [],
  recentSearches = [],
  popularSearches = [],
  categories = [],
  onCategorySelect,
  isLoading = false,
  className = '',
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [debouncedValue, setDebouncedValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<NodeJS.Timeout>()

  // Debounce search value
  useEffect(() => {
    debounceTimer.current = setTimeout(() => {
      setDebouncedValue(value)
    }, 300)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [value])

  // Filter categories by search value
  const matchingCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(value.toLowerCase())
  )

  // Combine all suggestions with categories
  const allSuggestions = [
    ...suggestions,
    ...recentSearches.filter(s => !suggestions.includes(s)),
    ...popularSearches.filter(s => !suggestions.includes(s) && !recentSearches.includes(s)),
  ]

  // Total count of all suggestion types (for keyboard navigation)
  const suggestionCount = suggestions.length
  const recentCount = recentSearches.length
  const popularCount = popularSearches.length
  const totalTextSuggestions = suggestionCount + recentCount + popularCount
  const totalItemsCount = totalTextSuggestions + matchingCategories.length

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isFocused) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestionIndex(prev =>
          prev < totalItemsCount - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedSuggestionIndex >= 0) {
          // Check if it's a category
          if (selectedSuggestionIndex >= totalTextSuggestions) {
            const categoryIndex = selectedSuggestionIndex - totalTextSuggestions
            const selectedCategory = matchingCategories[categoryIndex]
            if (selectedCategory) {
              onChange(selectedCategory.name)
              onCategorySelect?.(selectedCategory.name)
            }
          } else {
            const selectedSuggestion = allSuggestions[selectedSuggestionIndex]
            onChange(selectedSuggestion)
            onSubmit?.(selectedSuggestion)
          }
        } else {
          onSubmit?.(value)
        }
        setIsFocused(false)
        setSelectedSuggestionIndex(-1)
        break
      case 'Escape':
        setIsFocused(false)
        setSelectedSuggestionIndex(-1)
        break
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion)
    onSubmit?.(suggestion)
    setIsFocused(false)
    setSelectedSuggestionIndex(-1)
  }

  const handleClear = () => {
    onChange('')
    setSelectedSuggestionIndex(-1)
    inputRef.current?.focus()
  }

  const showSuggestions = isFocused && allSuggestions.length > 0

  const renderSuggestionText = (text: string) => {
    if (!value) return text
    const parts = highlightQuery(text, value)
    return parts.map((part, idx) =>
      part.highlighted ? (
        <mark key={idx} className="bg-primary/20 font-semibold">
          {part.text}
        </mark>
      ) : (
        <span key={idx}>{part.text}</span>
      )
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Input Container */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="pl-10 pr-10 h-12 rounded-full bg-input border-border text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:ring-2 focus:ring-primary/50"
          aria-label="Search"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? 'search-suggestions' : undefined}
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <Card
          id="search-suggestions"
          className="absolute top-full left-0 right-0 mt-2 z-50 border-border shadow-lg max-h-96 overflow-y-auto"
          role="listbox"
        >
          <CardContent className="p-2 space-y-1">
            {/* Suggestions Section */}
            {suggestions.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  Suggestions
                </div>
                {suggestions.slice(0, 3).map((suggestion, idx) => (
                  <button
                    key={`suggestion-${idx}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSuggestionClick(suggestion)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedSuggestionIndex === idx
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted text-foreground'
                    }`}
                    role="option"
                    aria-selected={selectedSuggestionIndex === idx}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <span className="truncate">{renderSuggestionText(suggestion)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Recent Searches Section */}
            {recentSearches.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-2">
                  <Clock className="h-3 w-3" />
                  Recent
                </div>
                {recentSearches.slice(0, 3).map((search, idx) => {
                  const absoluteIdx = suggestions.length + idx
                  return (
                    <button
                      key={`recent-${idx}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleSuggestionClick(search)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedSuggestionIndex === absoluteIdx
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      role="option"
                      aria-selected={selectedSuggestionIndex === absoluteIdx}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{renderSuggestionText(search)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Popular Searches Section */}
            {popularSearches.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3" />
                  Trending
                </div>
                {popularSearches.slice(0, 3).map((search, idx) => {
                  const absoluteIdx = suggestions.length + recentSearches.length + idx
                  return (
                    <button
                      key={`popular-${idx}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleSuggestionClick(search)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedSuggestionIndex === absoluteIdx
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      role="option"
                      aria-selected={selectedSuggestionIndex === absoluteIdx}
                    >
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{renderSuggestionText(search)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default SearchBar
