'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Tag } from '@/types/database'
import { X, Plus, Hash } from 'lucide-react'

interface TagInputProps {
  selectedTags: string[] // tag names
  onChange: (tags: string[]) => void
}

export function TagInput({ selectedTags, onChange }: TagInputProps) {
  const queryClient = useQueryClient()
  const [inputVal, setInputVal] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  // Fetch user tags
  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (error) throw error
      return data || []
    },
  })

  // Add tag (normalize lowercase, alphanumeric + dashes)
  const handleAddTag = (rawName: string) => {
    const cleanName = rawName.trim().replace(/^#/, '').toLowerCase()
    if (!cleanName) return
    if (!selectedTags.includes(cleanName)) {
      onChange([...selectedTags, cleanName])
    }
    setInputVal('')
  }

  const handleRemoveTag = (tagName: string) => {
    onChange(selectedTags.filter((t) => t !== tagName))
  }

  // Filter suggestions
  const suggestions = allTags
    .map((t) => t.name)
    .filter(
      (name) =>
        !selectedTags.includes(name) &&
        name.toLowerCase().includes(inputVal.trim().toLowerCase())
    )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-2 focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/50 transition-all">
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20"
          >
            <Hash className="h-3 w-3" />
            {tag}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="rounded-full hover:bg-amber-500/20 p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              handleAddTag(inputVal)
            } else if (e.key === 'Backspace' && !inputVal && selectedTags.length > 0) {
              handleRemoveTag(selectedTags[selectedTags.length - 1])
            }
          }}
          placeholder={selectedTags.length === 0 ? 'Add tags (e.g. web-dev, ai, books)...' : 'Add more...'}
          className="flex-1 min-w-[120px] bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none px-1 py-1"
        />
      </div>

      {/* Autocomplete suggestions dropdown */}
      {isFocused && inputVal && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              onMouseDown={() => handleAddTag(name)}
              className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
            >
              <Plus className="h-3 w-3 text-amber-400" />
              #{name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
