'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg(null)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setErrorMsg(error.message)
      setIsLoading(false)
      return
    }

    if (data.session) {
      // Auto-logged in (email confirmation disabled in Supabase)
      router.push('/')
      router.refresh()
    } else {
      // Email confirmation sent
      setIsSuccess(true)
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="w-full rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-xl text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-100 ring-1 ring-zinc-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100">Check your email</h2>
        <p className="mt-2 text-sm text-zinc-400">
          We&apos;ve sent a confirmation link to <span className="font-semibold text-zinc-200">{email}</span>. Click the link to complete your signup.
        </p>
        <div className="mt-6">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-300 hover:text-white underline underline-offset-4"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-xl">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden bg-zinc-900 shadow-xl ring-1 ring-zinc-800">
          <Image
            src="/images/punk-records-logo.png"
            alt="Punk Records Logo"
            width={64}
            height={64}
            className="h-full w-full object-cover"
            priority
          />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Create Account</h1>
        <p className="mt-1 text-sm text-zinc-400">Start storing and retaining what you learn</p>
      </div>

      {errorMsg && (
        <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5" htmlFor="password">
            Password (min. 6 characters)
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-zinc-950 transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50 shadow-sm"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
          ) : (
            <>
              Sign Up
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-zinc-500">
        Already have an account?{' '}
        <Link href="/auth/login" className="font-medium text-zinc-300 hover:text-white underline underline-offset-4">
          Sign in
        </Link>
      </div>
    </div>
  )
}
