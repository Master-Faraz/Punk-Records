'use client'

import { useState } from 'react'
import { X, Zap, Loader2, Link2, Sparkles } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { TagInput } from '@/components/tags/tag-input'

interface QuickCaptureModalProps {
  isOpen: boolean
  onClose: () => void
}

export function QuickCaptureModal({ isOpen, onClose }: QuickCaptureModalProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [tags, setTags] = useState<string[]>([])

  const createMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('User not authenticated')

      const cleanUrl = sourceUrl.trim()
      const isYoutube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')
      const sourceType = isYoutube ? 'youtube' : cleanUrl ? 'article' : 'note'

      const tiptapJson = {
        type: 'doc',
        content: content
          .split('\n\n')
          .filter(Boolean)
          .map((paragraph) => ({
            type: 'paragraph',
            content: [{ type: 'text', text: paragraph }],
          })),
      }

      // 1. Insert record
      const { data: record, error: recordError } = await supabase
        .from('records')
        .insert({
          user_id: user.id,
          title: title.trim(),
          content: tiptapJson.content.length > 0 ? tiptapJson : { type: 'doc', content: [{ type: 'paragraph' }] },
          source_url: cleanUrl || null,
          source_type: sourceType,
          next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single()

      if (recordError) throw recordError

      // 2. Insert tags
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['due-count'] })
      setTitle('')
      setContent('')
      setSourceUrl('')
      setTags([])
      onClose()
    },
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
            <Zap className="h-4 w-4 text-red-500 fill-red-500/20" />
            <span>Quick Capture</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            createMutation.mutate()
          }}
          className="mt-4 space-y-4"
        >
          <div>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Record Title or Main Takeaway..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm font-medium text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          <div>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste notes, summary, key highlights, or thoughts..."
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          <div className="relative">
            <Link2 className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Source link / YouTube video (optional)..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-3.5 py-2.5 text-xs text-zinc-300 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          <TagInput selectedTags={tags} onChange={setTags} />

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
            <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono">
              <Sparkles className="h-3 w-3 text-zinc-400" />
              Due in 1 day for review
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !title.trim()}
                className="flex items-center gap-2 rounded-xl bg-white px-5 py-2 text-xs font-bold text-zinc-950 transition-all hover:bg-zinc-200 disabled:opacity-50 shadow-sm"
              >
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-950" /> : 'Save Record'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
