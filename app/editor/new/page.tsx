'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/layout/app-shell'
import { TiptapEditor } from '@/components/editor/tiptap-editor'
import { TagInput } from '@/components/tags/tag-input'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SourceType } from '@/types/database'
import { ArrowLeft, Save, Loader2, Link2, Sparkles, Image as ImageIcon, X } from 'lucide-react'
import Link from 'next/link'

export default function NewRecordPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const thumbnailInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [isUploadingThumb, setIsUploadingThumb] = useState(false)
  const [content, setContent] = useState<any>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('note')
  const [tags, setTags] = useState<string[]>([])

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingThumb(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/thumb-${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('record-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (error) throw error

      const {
        data: { publicUrl },
      } = supabase.storage.from('record-images').getPublicUrl(data.path)

      setThumbnailUrl(publicUrl)
    } catch (err) {
      console.error('Thumbnail upload failed:', err)
      alert('Failed to upload thumbnail image.')
    } finally {
      setIsUploadingThumb(false)
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('User not authenticated')

      // 1. Insert record
      const { data: record, error: recordError } = await supabase
        .from('records')
        .insert({
          user_id: user.id,
          title: title.trim(),
          thumbnail_url: thumbnailUrl,
          content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
          source_url: sourceUrl.trim() || null,
          source_type: sourceType,
          next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single()

      if (recordError) throw recordError

      // 2. Handle tags if any
      if (tags.length > 0) {
        for (const tagName of tags) {
          const { data: tagData } = await supabase
            .from('tags')
            .upsert({ user_id: user.id, name: tagName }, { onConflict: 'user_id,name' })
            .select()
            .single()

          if (tagData) {
            await supabase.from('record_tags').insert({
              record_id: record.id,
              tag_id: tagData.id,
            })
          }
        }
      }

      return record
    },
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['due-count'] })
      router.push(`/records/${record.id}`)
    },
  })

  const handleAutoDetectSource = (url: string) => {
    setSourceUrl(url)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      setSourceType('youtube')
    } else if (url.startsWith('http')) {
      setSourceType('article')
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        {/* Navigation & Action Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Vault
          </Link>

          <button
            type="button"
            onClick={() => {
              if (!title.trim()) {
                alert('Please provide a record title.')
                return
              }
              saveMutation.mutate()
            }}
            disabled={saveMutation.isPending || !title.trim()}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-semibold text-zinc-950 transition-all hover:bg-amber-400 active:scale-95 disabled:opacity-50 shadow-sm"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Record
              </>
            )}
          </button>
        </div>

        {/* Optional Cover / Thumbnail Preview & Upload */}
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
            <div className="relative h-44 w-full overflow-hidden rounded-xl border border-zinc-800">
              <Image
                src={thumbnailUrl}
                alt="Record Thumbnail"
                fill
                sizes="(max-width: 768px) 100vw, 800px"
                className="object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => thumbnailInputRef.current?.click()}
                disabled={isUploadingThumb}
                className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-4 py-2.5 text-xs font-medium text-zinc-300 hover:border-amber-500 hover:text-amber-400 transition-colors"
              >
                {isUploadingThumb ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                Upload Thumbnail
              </button>
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleThumbnailUpload}
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

        {/* Title Input */}
        <div>
          <input
            type="text"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Record Title or Main Insight..."
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4 text-xl font-bold tracking-tight text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>

        {/* Metadata Controls (Source URL, Type, Tags) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => handleAutoDetectSource(e.target.value)}
                placeholder="Source link (optional)..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-10 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
              />
            </div>

            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as SourceType)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
            >
              <option value="note">Note</option>
              <option value="youtube">YouTube</option>
              <option value="article">Article</option>
              <option value="book">Book</option>
              <option value="other">Other</option>
            </select>
          </div>

          <TagInput selectedTags={tags} onChange={setTags} />
        </div>

        {/* Rich Tiptap Editor */}
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold">Content & Notes</span>
            <span className="flex items-center gap-1 text-[11px] text-amber-400/80">
              <Sparkles className="h-3 w-3" /> Spaced repetition schedule starts automatically
            </span>
          </div>
          <TiptapEditor onChange={setContent} />
        </div>
      </div>
    </AppShell>
  )
}
