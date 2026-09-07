'use client'

import { useState, useMemo } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getAuthenticatedUser } from '@/lib/offline/auth'
import type { QuickNote } from '@/types/database'
import {
  StickyNote,
  Plus,
  Search,
  Pin,
  Trash2,
  Edit2,
  Copy,
  Check,
  X,
  Loader2,
  Sparkles,
  Calendar,
} from 'lucide-react'

export default function QuickNotesPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterView, setFilterView] = useState<'all' | 'pinned'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<QuickNote | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPinned, setIsPinned] = useState(false)

  // Copy Feedback State
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setIsPinned(false)
    setEditingNote(null)
  }

  const handleOpenEdit = (note: QuickNote) => {
    setEditingNote(note)
    setTitle(note.title)
    setDescription(note.description)
    setIsPinned(note.is_pinned)
    setIsModalOpen(true)
  }

  const handleCopy = async (note: QuickNote) => {
    try {
      const textToCopy = `${note.title}\n\n${note.description}`
      await navigator.clipboard.writeText(textToCopy)
      setCopiedId(note.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  // Query: Fetch Quick Notes
  const { data: notes = [], isLoading } = useQuery<QuickNote[]>({
    queryKey: ['quick-notes'],
    queryFn: async () => {
      const user = await getAuthenticatedUser()
      if (!user) return []

      const supabase = createClient()
      const { data, error } = await supabase
        .from('quick_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) return []
      return data || []
    },
  })

  // Mutation: Create or Update Quick Note
  const saveNoteMutation = useMutation({
    mutationFn: async () => {
      const user = await getAuthenticatedUser()
      if (!user) throw new Error('User not authenticated')

      const supabase = createClient()
      const payload = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        is_pinned: isPinned,
      }

      if (editingNote) {
        const { data, error } = await supabase
          .from('quick_notes')
          .update(payload)
          .eq('id', editingNote.id)
          .select()
          .single()
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('quick_notes')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        return data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-notes'] })
      setIsModalOpen(false)
      resetForm()
    },
  })

  // Mutation: Toggle Pin
  const togglePinMutation = useMutation({
    mutationFn: async ({ id, is_pinned }: { id: string; is_pinned: boolean }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('quick_notes')
        .update({ is_pinned })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, is_pinned }) => {
      await queryClient.cancelQueries({ queryKey: ['quick-notes'] })
      const previousNotes = queryClient.getQueryData<QuickNote[]>(['quick-notes'])
      queryClient.setQueryData<QuickNote[]>(['quick-notes'], (old = []) =>
        old.map((n) => (n.id === id ? { ...n, is_pinned } : n))
      )
      return { previousNotes }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(['quick-notes'], context.previousNotes)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-notes'] })
    },
  })

  // Mutation: Delete Quick Note
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('quick_notes').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['quick-notes'] })
      const previousNotes = queryClient.getQueryData<QuickNote[]>(['quick-notes'])
      queryClient.setQueryData<QuickNote[]>(['quick-notes'], (old = []) =>
        old.filter((n) => n.id !== id)
      )
      return { previousNotes }
    },
    onError: (_err, _id, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(['quick-notes'], context.previousNotes)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-notes'] })
    },
  })

  // Filtered & Sorted Notes
  const filteredNotes = useMemo(() => {
    let result = [...notes]

    if (filterView === 'pinned') {
      result = result.filter((n) => n.is_pinned)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (n) => n.title.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)
      )
    }

    result.sort((a, b) => {
      // Pinned always on top
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1
      }
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB
    })

    return result
  }, [notes, filterView, searchQuery, sortBy])

  // Format relative timestamp
  const formatNoteDate = (isoStr: string) => {
    const date = new Date(isoStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <AppShell>
      <section className="flex flex-col gap-6 max-w-4xl mx-auto py-2">
        {/* Header with Title & Action */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-300 ring-1 ring-zinc-700/50 shadow-md">
              <StickyNote className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Quick Notes</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 font-normal shrink-0">
                  Scratchpad
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Fleeting thoughts, sudden ideas, and instant notes separate from your review vault
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              resetForm()
              setIsModalOpen(true)
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition-all active:scale-95 shadow-sm shadow-white/10 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>New Note</span>
          </button>
        </header>

        {/* Controls Bar: Search, Filter Tabs, Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quick notes by title or content..."
              className="w-full rounded-full border border-zinc-800 bg-zinc-900/80 pl-10 pr-4 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* View Filter (All vs Pinned) */}
            <div className="flex rounded-full border border-zinc-800 bg-zinc-900/80 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterView('all')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterView === 'all'
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All ({notes.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterView('pinned')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterView === 'pinned'
                    ? 'bg-white text-zinc-950 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Pinned
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-zinc-900">Sort: Newest</option>
                <option value="oldest" className="bg-zinc-900">Sort: Oldest</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modal / Dialog for New / Edit Quick Note */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
            <div
              className="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-zinc-300" />
                  <span>{editingNote ? 'Edit Quick Note' : 'Create Quick Note'}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!title.trim() || !description.trim()) return
                  saveNoteMutation.mutate()
                }}
                className="flex flex-col gap-4"
              >
                {/* Title */}
                <div>
                  <label className="block text-[11px] md:text-xs font-semibold text-zinc-300 mb-1.5">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Quick architectural thought on cache invalidation..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs md:text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] md:text-xs font-semibold text-zinc-300 mb-1.5">
                    Content / Note Body *
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Type anything that comes to mind... snippets, reminders, unpolished thoughts."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs md:text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none resize-none leading-relaxed font-sans transition-colors"
                  />
                </div>

                {/* Pin Toggle */}
                <label className="flex items-center gap-2 select-none cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="rounded border-zinc-800 bg-zinc-900 accent-white h-4 w-4 cursor-pointer"
                  />
                  <Pin className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Pin this note to the top</span>
                </label>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveNoteMutation.isPending || !title.trim() || !description.trim()}
                    className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 active:scale-95 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {saveNoteMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span>{editingNote ? 'Save Changes' : 'Save Note'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Notes Grid Display (Vault Layout) */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            <span className="mt-2 text-xs font-mono text-zinc-400">Loading quick notes...</span>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-900/30 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-500 mb-3">
              <StickyNote className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">No quick notes found</h3>
            <p className="mt-1 text-xs text-zinc-500 max-w-sm">
              {searchQuery
                ? 'No notes matched your search query.'
                : 'Jot down sudden thoughts, quick code snippets, or fleeting ideas in seconds.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNotes.map((note) => {
              const isCopied = copiedId === note.id

              return (
                <article
                  key={note.id}
                  className={`group relative flex flex-col justify-between rounded-2xl border bg-zinc-900/50 p-5 transition-all hover:bg-zinc-900/85 shadow-sm ${
                    note.is_pinned
                      ? 'border-zinc-700/80 ring-1 ring-white/10'
                      : 'border-zinc-800/80 hover:border-zinc-700/80'
                  }`}
                >
                  <div>
                    {/* Top Metadata Row: Pin Badge & Actions */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        {note.is_pinned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700/60 px-2 py-0.5 text-[10px] font-mono text-zinc-200 font-semibold">
                            <Pin className="h-2.5 w-2.5 rotate-45 text-red-400" />
                            <span>Pinned</span>
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatNoteDate(note.created_at)}
                        </span>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        {/* Copy Button */}
                        <button
                          type="button"
                          onClick={() => handleCopy(note)}
                          className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Copy note text"
                        >
                          {isCopied ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400 stroke-[2.5]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {/* Pin Button */}
                        <button
                          type="button"
                          onClick={() =>
                            togglePinMutation.mutate({ id: note.id, is_pinned: !note.is_pinned })
                          }
                          className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                            note.is_pinned
                              ? 'text-red-400 hover:bg-zinc-800'
                              : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                          }`}
                          title={note.is_pinned ? 'Unpin note' : 'Pin to top'}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(note)}
                          className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Edit note"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete note "${note.title}"?`)) {
                              deleteNoteMutation.mutate(note.id)
                            }
                          }}
                          className="rounded-lg p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Note Title */}
                    <h2 className="text-base font-bold tracking-tight text-white leading-snug break-words mb-2">
                      {note.title}
                    </h2>

                    {/* Note Description / Body */}
                    <p className="text-xs md:text-sm text-zinc-300 leading-relaxed break-words whitespace-pre-wrap font-sans">
                      {note.description}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </AppShell>
  )
}
