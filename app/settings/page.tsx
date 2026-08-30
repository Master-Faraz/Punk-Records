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

export default function SettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Fetch logged in user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return DEFAULT_USER_SETTINGS

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error || !data) {
          // Check localStorage fallback
          const local = localStorage.getItem('punk_user_settings')
          if (local) return JSON.parse(local)
          return DEFAULT_USER_SETTINGS
        }
        return data
      } catch {
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

  // Save Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const newSettings: UserSettings = {
        stage_1_days: Number(stage1Days) || 1,
        stage_2_days: Number(stage2Days) || 7,
        stage_3_days: Number(stage3Days) || 30,
        random_cooldown_days: Number(randomCooldown) || 7,
      }

      // Always save to localStorage immediately
      localStorage.setItem('punk_user_settings', JSON.stringify(newSettings))

      if (user) {
        try {
          await supabase.from('user_settings').upsert({
            user_id: user.id,
            ...newSettings,
            updated_at: new Date().toISOString(),
          })
        } catch (err) {
          console.warn('Database settings upsert error (using local storage):', err)
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
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('tags')
        .select(`
          *,
          record_tags(count)
        `)
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (error) throw error

      return (data || []).map((t: any) => ({
        ...t,
        count: t.record_tags?.[0]?.count || 0,
      }))
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
      <div className="flex flex-col gap-8 max-w-4xl mx-auto">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-amber-500" />
            Settings & Preferences
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Customize spaced repetition review intervals and manage your tag taxonomy
          </p>
        </div>

        {/* 1. Review Interval Timings Section */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
            <div className="flex items-center gap-2 text-zinc-100 font-semibold text-base">
              <Clock className="h-5 w-5 text-amber-400" />
              <span>Spaced Repetition Review Timings</span>
            </div>
            <span className="text-[11px] text-zinc-400 hidden sm:inline">
              Adjust interval days for each recall stage
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveSettingsMutation.mutate()
            }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Stage 1 */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-amber-400">Stage 1 Interval</span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 font-medium">
                      First Recall
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Days after initial capture before 1st review</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={stage1Days}
                    onChange={(e) => setStage1Days(Number(e.target.value))}
                    className="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-center text-sm font-bold text-zinc-100 focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-xs text-zinc-400 font-medium">day(s)</span>
                </div>
              </div>

              {/* Stage 2 */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-amber-400">Stage 2 Interval</span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 font-medium">
                      Consolidation
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Days added when remembered in Stage 1</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={stage2Days}
                    onChange={(e) => setStage2Days(Number(e.target.value))}
                    className="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-center text-sm font-bold text-zinc-100 focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-xs text-zinc-400 font-medium">days</span>
                </div>
              </div>

              {/* Stage 3 */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-amber-400">Stage 3 Interval</span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 font-medium">
                      Mastery
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Days added for long-term retention reviews</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="number"
                    min="7"
                    max="365"
                    value={stage3Days}
                    onChange={(e) => setStage3Days(Number(e.target.value))}
                    className="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-center text-sm font-bold text-zinc-100 focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-xs text-zinc-400 font-medium">days</span>
                </div>
              </div>
            </div>

            {/* Random Recall Cooldown */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-zinc-200">Random Recall Cooldown Filter</span>
                <p className="text-[11px] text-zinc-400">
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
                  className="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-center text-sm font-bold text-zinc-100 focus:border-amber-500 focus:outline-none"
                />
                <span className="text-xs text-zinc-400 font-medium">days</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs">
                {settingsSavedMessage && (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="h-4 w-4" /> Timings saved successfully!
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={saveSettingsMutation.isPending}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-semibold text-zinc-950 transition-all hover:bg-amber-400 active:scale-95 disabled:opacity-50 shadow-sm"
              >
                {saveSettingsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Review Timings
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 2. Tag Management Section */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
            <div className="flex items-center gap-2 text-zinc-100 font-semibold text-base">
              <TagIcon className="h-5 w-5 text-amber-400" />
              <span>Tag Taxonomy & Filter Management</span>
            </div>
            <span className="text-[11px] text-zinc-400">
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
            className="flex items-center gap-2 mb-6"
          >
            <div className="relative flex-1">
              <Hash className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Create new tag (e.g. system-design, machine-learning, book-notes)..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-10 pr-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={createTagMutation.isPending || !newTagName.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-amber-500 hover:text-zinc-950 transition-colors disabled:opacity-50"
            >
              {createTagMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Tag
                </>
              )}
            </button>
          </form>

          {/* Tags List */}
          {isLoadingTags ? (
            <div className="flex items-center justify-center py-10 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              <span className="ml-2 text-xs">Loading tags...</span>
            </div>
          ) : allTags.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800/80 rounded-xl">
              No tags created yet. Add your first tag above to organize your knowledge vault!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {allTags.map((tag) => {
                const isEditing = editingTagId === tag.id
                return (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          autoFocus
                          value={editingTagName}
                          onChange={(e) => setEditingTagName(e.target.value)}
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editingTagName.trim()) {
                              renameTagMutation.mutate({ id: tag.id, newName: editingTagName })
                            }
                          }}
                          className="rounded p-1 text-emerald-400 hover:bg-emerald-500/20"
                          title="Save Rename"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTagId(null)}
                          className="rounded p-1 text-zinc-500 hover:bg-zinc-800"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-amber-400 truncate">#{tag.name}</span>
                          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-500 font-mono">
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
                            className="rounded p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
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
                            className="rounded p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
        </div>

        {/* 3. Account & Session Section */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
            <div className="flex items-center gap-2 text-zinc-100 font-semibold text-base">
              <User className="h-5 w-5 text-amber-400" />
              <span>Account & Session</span>
            </div>
            <span className="text-[11px] text-zinc-400">
              Manage your active authentication session
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div>
              <div className="text-xs font-semibold text-zinc-200">Connected Account</div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {currentUser?.email ?? 'Not signed in'}
              </p>
            </div>

            {currentUser ? (
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors active:scale-95"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            ) : (
              <Link
                href="/auth/login"
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors active:scale-95"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
