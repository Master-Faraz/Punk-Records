'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AppShell } from '@/components/layout/app-shell'
import { deleteRecordWithAssets } from '@/lib/supabase/cleanup'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { RecordItem, Tag } from '@/types/database'
import {
  Search,
  Star,
  ExternalLink,
  BookOpen,
  Eye,
  Calendar,
  Sparkles,
  Trash2,
  Filter,
  Plus,
  Loader2,
  Hash,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function VaultPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterView, setFilterView] = useState<'all' | 'favorites'>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'read_count' | 'next_review'>('newest')

  // Fetch all user tags for tag filtering
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

  // Fetch all records with joined tags
  const { data: records = [], isLoading } = useQuery<RecordItem[]>({
    queryKey: ['records', filterView, sortBy],
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return []

      let query = supabase
        .from('records')
        .select(`
          *,
          record_tags(
            tag:tags(*)
          )
        `)
        .eq('user_id', user.id)
        .eq('is_archived', false)

      if (filterView === 'favorites') {
        query = query.eq('is_favorite', true)
      }

      if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false })
      } else if (sortBy === 'read_count') {
        query = query.order('read_count', { ascending: false })
      } else if (sortBy === 'next_review') {
        query = query.order('next_review_at', { ascending: true })
      }

      const { data, error } = await query
      if (error) throw error

      return (data || []).map((r: any) => ({
        ...r,
        tags: r.record_tags?.map((rt: any) => rt.tag).filter(Boolean) || [],
      }))
    },
  })

  // Optimistic Toggle Favorite Mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('records')
        .update({ is_favorite })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, is_favorite }) => {
      await queryClient.cancelQueries({ queryKey: ['records'] })
      const previousRecords = queryClient.getQueryData<RecordItem[]>(['records', filterView, sortBy])
      if (previousRecords) {
        queryClient.setQueryData<RecordItem[]>(
          ['records', filterView, sortBy],
          previousRecords.map((r) => (r.id === id ? { ...r, is_favorite } : r))
        )
      }
      return { previousRecords }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousRecords) {
        queryClient.setQueryData(['records', filterView, sortBy], context.previousRecords)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] })
    },
  })

  // Delete Record Mutation with Storage Cleanup
  const deleteMutation = useMutation({
    mutationFn: async (record: RecordItem) => {
      await deleteRecordWithAssets(record)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['due-count'] })
    },
  })

  // Filter records by search (STRICTLY title only) AND tag filter
  const filteredRecords = records.filter((r) => {
    // 1. Tag filter
    if (selectedTag !== 'all') {
      const hasTag = r.tags?.some((t) => t.id === selectedTag)
      if (!hasTag) return false
    }

    // 2. Search query filter (strictly title only)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchTitle = r.title.toLowerCase().includes(q)
      if (!matchTitle) return false
    }

    return true
  })

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Knowledge Vault</h1>
            <p className="text-xs text-zinc-400">Search by title and tag-filter your notes, insights, and videos</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/editor/new"
              className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-zinc-950 transition-all hover:bg-zinc-200 active:scale-95 shadow-sm"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              New Record
            </Link>
          </div>
        </div>

        {/* Search, View, and Sort Controls */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 pl-10 pr-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* View Filter (All vs Starred) */}
            <div className="flex rounded-xl border border-zinc-800 bg-zinc-900/80 p-1 text-xs">
              <button
                onClick={() => setFilterView('all')}
                className={`rounded-lg px-3 py-1 font-medium transition-colors ${
                  filterView === 'all'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-inner'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterView('favorites')}
                className={`rounded-lg px-3 py-1 font-medium transition-colors ${
                  filterView === 'favorites'
                    ? 'bg-white text-zinc-950 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Starred
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-400">
              <Filter className="h-3.5 w-3.5 text-zinc-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-zinc-900">Sort: Newest</option>
                <option value="read_count" className="bg-zinc-900">Sort: Most Read</option>
                <option value="next_review" className="bg-zinc-900">Sort: Due First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dedicated Tag Filter Pill Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-y border-zinc-800/60 py-2.5">
          <span className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1 pl-1 shrink-0 font-mono">
            <Hash className="h-3 w-3" /> Tags:
          </span>

          <button
            onClick={() => setSelectedTag('all')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
              selectedTag === 'all'
                ? 'bg-white text-zinc-950 font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            All Tags
          </button>

          {allTags.map((tag) => {
            const isSelected = selectedTag === tag.id
            return (
              <button
                key={tag.id}
                onClick={() => setSelectedTag(isSelected ? 'all' : tag.id)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-white text-zinc-950 font-bold shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 border border-zinc-800/80'
                }`}
              >
                <span>#{tag.name}</span>
                {isSelected && <X className="h-3 w-3" />}
              </button>
            )
          })}

          <Link
            href="/settings"
            className="flex items-center gap-1 rounded-lg border border-dashed border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 whitespace-nowrap transition-colors"
          >
            <Plus className="h-3 w-3" /> Manage Tags
          </Link>
        </div>

        {/* Records Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            <span className="mt-2 text-xs">Loading vault...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-500 border border-zinc-800 mb-3">
              <BookOpen className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">No records found</h3>
            <p className="mt-1 text-xs text-zinc-500 max-w-sm">
              {searchQuery || selectedTag !== 'all'
                ? 'Try adjusting your search keywords or tag filters.'
                : 'Capture your first note, YouTube takeaway, or book highlight in under a minute.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRecords.map((record, index) => {
              const isDue = new Date(record.next_review_at) <= new Date()
              return (
                <div
                  key={record.id}
                  onClick={() => router.push(`/records/${record.id}`)}
                  className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/90 transition-all shadow-sm overflow-hidden cursor-pointer active:scale-[0.99]"
                >
                  {/* Optional Card Thumbnail Banner */}
                  {record.thumbnail_url && (
                    <div className="relative h-40 w-full block overflow-hidden bg-zinc-950 border-b border-zinc-800/80">
                      <Image
                        src={record.thumbnail_url}
                        alt={record.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 400px"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        priority={index < 2}
                        loading={index < 2 ? 'eager' : 'lazy'}
                      />
                    </div>
                  )}

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Top Row: Star & Delete */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {record.tags && record.tags.map((tag) => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedTag(tag.id)
                              }}
                              className="rounded-md bg-zinc-800/60 px-2 py-0.5 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                            >
                              #{tag.name}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleFavoriteMutation.mutate({
                                id: record.id,
                                is_favorite: !record.is_favorite,
                              })
                            }}
                            className={`rounded-lg p-1.5 transition-colors ${
                              record.is_favorite
                                ? 'text-white hover:text-zinc-200'
                                : 'text-zinc-600 hover:text-zinc-400'
                            }`}
                            title="Toggle Star"
                          >
                            <Star className={`h-4 w-4 ${record.is_favorite ? 'fill-white text-white' : ''}`} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('Delete this record and its uploaded images?')) {
                                deleteMutation.mutate(record)
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-zinc-600 hover:text-red-400 transition-all"
                            title="Delete Record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Record Title */}
                      <h3 className="text-base font-semibold tracking-tight text-zinc-100 group-hover:text-white transition-colors line-clamp-2">
                        {record.title}
                      </h3>

                      {/* Source URL */}
                      {record.source_url && (
                        <a
                          href={record.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors truncate max-w-full"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{record.source_url.replace(/^https?:\/\//, '')}</span>
                        </a>
                      )}
                    </div>

                    {/* Bottom Stats Footer */}
                    <div className="mt-5 flex items-center justify-between border-t border-zinc-800/60 pt-3 text-[11px] text-zinc-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1" title="Times revisited">
                          <Eye className="h-3.5 w-3.5 text-zinc-600" />
                          {record.read_count} reads
                        </span>
                        <span className="flex items-center gap-1" title="Repetition stage">
                          <Sparkles className="h-3.5 w-3.5 text-zinc-600" />
                          Stage {record.review_stage}
                        </span>
                      </div>

                      <div>
                        {isDue ? (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-950 font-mono shadow-sm">
                            Due for Review
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <Calendar className="h-3 w-3" />
                            {new Date(record.next_review_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
