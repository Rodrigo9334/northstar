"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Compass } from "lucide-react";
import { useState } from "react";

type AuthPanelProps = {
  supabase: SupabaseClient;
};

export function AuthPanel({ supabase }: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin
      }
    });

    setIsSending(false);
    setMessage(error ? error.message : "Check your email for the sign-in link.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-md border border-white/10 bg-panel/90 p-6 shadow-glow">
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-mint text-ink">
          <Compass size={22} />
        </span>
        <h1 className="mt-6 text-3xl font-semibold">Sign in to NorthStar</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Use your Supabase account to load your private accounts, budgets, transactions, and goals.
        </p>
        <form className="mt-6 space-y-4" onSubmit={signIn}>
          <label className="block text-sm font-medium text-slate-300" htmlFor="email">
            Email
          </label>
          <input
            className="min-h-12 w-full rounded-md border border-white/10 bg-ink/80 px-4 text-white outline-none transition focus:border-mint/70"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
          <button
            className="min-h-12 w-full rounded-md bg-mint px-4 font-semibold text-ink transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSending}
            type="submit"
          >
            {isSending ? "Sending..." : "Send sign-in link"}
          </button>
        </form>
        {message ? <p className="mt-4 text-sm text-slate-300">{message}</p> : null}
      </section>
    </main>
  );
}
