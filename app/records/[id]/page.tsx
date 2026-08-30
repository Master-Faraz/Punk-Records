'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/layout/app-shell'
import { TiptapRenderer } from '@/components/editor/tiptap-renderer'
import { YouTubeEmbed, getYouTubeVideoId } from '@/components/media/youtube-embed'
import { deleteRecordWithAssets } from '@/lib/supabase/cleanup'
import { getUserSettings, computeNextReview } from '@/lib/settings'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { RecordItem } from '@/types/database'
import {
  ArrowLeft,
  Edit3,
  Trash2,
  ExternalLink,
  Eye,
  Calendar,
  Sparkles,
  Loader2,
  Check,
  RotateCcw,
  Tag as TagIcon,
  Clock,
} from 'lucide-react'
import Link from 'next/link'

export default function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()

  // Fetch record
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

  // Increment read_count once on mount
  useEffect(() => {
    if (!record) return
    const incrementRead = async () => {
      const supabase = createClient()
      await supabase
        .from('records')
        .update({ read_count: (record.read_count || 0) + 1 })
        .eq('id', record.id)
    }
    incrementRead()
  }, [id, record])

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async (result: 'remembered' | 'forgot') => {
      if (!record) return
      const supabase = createClient()
      const currentStage = record.review_stage || 0

      const settings = await getUserSettings()
      const { nextStage, nextReviewAt } = computeNextReview(currentStage, result, settings)
      const nowIso = new Date().toISOString()

      // 1. Record review history
      await supabase.from('reviews').insert({
        record_id: record.id,
        user_id: record.user_id,
        scheduled_for: record.next_review_at,
        reviewed_at: nowIso,
        result,
        previous_stage: currentStage,
        next_stage: nextStage,
      })

      // 2. Update record
      const { error } = await supabase
        .from('records')
        .update({
          review_stage: nextStage,
          last_reviewed_at: nowIso,
          next_review_at: nextReviewAt,
        })
        .eq('id', record.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record', id] })
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['due-count'] })
    },
  })

  // Delete mutation with storage asset cleanup
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!record) return
      await deleteRecordWithAssets(record)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['due-count'] })
      router.push('/')
    },
  })

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <span className="mt-2 text-xs">Loading record...</span>
        </div>
      </AppShell>
    )
  }

  if (!record) {
    return (
      <AppShell>
        <div className="text-center py-20">
          <h2 className="text-lg font-bold text-zinc-200">Record not found</h2>
          <Link href="/" className="mt-4 inline-block text-xs font-semibold text-zinc-300 hover:text-white underline underline-offset-4">
            Return to Vault
          </Link>
        </div>
      </AppShell>
    )
  }

  const isDue = new Date(record.next_review_at) <= new Date()
  const isYoutube = !!getYouTubeVideoId(record.source_url)

  // Estimated reading time calculation (handles Tiptap JSON or string)
  let textOnly = ''
  if (typeof record.content === 'string') {
    textOnly = record.content.replace(/<[^>]*>/g, '').trim()
  } else if (record.content && typeof record.content === 'object') {
    const texts: string[] = []
    const traverse = (node: any) => {
      if (!node) return
      if (node.text) texts.push(node.text)
      if (Array.isArray(node.content)) {
        node.content.forEach(traverse)
      }
    }
    traverse(record.content)
    textOnly = texts.join(' ').trim()
  }

  const wordCount = textOnly ? textOnly.split(/\s+/).filter(Boolean).length : 0
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 180))

  const formattedDate = new Date(record.created_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto py-2">
        {/* Navigation Bar & Header Badges (Dreilokale Style) */}
        <nav aria-label="Breadcrumb and Actions" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-zinc-300 hover:text-white transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-0.5" />
            Back to Vault
          </Link>

          {/* Right Action & Info Badges */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {record.tags && record.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {record.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 shadow-sm text-xs font-semibold text-zinc-200"
                  >
                    <TagIcon className="h-3 w-3 text-zinc-400" />
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 shadow-sm text-xs font-medium text-zinc-400 font-mono">
              <Calendar className="h-3.5 w-3.5 text-zinc-400" />
              {formattedDate}
            </span>

            {/* Edit / Delete Buttons */}
            <div className="inline-flex items-center gap-1.5 pl-1">
              <Link
                href={`/records/${record.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
              >
                <Edit3 className="h-3 w-3" />
                Edit
              </Link>

              <button
                onClick={() => {
                  if (confirm('Delete this record permanently? This will also remove any uploaded images.')) {
                    deleteMutation.mutate()
                  }
                }}
                className="inline-flex items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/90 p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors"
                title="Delete Record"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </nav>

        {/* Main Editorial Container */}
        <article className="rounded-3xl border border-zinc-800/80 bg-zinc-900/50 shadow-2xl p-6 sm:p-10 lg:p-12 backdrop-blur-sm">
          {/* Main H1 Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-50 leading-tight mb-8">
            {record.title}
          </h1>

          {/* Featured Cover Image (Dreilokale Banner Style) */}
          {record.thumbnail_url && (
            <div className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-2xl mb-8 border border-zinc-800/90">
              <Image
                src={record.thumbnail_url}
                alt={record.title}
                fill
                sizes="(max-width: 1024px) 100vw, 960px"
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Article / Note Body */}
          <div className="mt-2 min-h-[120px]">
            <TiptapRenderer content={record.content} />
          </div>

          {/* Attached YouTube Video at Bottom */}
          {isYoutube && record.source_url && (
            <section aria-label="Attached Video" className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 sm:p-6 overflow-hidden">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Attached Video
                </span>
                <a
                  href={record.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white underline underline-offset-2 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open in YouTube</span>
                </a>
              </div>
              <YouTubeEmbed url={record.source_url} title={record.title} />
            </section>
          )}

          {/* Footer Metadata & Reading Stats */}
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800/80 pt-6 text-sm text-zinc-400">
            <div className="flex items-center gap-4 flex-wrap text-xs sm:text-sm">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-zinc-400" />
                Estimated reading time: ~{readingTimeMinutes} min
              </span>

              <span className="flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-zinc-500" />
                {record.read_count} reads
              </span>

              <span className="flex items-center gap-1.5 font-mono">
                <Sparkles className="h-4 w-4 text-zinc-400" />
                Stage {record.review_stage}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Calendar className="h-4 w-4 text-zinc-400" />
              <span>Next review:</span>
              <strong className={isDue ? 'text-white font-bold' : 'text-zinc-300'}>
                {new Date(record.next_review_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </strong>
            </div>
          </footer>

          {/* Direct Review Trigger if Due */}
          {isDue && (
            <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
              <div>
                <span className="text-xs font-semibold text-zinc-100 block">
                  This record is due for spaced review today!
                </span>
                <span className="text-[11px] text-zinc-400">
                  Rate your recall to advance to the next spaced stage.
                </span>
              </div>

              <div className="flex gap-2 self-end sm:self-auto">
                <button
                  onClick={() => reviewMutation.mutate('forgot')}
                  disabled={reviewMutation.isPending}
                  className="flex items-center gap-1 rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs font-semibold text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Forgot
                </button>
                <button
                  onClick={() => reviewMutation.mutate('remembered')}
                  disabled={reviewMutation.isPending}
                  className="flex items-center gap-1 rounded-xl bg-white px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-zinc-200 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                  Remembered
                </button>
              </div>
            </div>
          )}
        </article>
      </div>
    </AppShell>
  )
}
