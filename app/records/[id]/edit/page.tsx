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

  // Fetch current record
  const { data: record, isLoading } = useQuery<RecordItem | null>({
    queryKey: ['record', id],
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null

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

      if (error) throw error
      return {
        ...data,
        tags: data.record_tags?.map((rt: any) => rt.tag).filter(Boolean) || [],
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
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

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

      const cleanUrl = sourceUrl.trim()
      const isYoutube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')
      const sourceType = isYoutube ? 'youtube' : cleanUrl ? 'article' : 'note'

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
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['record', id], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['records'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['tags'], refetchType: 'all' }),
      ])
      router.push(`/records/${id}`)
      router.refresh()
    },
  })

  if (isLoading || !isLoaded) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
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
            className="flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel Editing
          </Link>

          <button
            type="button"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !title.trim()}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-semibold text-zinc-950 transition-all hover:bg-amber-400 disabled:opacity-50 shadow-sm"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Update Record
              </>
            )}
          </button>
        </div>

        {/* Cover / Thumbnail Preview & Upload */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-amber-400" />
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
                className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-4 py-2.5 text-xs font-medium text-zinc-300 hover:border-amber-500 hover:text-amber-400 transition-colors"
              >
                <ImageIcon className="h-4 w-4" />
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
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
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
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4 text-xl font-bold tracking-tight text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
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
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-10 pr-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
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
