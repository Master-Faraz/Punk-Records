'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getAuthenticatedUser } from '@/lib/offline/auth'
import type { Goal, GoalLink } from '@/types/database'
import {
  ListTodo,
  Plus,
  Check,
  Calendar,
  ExternalLink,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  Clock,
  AlertCircle,
  Link2,
} from 'lucide-react'

export default function GoalsPage() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [showFinished, setShowFinished] = useState(true)

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [links, setLinks] = useState<GoalLink[]>([])
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newLinkTitle, setNewLinkTitle] = useState('')

  // Reset form
  const resetForm = () => {
    setTitle('')
    setDescription('')
    setDeadlineDate('')
    setLinks([])
    setNewLinkUrl('')
    setNewLinkTitle('')
    setEditingGoal(null)
  }

  // Open modal for edit
  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal)
    setTitle(goal.title)
    setDescription(goal.description || '')
    setDeadlineDate(goal.deadline_date ? goal.deadline_date.slice(0, 10) : '')
    setLinks(Array.isArray(goal.links) ? goal.links : [])
    setIsModalOpen(true)
  }

  // Add a link reference to form
  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return
    let formattedUrl = newLinkUrl.trim()
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`
    }
    setLinks((prev) => [
      ...prev,
      { url: formattedUrl, title: newLinkTitle.trim() || undefined },
    ])
    setNewLinkUrl('')
    setNewLinkTitle('')
  }

  const handleRemoveLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index))
  }

  // Query: Fetch user goals
  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: async () => {
      const user = await getAuthenticatedUser()
      if (!user) return []

      const supabase = createClient()
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) return []
      return (data || []).map((g: any) => ({
        ...g,
        links: Array.isArray(g.links) ? g.links : [],
      }))
    },
  })

  // Mutation: Save / Update Goal
  const saveGoalMutation = useMutation({
    mutationFn: async () => {
      const user = await getAuthenticatedUser()
      if (!user) throw new Error('User not authenticated')

      const supabase = createClient()
      const payload = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        links,
        deadline_date: deadlineDate || null,
      }

      if (editingGoal) {
        const { data, error } = await supabase
          .from('goals')
          .update(payload)
          .eq('id', editingGoal.id)
          .select()
          .single()
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('goals')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        return data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setIsModalOpen(false)
      resetForm()
    },
  })

  // Mutation: Toggle Goal Completion
  const toggleGoalMutation = useMutation({
    mutationFn: async ({ goal, isCompleted }: { goal: Goal; isCompleted: boolean }) => {
      const supabase = createClient()
      const completedAt = isCompleted ? new Date().toISOString() : null
      const { error } = await supabase
        .from('goals')
        .update({ is_completed: isCompleted, completed_at: completedAt })
        .eq('id', goal.id)

      if (error) throw error
    },
    onMutate: async ({ goal, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey: ['goals'] })
      const previousGoals = queryClient.getQueryData<Goal[]>(['goals'])

      queryClient.setQueryData<Goal[]>(['goals'], (old = []) =>
        old.map((g) =>
          g.id === goal.id
            ? {
                ...g,
                is_completed: isCompleted,
                completed_at: isCompleted ? new Date().toISOString() : null,
              }
            : g
        )
      )

      return { previousGoals }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(['goals'], context.previousGoals)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  // Mutation: Delete Goal
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['goals'] })
      const previousGoals = queryClient.getQueryData<Goal[]>(['goals'])
      queryClient.setQueryData<Goal[]>(['goals'], (old = []) => old.filter((g) => g.id !== id))
      return { previousGoals }
    },
    onError: (_err, _id, context) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(['goals'], context.previousGoals)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  // Categorize Active vs. Finished
  const activeGoals = goals.filter((g) => !g.is_completed)
  const finishedGoals = goals.filter((g) => g.is_completed)
  const totalCount = goals.length
  const finishedCount = finishedGoals.length
  const progressPercent = totalCount > 0 ? Math.round((finishedCount / totalCount) * 100) : 0

  // Format Deadline with status
  const getDeadlineStatus = (deadlineStr?: string | null) => {
    if (!deadlineStr) return null
    const deadline = new Date(deadlineStr)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    deadline.setHours(0, 0, 0, 0)

    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return {
        label: `Overdue by ${Math.abs(diffDays)}d`,
        style: 'border-red-500/30 bg-red-500/10 text-red-400',
        icon: AlertCircle,
      }
    } else if (diffDays === 0) {
      return {
        label: 'Due today',
        style: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
        icon: Clock,
      }
    } else if (diffDays === 1) {
      return {
        label: 'Due tomorrow',
        style: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
        icon: Clock,
      }
    } else {
      return {
        label: `Due in ${diffDays}d`,
        style: 'border-zinc-800 bg-zinc-900 text-zinc-400',
        icon: Calendar,
      }
    }
  }

  return (
    <AppShell>
      <section className="flex flex-col gap-6 max-w-3xl mx-auto py-2">
        {/* Header with Title & Add Goal Button */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-300 ring-1 ring-zinc-700/50 shadow-md">
              <ListTodo className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Learning Goals & Tasks</span>
              </h1>
              <p className="text-xs text-zinc-400">
                Track milestones, deadlines, and reference links to smooth your learning roadmap
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
            <span>Add Goal</span>
          </button>
        </header>

        {/* Progress Overview Bar */}
        {totalCount > 0 && (
          <article className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <span>Roadmap Progress</span>
                <span className="rounded-full bg-zinc-800 border border-zinc-700/60 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                  {finishedCount} / {totalCount} done
                </span>
              </span>
              <span className="font-mono text-zinc-400 text-[11px]">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-950 border border-zinc-800/80">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </article>
        )}

        {/* Modal / Dialog for New / Edit Goal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
            <div
              className="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-red-400" />
                  <span>{editingGoal ? 'Edit Goal' : 'New Learning Goal'}</span>
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
                  if (!title.trim()) return
                  saveGoalMutation.mutate()
                }}
                className="flex flex-col gap-4"
              >
                {/* Title */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1.5">
                    Goal Title *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Master React Server Components & Suspense"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1.5">
                    Description & Plan
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Key milestones, books to finish, or specific modules to build..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Deadline Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1.5">
                    Target Deadline
                  </label>
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-100 focus:border-zinc-500 focus:outline-none font-mono"
                  />
                </div>

                {/* Reference Links */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1.5">
                    References & Links
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newLinkTitle}
                      onChange={(e) => setNewLinkTitle(e.target.value)}
                      placeholder="Label (optional)"
                      className="w-1/3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddLink}
                      className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  {links.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {links.map((l, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 pl-2.5 pr-1.5 py-1 text-[11px] text-zinc-300 font-mono"
                        >
                          <Link2 className="h-3 w-3 text-zinc-500" />
                          <span className="truncate max-w-[150px]">{l.title || l.url}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveLink(i)}
                            className="rounded-full p-0.5 text-zinc-500 hover:text-red-400"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveGoalMutation.isPending || !title.trim()}
                    className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                  >
                    {saveGoalMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span>{editingGoal ? 'Save Changes' : 'Create Goal'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            <span className="mt-2 text-xs font-mono text-zinc-400">Loading goals...</span>
          </div>
        ) : (
          <>
            {/* Active Goals Section */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
                  Active Goals ({activeGoals.length})
                </span>
              </div>

              {activeGoals.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-900/30 p-10 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-500 mb-2">
                    <ListTodo className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-300">No active goals</h3>
                  <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                    Plan your next learning target or milestone with deadline dates and reference links.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {activeGoals.map((goal) => {
                    const deadlineInfo = getDeadlineStatus(goal.deadline_date)
                    const DeadlineIcon = deadlineInfo?.icon

                    return (
                      <article
                        key={goal.id}
                        className="group flex flex-col gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700/90 hover:bg-zinc-900/80 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* Checkbox & Title */}
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => toggleGoalMutation.mutate({ goal, isCompleted: true })}
                              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950 text-transparent transition-all hover:border-emerald-500 hover:text-emerald-400 cursor-pointer"
                              title="Mark as completed"
                            >
                              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                            </button>

                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-semibold text-white leading-snug break-words">
                                {goal.title}
                              </h3>
                              {goal.description && (
                                <p className="mt-1 text-xs text-zinc-400 leading-relaxed break-words whitespace-pre-line">
                                  {goal.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleEdit(goal)}
                              className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                              title="Edit goal"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete goal "${goal.title}"?`)) {
                                  deleteGoalMutation.mutate(goal.id)
                                }
                              }}
                              className="rounded-lg p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete goal"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Metadata: Deadlines & Link References */}
                        {(deadlineInfo || (goal.links && goal.links.length > 0)) && (
                          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-800/60 text-[11px]">
                            {deadlineInfo && DeadlineIcon && (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium ${deadlineInfo.style}`}
                              >
                                <DeadlineIcon className="h-3 w-3" />
                                <span>{deadlineInfo.label}</span>
                              </span>
                            )}

                            {goal.links &&
                              goal.links.map((link, idx) => (
                                <a
                                  key={idx}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-0.5 text-[10px] text-zinc-300 font-mono hover:text-white hover:border-zinc-700 transition-colors truncate max-w-[200px]"
                                >
                                  <ExternalLink className="h-3 w-3 shrink-0 text-zinc-500" />
                                  <span className="truncate">{link.title || link.url}</span>
                                </a>
                              ))}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Finished Tasks Section */}
            {finishedGoals.length > 0 && (
              <section className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFinished((prev) => !prev)}
                  className="flex items-center justify-between px-1 py-1 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 font-mono transition-colors cursor-pointer"
                >
                  <span>Finished Tasks ({finishedGoals.length})</span>
                  {showFinished ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {showFinished && (
                  <div className="flex flex-col gap-2">
                    {finishedGoals.map((goal) => (
                      <article
                        key={goal.id}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-3.5 opacity-65 hover:opacity-100 transition-all"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => toggleGoalMutation.mutate({ goal, isCompleted: false })}
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 transition-all hover:bg-emerald-500/30 cursor-pointer"
                            title="Re-open task"
                          >
                            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                          </button>

                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-medium text-zinc-400 line-through">
                              {goal.title}
                            </span>
                            {goal.completed_at && (
                              <span className="block text-[10px] text-zinc-600 font-mono mt-0.5">
                                Finished {new Date(goal.completed_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete finished task "${goal.title}"?`)) {
                              deleteGoalMutation.mutate(goal.id)
                            }
                          }}
                          className="rounded-lg p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </section>
    </AppShell>
  )
}
