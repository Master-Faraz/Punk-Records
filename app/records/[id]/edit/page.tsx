'use client'

import { use, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/layout/app-shell'
import { TiptapEditor } from '@/components/editor/tiptap-editor'
import { TagInput } from '@/components/tags/tag-input'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { cleanupRemovedAssets } from '@/lib/supabase/cleanup'
import { processAndUploadPendingAssets } from '@/lib/supabase/asset-uploader'
import type { RecordItem } from '@/types/database'
import { ArrowLeft, Save, Loader2, Link2, Image as ImageIcon, X } from 'lucide-react'
import Link from 'next/link'

import { getAuthenticatedUser } from '@/lib/offline/auth'
import { enqueueMutation } from '@/lib/offline/outbox'

export default function EditRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const thumbnailInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [content, setContent] = useState<any>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Fetch existing record with instant fallback to vault records cache
  const { data: record, isLoading, isPending } = useQuery<RecordItem | null>({
    queryKey: ['record', id],
    initialData: () => {
      const cachedRecords = queryClient.getQueryData<RecordItem[]>(['records'])
      return cachedRecords?.find((r) => r.id === id)
    },
    queryFn: async () => {
      const user = await getAuthenticatedUser()
      if (!user) return null

      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('records')
          .select(`
            *,
            record_tags(
              tag:tags(*)
            )
          `)
          .eq('id', id)
          .eq('user_id', user.id)
          .single()

        if (error) {
          if (!navigator.onLine || error.message.includes('fetch')) throw error
          return null
        }
        return {
          ...data,
          tags: data.record_tags?.map((rt: any) => rt.tag).filter(Boolean) || [],
        }
      } catch (err) {
        if (!navigator.onLine) throw err
        return null
      }
    },
  })

  // Sync state once data loads
  useEffect(() => {
    if (record && !isLoaded) {
      setTitle(record.title)
      setThumbnailUrl(record.thumbnail_url || null)
      setContent(record.content)
      setSourceUrl(record.source_url || '')
      setTags(record.tags?.map((t) => t.name) || [])
      setIsLoaded(true)
    }
  }, [record, isLoaded])

  // Select local thumbnail preview without immediate upload
  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    setThumbnailUrl(localUrl)
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = ''
  }

  // Update Mutation (Uploads pending blob assets & purges removed assets)
  const updateMutation = useMutation({
    mutationFn: async () => {
      const user = await getAuthenticatedUser()
      if (!user) throw new Error('User not authenticated')

      const cleanUrl = sourceUrl.trim()
      const isYoutube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')
      const sourceType = isYoutube ? 'youtube' : cleanUrl ? 'article' : 'note'

      const updates = {
        title: title.trim(),
        thumbnail_url: thumbnailUrl,
        content: content || record?.content,
        source_url: cleanUrl || null,
        source_type: sourceType,
      }

      // Optimistic cache update
      queryClient.setQueryData(['record', id], (old: RecordItem | null | undefined) => {
        if (!old) return old
        return {
          ...old,
          ...updates,
          tags: tags.map((t) => ({ id: `temp_${t}`, user_id: user.id, name: t, created_at: new Date().toISOString() })),
        }
      })

      // If offline, queue mutation directly
      if (!navigator.onLine) {
        await enqueueMutation('UPDATE_RECORD', { recordId: id, updates, tags })
        return
      }

      try {
        // 1. Upload any pending local blob images (thumbnail & Tiptap images)
        const { finalThumbnailUrl, finalContent } = await processAndUploadPendingAssets({
          thumbnailUrl,
          content,
        })

        // 2. Clean up any assets that were removed from the original record
        if (record) {
          await cleanupRemovedAssets(record, {
            thumbnail_url: finalThumbnailUrl,
            content: finalContent,
          })
        }

        const supabase = createClient()
        // 3. Update record in database
        const { error: recordError } = await supabase
          .from('records')
          .update({
            title: title.trim(),
            thumbnail_url: finalThumbnailUrl,
            content: finalContent,
            source_url: cleanUrl || null,
            source_type: sourceType,
          })
          .eq('id', id)
          .eq('user_id', user.id)

        if (recordError) throw recordError

        // 4. Update tags
        await supabase.from('record_tags').delete().eq('record_id', id)

        if (tags.length > 0) {
          for (const tagName of tags) {
            const { data: tagData } = await supabase
              .from('tags')
              .upsert({ user_id: user.id, name: tagName }, { onConflict: 'user_id,name' })
              .select()
              .single()

            if (tagData) {
              await supabase.from('record_tags').insert({
                record_id: id,
                tag_id: tagData.id,
              })
            }
          }
        }
      } catch (err: any) {
        if (err?.name === 'TypeError' || String(err).includes('fetch') || !navigator.onLine) {
          await enqueueMutation('UPDATE_RECORD', { recordId: id, updates, tags })
          return
        }
        throw err
      }
    },
    onSuccess: async () => {
      if (navigator.onLine) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['record', id], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['records'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['tags'], refetchType: 'all' }),
        ])
      }
      router.push(`/records/${id}`)
      router.refresh()
    },
  })

  if (isPending || isLoading || !isLoaded) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <span className="mt-2 text-xs">Loading editor...</span>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link
            href={`/records/${id}`}
            className="flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel Editing
          </Link>

          <button
            type="button"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !title.trim()}
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-zinc-950 transition-all hover:bg-zinc-200 disabled:opacity-50 shadow-sm"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
            ) : (
              <>
                <Save className="h-4 w-4 stroke-[2.5]" />
                Update Record
              </>
            )}
          </button>
        </div>

        {/* Cover / Thumbnail Preview & Upload */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-zinc-400" />
              Cover / Thumbnail Image (Optional)
            </span>
            {thumbnailUrl && (
              <button
                type="button"
                onClick={() => setThumbnailUrl(null)}
                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Remove Cover
              </button>
            )}
          </div>

          {thumbnailUrl ? (
            <div className="relative h-48 w-full overflow-hidden rounded-xl border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt="Record Thumbnail"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => thumbnailInputRef.current?.click()}
                className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-4 py-2.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
              >
                <ImageIcon className="h-4 w-4 text-zinc-400" />
                Choose Thumbnail Image
              </button>
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleThumbnailSelect}
              />
              <span className="text-xs text-zinc-500">or</span>
              <input
                type="url"
                placeholder="Paste image URL directly..."
                onChange={(e) => setThumbnailUrl(e.target.value.trim() || null)}
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Record Title..."
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4 text-xl font-bold tracking-tight text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        {/* Metadata Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
          <div className="relative">
            <Link2 className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Source link / YouTube video (optional)..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-10 pr-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <TagInput selectedTags={tags} onChange={setTags} />
        </div>

        {/* Tiptap Editor */}
        <div>
          <TiptapEditor initialContent={record?.content} onChange={setContent} />
        </div>
      </div>
    </AppShell>
  )
}
