'use client'

import { useState } from 'react'
import { X, Zap, Loader2, Link2, Sparkles } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SourceType } from '@/types/database'

interface QuickCaptureModalProps {
  isOpen: boolean
  onClose: () => void
}

export function QuickCaptureModal({ isOpen, onClose }: QuickCaptureModalProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('note')

  const createMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('User not authenticated')

      // Convert simple text into Tiptap JSON document structure
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

      const { data, error } = await supabase
        .from('records')
        .insert({
          user_id: user.id,
          title: title.trim(),
          content: tiptapJson.content.length > 0 ? tiptapJson : { type: 'doc', content: [{ type: 'paragraph' }] },
          source_url: sourceUrl.trim() || null,
          source_type: sourceType,
          next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['due-count'] })
      setTitle('')
      setContent('')
      setSourceUrl('')
      setSourceType('note')
      onClose()
    },
  })

  if (!isOpen) return null

  const handleAutoDetectSource = (url: string) => {
    setSourceUrl(url)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      setSourceType('youtube')
    } else if (url.startsWith('http')) {
      setSourceType('article')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
            <Zap className="h-4 w-4" />
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
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm font-medium text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </div>

          <div>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste notes, summary, key highlights, or thoughts..."
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => handleAutoDetectSource(e.target.value)}
                placeholder="Source link (YouTube, article...)"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-3.5 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </div>

            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as SourceType)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            >
              <option value="note">Note</option>
              <option value="youtube">YouTube</option>
              <option value="article">Article</option>
              <option value="book">Book</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500/70" />
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
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-xs font-semibold text-zinc-950 transition-all hover:bg-amber-400 disabled:opacity-50"
              >
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Record'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
