'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Tag } from '@/types/database'
import { X, Plus, Hash, Check, ChevronDown } from 'lucide-react'

interface TagInputProps {
  selectedTags: string[] // tag names
  onChange: (tags: string[]) => void
}

export function TagInput({ selectedTags, onChange }: TagInputProps) {
  const [inputVal, setInputVal] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch all user tags
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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Add tag
  const handleAddTag = (rawName: string) => {
    const cleanName = rawName.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-')
    if (!cleanName) return
    if (!selectedTags.includes(cleanName)) {
      onChange([...selectedTags, cleanName])
    }
    setInputVal('')
  }

  // Remove tag
  const handleRemoveTag = (tagName: string) => {
    onChange(selectedTags.filter((t) => t !== tagName))
  }

  // Toggle tag
  const handleToggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      handleRemoveTag(tagName)
    } else {
      handleAddTag(tagName)
    }
  }

  // Filter existing tags based on search input
  const filteredTags = allTags.filter((t) =>
    t.name.toLowerCase().includes(inputVal.trim().toLowerCase())
  )

  const isExactMatch = allTags.some(
    (t) => t.name.toLowerCase() === inputVal.trim().toLowerCase()
  )

  const unselectedAvailableTags = allTags.filter((t) => !selectedTags.includes(t.name))

  return (
    <div ref={containerRef} className="relative space-y-2">
      {/* Selected Tags & Search Input Field */}
      <div
        onClick={() => setIsOpen(true)}
        className="flex flex-wrap items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-2 min-h-[42px] focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/50 cursor-text transition-all"
      >
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/30 animate-in fade-in zoom-in-95 duration-100"
          >
            <Hash className="h-3 w-3" />
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRemoveTag(tag)
              }}
              className="rounded-full hover:bg-amber-500/30 p-0.5 transition-colors text-amber-300"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <div className="flex-1 flex items-center min-w-[140px]">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value)
              if (!isOpen) setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                if (inputVal.trim()) {
                  handleAddTag(inputVal)
                }
              } else if (e.key === 'Backspace' && !inputVal && selectedTags.length > 0) {
                handleRemoveTag(selectedTags[selectedTags.length - 1])
              } else if (e.key === 'Escape') {
                setIsOpen(false)
              }
            }}
            placeholder={
              selectedTags.length === 0
                ? 'Select or type tags (e.g. web-dev, ai)...'
                : 'Add more tags...'
            }
            className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none px-1 py-1"
          />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen((prev) => !prev)
            }}
            className="text-zinc-500 hover:text-zinc-300 p-1"
            title="Toggle tag options"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu for selecting created tags & creating new tags */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-md animate-in fade-in duration-100">
          {/* Header */}
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-800/80 mb-1 flex items-center justify-between">
            <span>Select Existing Tags</span>
            <span>{allTags.length} available</span>
          </div>

          {/* New Tag Creator Option */}
          {inputVal.trim() && !isExactMatch && (
            <button
              type="button"
              onClick={() => handleAddTag(inputVal)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 font-semibold transition-colors mb-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Create new tag &quot;#{inputVal.trim().toLowerCase().replace(/\s+/g, '-')}&quot;
            </button>
          )}

          {/* List of User's Created Tags */}
          {filteredTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 p-1">
              {filteredTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.name)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTag(tag.name)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
                    }`}
                  >
                    {isSelected ? <Check className="h-3 w-3 stroke-[3]" /> : <Hash className="h-3 w-3 text-zinc-500" />}
                    {tag.name}
                  </button>
                )
              })}
            </div>
          ) : (
            !inputVal.trim() && (
              <div className="px-3 py-3 text-center text-xs text-zinc-500">
                No tags created yet. Type above or create tags in Settings.
              </div>
            )
          )}
        </div>
      )}

      {/* Quick Pick Tag Pills below the input (if unselected tags exist) */}
      {unselectedAvailableTags.length > 0 && !isOpen && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
            <Plus className="h-3 w-3" /> Quick add:
          </span>
          {unselectedAvailableTags.slice(0, 8).map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleAddTag(tag.name)}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800/80 bg-zinc-900/60 px-2 py-0.5 text-[11px] font-medium text-zinc-400 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400 transition-colors"
            >
              #{tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
