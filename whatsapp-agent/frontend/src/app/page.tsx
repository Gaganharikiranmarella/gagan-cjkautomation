import Link from "next/link";
import { Logo } from "@/components/Logo";
import { HowItWorks } from "@/components/HowItWorks";

const FEATURES = [
  {
    title: "Connect in one click",
    body: "Paste your WhatsApp Business credentials or run Meta's one-click signup — your number is live in minutes, no code, no waiting on approvals.",
  },
  {
    title: "Claude-qualified conversations",
    body: "Every inbound chat is understood, answered, and scored automatically in the customer's own language — Hindi, English, and Hinglish out of the box.",
  },
  {
    title: "A dashboard built for closing",
    body: "Filter, bulk-tag, export, and work your pipeline from one list — every score comes with a transparent breakdown of why.",
  },
  {
    title: "CSV + manual intake",
    body: "Import a spreadsheet from an event or a purchased list, and Claude suggests the column mapping for you.",
  },
  {
    title: "Campaigns & follow-ups",
    body: "Broadcast approved templates to a segment, or arm re-engagement rules that fire automatically off lead status.",
  },
  {
    title: "Enterprise-grade isolation",
    body: "Every tenant's data is isolated at the database layer with row-level security — not just application-level filtering.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-800 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo light withText size={34} />
        <nav className="flex items-center gap-3">
          <Link href="#working" className="hidden text-sm text-ink-200 hover:text-white sm:inline">
            How it works
          </Link>
          <Link href="/support" className="text-sm text-ink-200 hover:text-white">
            Support
          </Link>
          <Link href="/login" className="text-sm text-ink-200 hover:text-white">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
        <span className="badge bg-brand-500/15 text-brand-300">Built on Claude</span>
        <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">
          Turn WhatsApp replies into <span className="text-brand-400">qualified pipeline</span>, automatically.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-200">
          Connect your WhatsApp Business number, and an AI agent qualifies every inbound conversation, scores the
          lead in real time, and hands your sales team a ready-to-work dashboard.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            Connect your WhatsApp business
          </Link>
          <Link href="/login" className="btn-secondary border-white/20 bg-transparent px-6 py-3 text-base text-white hover:bg-white/5">
            I already have an account
          </Link>
        </div>
      </section>

      <HowItWorks />

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-ink-300">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-ink-400 sm:flex-row">
          <span>© CJK Technologies — WhatsApp Lead Agent</span>
          <Link href="/support" className="hover:text-white">
            Customer care & complaints
          </Link>
        </div>
      </footer>
    </div>
  );
}
