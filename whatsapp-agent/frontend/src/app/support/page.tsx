"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { api, ApiError } from "@/lib/apiClient";

const SUPPORT_EMAIL = "ghk7125@gmail.com";
const CATEGORIES = [
  { value: "general", label: "General question" },
  { value: "complaint", label: "Complaint" },
  { value: "bug", label: "Report a bug" },
  { value: "billing", label: "Billing" },
];

export default function SupportPage() {
  const [category, setCategory] = useState("general");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/support/complaint", { category, name, email, message });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your message — please email us directly.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/">
            <Logo size={32} />
          </Link>
          <Link href="/" className="text-sm text-ink-400 hover:text-ink-700">
            Back home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold text-ink-800">Customer care & complaints</h1>
        <p className="mt-2 text-ink-500">
          Reach us directly at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-600 hover:underline">
            {SUPPORT_EMAIL}
          </a>
          , or use the complaint box below — every message here goes straight to that same inbox and we'll reply
          by email.
        </p>

        <div className="mt-8 card p-8">
          {submitted ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl">✓</div>
              <h2 className="text-lg font-semibold text-ink-800">Message received</h2>
              <p className="mt-1 text-sm text-ink-500">
                We've sent a copy to our support team and a confirmation to your email. We'll get back to you soon.
              </p>
              <button className="btn-secondary mt-6" onClick={() => setSubmitted(false)}>
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label">What's this about?</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c.value}
                      onClick={() => setCategory(c.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        category === c.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500 hover:bg-ink-50"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Your name</label>
                  <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Your email</label>
                  <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Message</label>
                <textarea
                  className="input min-h-[140px] resize-y"
                  required
                  minLength={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's going on..."
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Sending..." : "Send message"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
