'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_USER_SETTINGS, type UserSettings, type Tag } from '@/types/database'
import {
  Settings as SettingsIcon,
  Clock,
  Tag as TagIcon,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Save,
  Loader2,
  Sparkles,
  HelpCircle,
  Hash,
  User,
  LogOut,
  LogIn,
} from 'lucide-react'

import { getAuthenticatedUser } from '@/lib/offline/auth'
import { enqueueMutation } from '@/lib/offline/outbox'

export default function SettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Fetch logged in user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const user = await getAuthenticatedUser()
      return user
    },
  })

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  // --- 1. User Settings State ---
  const [stage1Days, setStage1Days] = useState(DEFAULT_USER_SETTINGS.stage_1_days)
  const [stage2Days, setStage2Days] = useState(DEFAULT_USER_SETTINGS.stage_2_days)
  const [stage3Days, setStage3Days] = useState(DEFAULT_USER_SETTINGS.stage_3_days)
  const [randomCooldown, setRandomCooldown] = useState(DEFAULT_USER_SETTINGS.random_cooldown_days)
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false)

  // --- 2. Tag Management State ---
  const [newTagName, setNewTagName] = useState('')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState('')

  // Fetch User Settings
  const { data: userSettings, isLoading: isLoadingSettings } = useQuery<UserSettings>({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const user = await getAuthenticatedUser()
      if (!user) return DEFAULT_USER_SETTINGS

      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error || !data) {
          const local = localStorage.getItem('punk_user_settings')
          if (local) return JSON.parse(local)
          return DEFAULT_USER_SETTINGS
        }
        return data
      } catch {
        const local = typeof localStorage !== 'undefined' ? localStorage.getItem('punk_user_settings') : null
        if (local) {
          try {
            return JSON.parse(local)
          } catch {}
        }
        return DEFAULT_USER_SETTINGS
      }
    },
  })

  // Sync settings when loaded
  useEffect(() => {
    if (userSettings) {
      setStage1Days(userSettings.stage_1_days)
      setStage2Days(userSettings.stage_2_days)
      setStage3Days(userSettings.stage_3_days)
      setRandomCooldown(userSettings.random_cooldown_days)
    }
  }, [userSettings])

  // Save Settings Mutation with Offline Support
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const user = await getAuthenticatedUser()

      const newSettings: UserSettings = {
        stage_1_days: Number(stage1Days) || 1,
        stage_2_days: Number(stage2Days) || 7,
        stage_3_days: Number(stage3Days) || 30,
        random_cooldown_days: Number(randomCooldown) || 7,
      }

      // Always save to localStorage immediately
      localStorage.setItem('punk_user_settings', JSON.stringify(newSettings))

      if (!navigator.onLine) {
        await enqueueMutation('UPDATE_SETTINGS', { settings: newSettings })
        return newSettings
      }

      if (user) {
        try {
          const supabase = createClient()
          await supabase.from('user_settings').upsert(
            {
              user_id: user.id,
              ...newSettings,
            },
            { onConflict: 'user_id' }
          )
        } catch (err: any) {
          if (err?.name === 'TypeError' || String(err).includes('fetch') || !navigator.onLine) {
            await enqueueMutation('UPDATE_SETTINGS', { settings: newSettings })
            return newSettings
          }
        }
      }

      return newSettings
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(['user-settings'], saved)
      setSettingsSavedMessage(true)
      setTimeout(() => setSettingsSavedMessage(false), 3000)
    },
  })

  // Fetch all tags with associated record count
  const { data: allTags = [], isLoading: isLoadingTags } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const user = await getAuthenticatedUser()
      if (!user) return []

      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('tags')
          .select(`
            *,
            record_tags(count)
          `)
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (error) return []

        return (data || []).map((t: any) => ({
          ...t,
          count: t.record_tags?.[0]?.count || 0,
        }))
      } catch {
        return []
      }
    },
  })

  // Create Tag Mutation
  const createTagMutation = useMutation({
    mutationFn: async (name: string) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-')
      if (!cleanName) return

      const { data, error } = await supabase
        .from('tags')
        .upsert({ user_id: user.id, name: cleanName }, { onConflict: 'user_id,name' })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['records'] })
      setNewTagName('')
    },
  })

  // Rename Tag Mutation
  const renameTagMutation = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      const supabase = createClient()
      const cleanName = newName.trim().toLowerCase().replace(/\s+/g, '-')
      if (!cleanName) return

      const { error } = await supabase
        .from('tags')
        .update({ name: cleanName })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['records'] })
      setEditingTagId(null)
      setEditingTagName('')
    },
  })

  // Delete Tag Mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('tags').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['records'] })
    },
  })

  return (
    <AppShell>
      <section className="flex flex-col gap-6 max-w-3xl mx-auto py-2">
        {/* Page Title */}
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-300 ring-1 ring-zinc-700/50 shadow-md">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Settings & Preferences
            </h1>
            <p className="text-xs text-zinc-400">
              Customize spaced repetition review intervals and manage your tag taxonomy
            </p>
          </div>
        </header>

        {/* 1. Review Interval Timings Section */}
        <article className="rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-5 sm:p-7 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-5">
            <div className="flex items-center gap-2 text-white font-semibold text-sm sm:text-base">
              <Clock className="h-4 w-4 text-zinc-400" />
              <span>Spaced Repetition Review Timings</span>
            </div>
            <span className="text-[11px] text-zinc-500 hidden sm:inline font-mono">
              Interval days for recall stages
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveSettingsMutation.mutate()
            }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
              {/* Stage 1 */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3.5 sm:p-4 flex flex-col justify-between hover:border-zinc-700/80 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-zinc-200">Stage 1 Interval</span>
                    <span className="rounded-full bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 text-[10px] text-zinc-300 font-mono">
                      First Recall
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">Days after initial capture before 1st review</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={stage1Days}
                    onChange={(e) => setStage1Days(Number(e.target.value))}
                    className="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-center text-xs sm:text-sm font-bold text-white focus:border-zinc-500 focus:outline-none font-mono"
                  />
                  <span className="text-xs text-zinc-400 font-medium">day(s)</span>
                </div>
              </div>

              {/* Stage 2 */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3.5 sm:p-4 flex flex-col justify-between hover:border-zinc-700/80 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-zinc-200">Stage 2 Interval</span>
                    <span className="rounded-full bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 text-[10px] text-zinc-300 font-mono">
                      Consolidation
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">Days added when remembered in Stage 1</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={stage2Days}
                    onChange={(e) => setStage2Days(Number(e.target.value))}
                    className="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-center text-xs sm:text-sm font-bold text-white focus:border-zinc-500 focus:outline-none font-mono"
                  />
                  <span className="text-xs text-zinc-400 font-medium">days</span>
                </div>
              </div>

              {/* Stage 3 */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3.5 sm:p-4 flex flex-col justify-between hover:border-zinc-700/80 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-zinc-200">Stage 3 Interval</span>
                    <span className="rounded-full bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 text-[10px] text-zinc-300 font-mono">
                      Mastery
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">Days added for long-term retention reviews</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="number"
                    min="7"
                    max="365"
                    value={stage3Days}
                    onChange={(e) => setStage3Days(Number(e.target.value))}
                    className="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-center text-xs sm:text-sm font-bold text-white focus:border-zinc-500 focus:outline-none font-mono"
                  />
                  <span className="text-xs text-zinc-400 font-medium">days</span>
                </div>
              </div>
            </div>

            {/* Random Recall Cooldown */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-zinc-200">Random Recall Cooldown Filter</span>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Prevents records reviewed within this period from appearing in Random Recall (unless all records have been viewed)
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={randomCooldown}
                  onChange={(e) => setRandomCooldown(Number(e.target.value))}
                  className="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-center text-xs sm:text-sm font-bold text-white focus:border-zinc-500 focus:outline-none font-mono"
                />
                <span className="text-xs text-zinc-400 font-medium">days</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-1">
              <div className="text-xs">
                {settingsSavedMessage && (
                  <span className="text-zinc-200 font-medium flex items-center gap-1.5 bg-zinc-800/80 border border-zinc-700/70 px-3 py-1 rounded-full text-xs animate-in fade-in duration-150">
                    <Check className="h-3.5 w-3.5 text-emerald-400 stroke-[2.5]" /> Timings saved successfully!
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={saveSettingsMutation.isPending}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 shadow-sm shadow-white/10 cursor-pointer"
              >
                {saveSettingsMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-950" />
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Save Review Timings</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </article>

        {/* 2. Tag Management Section */}
        <article className="rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-5 sm:p-7 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-5">
            <div className="flex items-center gap-2 text-white font-semibold text-sm sm:text-base">
              <TagIcon className="h-4 w-4 text-zinc-400" />
              <span>Tag Taxonomy & Filter Management</span>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">
              {allTags.length} {allTags.length === 1 ? 'tag' : 'tags'} registered
            </span>
          </div>

          {/* Add New Tag Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!newTagName.trim()) return
              createTagMutation.mutate(newTagName)
            }}
            className="flex items-center gap-2 mb-5"
          >
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Create new tag (e.g. system-design, machine-learning)..."
                className="w-full rounded-full border border-zinc-800 bg-zinc-950 pl-9 pr-4 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={createTagMutation.isPending || !newTagName.trim()}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 shadow-sm shadow-white/10 shrink-0 cursor-pointer"
            >
              {createTagMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-950" />
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Add Tag</span>
                </>
              )}
            </button>
          </form>

          {/* Tags List */}
          {isLoadingTags ? (
            <div className="flex items-center justify-center py-10 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              <span className="ml-2 text-xs font-mono text-zinc-400">Loading tags...</span>
            </div>
          ) : allTags.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800/80 rounded-2xl">
              No tags created yet. Add your first tag above to organize your knowledge vault!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {allTags.map((tag) => {
                const isEditing = editingTagId === tag.id
                return (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-2.5 sm:p-3 text-xs hover:border-zinc-700/80 transition-colors"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          autoFocus
                          value={editingTagName}
                          onChange={(e) => setEditingTagName(e.target.value)}
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editingTagName.trim()) {
                              renameTagMutation.mutate({ id: tag.id, newName: editingTagName })
                            }
                          }}
                          className="rounded p-1 text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                          title="Save Rename"
                        >
                          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTagId(null)}
                          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 cursor-pointer"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-zinc-200 truncate">#{tag.name}</span>
                          <span className="rounded-full bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 font-mono">
                            {tag.count || 0}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTagId(tag.id)
                              setEditingTagName(tag.name)
                            }}
                            className="rounded p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Rename Tag"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete tag #${tag.name}?`)) {
                                deleteTagMutation.mutate(tag.id)
                              }
                            }}
                            className="rounded p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete Tag"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </article>

        {/* 3. Account & Session Section */}
        <article className="rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-5 sm:p-7 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-5">
            <div className="flex items-center gap-2 text-white font-semibold text-sm sm:text-base">
              <User className="h-4 w-4 text-zinc-400" />
              <span>Account & Session</span>
            </div>
            <span className="text-[11px] text-zinc-500 hidden sm:inline font-mono">
              Active authentication session
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4">
            <div>
              <div className="text-xs font-semibold text-zinc-200">Connected Account</div>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                {currentUser?.email ?? 'Not signed in'}
              </p>
            </div>

            {currentUser ? (
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center justify-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <Link
                href="/auth/login"
                className="flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 active:scale-95 transition-all shadow-sm self-start sm:self-auto"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </article>
      </section>
    </AppShell>
  )
}
