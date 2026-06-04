"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Team sign in for the single shared workspace. Members are provisioned in the
// Supabase dashboard (public sign-up disabled). Email + password, with a magic
// link fallback.
export default function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ text: string; warn?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.assign(next);
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Sign in failed", warn: true });
      setBusy(false);
    }
  }

  async function magicLink() {
    setBusy(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}${next}` },
      });
      if (error) throw error;
      setMsg({ text: "Check your email for a sign-in link." });
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Could not send link", warn: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header>
        <h1>AURIC IRON MATRIX</h1>
        <span className="tag">Team sign in</span>
      </header>
      <div className="wrap" style={{ maxWidth: 420 }}>
        <div className="note">
          Internal tool. Sign in with your team account. Accounts are provisioned
          by an administrator.
        </div>
        <form onSubmit={signIn}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="submit" disabled={busy}>
            {busy ? "Signing in" : "Sign in"}
          </button>{" "}
          <button
            type="button"
            className="ghost"
            onClick={magicLink}
            disabled={busy || !email}
          >
            Email me a link
          </button>
        </form>
        {msg && (
          <div className={msg.warn ? "warn" : "added"} style={{ marginTop: 14 }}>
            {msg.text}
          </div>
        )}
      </div>
    </>
  );
}
