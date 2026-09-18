"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    label: "Connect",
    title: "Connect your WhatsApp Business number",
    body: "Paste the credentials Meta gives you instantly, or use one-click signup. No code, no app review, live in minutes.",
  },
  {
    label: "Converse",
    title: "A customer messages in",
    body: "Claude detects their language, runs your qualification script, and replies naturally — in Hindi, English, or Hinglish.",
  },
  {
    label: "Score",
    title: "The lead is scored in real time",
    body: "A transparent, weighted scoring engine grades every signal — budget, timeline, engagement — so \"why is this a 78?\" always has an answer.",
  },
  {
    label: "Close",
    title: "Your team works a ready pipeline",
    body: "The instant a lead qualifies, sales gets an email alert and a dashboard card — full transcript, score breakdown, and next action included.",
  },
] as const;

const AUTO_ADVANCE_MS = 4500;

function ConnectMock() {
  return (
    <div className="w-full max-w-sm rounded-xl border border-white/10 bg-ink-900 p-5">
      <p className="text-xs font-medium text-ink-300">Settings → Connect WhatsApp</p>
      <div className="mt-3 space-y-2">
        <div className="h-8 rounded-md border border-white/10 bg-white/5 px-3 text-xs leading-8 text-ink-300">Phone Number ID</div>
        <div className="h-8 rounded-md border border-white/10 bg-white/5 px-3 text-xs leading-8 text-ink-300">Access Token •••••••••••</div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-brand-500/15 px-3 py-2 text-sm font-medium text-brand-300">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-xs text-white">✓</span>
        Connected — +91 98200 11234
      </div>
    </div>
  );
}

function ConverseMock() {
  return (
    <div className="w-full max-w-sm space-y-2 rounded-xl border border-white/10 bg-ink-900 p-5">
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl bg-white/10 px-3 py-2 text-xs text-ink-100">Hi, I saw your interiors work — kitchen remodel, budget around 6L</div>
      </div>
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-brand-500 px-3 py-2 text-xs text-white">
          Great! And what's your timeline — looking to start this quarter?
        </div>
      </div>
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl bg-white/10 px-3 py-2 text-xs text-ink-100">Yes, as soon as possible</div>
      </div>
    </div>
  );
}

function ScoreMock() {
  const rows = [
    { k: "Stated budget", v: 25 },
    { k: "Timeline urgency", v: 20 },
    { k: "Questions completed", v: 16 },
    { k: "Response latency", v: 10 },
  ];
  return (
    <div className="w-full max-w-sm rounded-xl border border-white/10 bg-ink-900 p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-ink-300">Lead score</p>
        <p className="text-2xl font-bold text-brand-400">82</p>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs text-ink-300">
        {rows.map((r) => (
          <li key={r.k} className="flex items-center justify-between">
            <span>{r.k}</span>
            <span className="font-semibold text-ink-100">+{r.v}</span>
          </li>
        ))}
      </ul>
      <span className="badge mt-3 bg-brand-500/15 text-brand-300">● Qualified</span>
    </div>
  );
}

function CloseMock() {
  return (
    <div className="w-full max-w-sm space-y-3">
      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-ink-900 p-4">
        <span className="text-lg">🔔</span>
        <div>
          <p className="text-sm font-medium text-white">Qualified lead: Rina Deshmukh</p>
          <p className="text-xs text-ink-400">Score 82 · Urban Nest Interiors</p>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-ink-900 p-4">
        <div>
          <p className="text-sm font-medium text-white">Rina Deshmukh</p>
          <p className="text-xs text-ink-400">+91 98200 11234</p>
        </div>
        <span className="badge bg-brand-500/15 text-brand-300">● Qualified</span>
      </div>
    </div>
  );
}

const MOCKS = [ConnectMock, ConverseMock, ScoreMock, CloseMock];

export function HowItWorks() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [paused]);

  const Mock = MOCKS[step];

  return (
    <section id="working" className="mx-auto max-w-6xl px-6 pb-24 pt-4">
      <div className="text-center">
        <span className="badge bg-brand-500/15 text-brand-300">How it works</span>
        <h2 className="mt-3 text-3xl font-bold text-white">From WhatsApp message to closed deal, automatically</h2>
        <p className="mx-auto mt-2 max-w-xl text-ink-300">Four steps, no manual triage — click through them, or let it play.</p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-center" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <ol className="space-y-2">
          {STEPS.map((s, i) => {
            const active = i === step;
            return (
              <li key={s.label}>
                <button
                  onClick={() => setStep(i)}
                  className={`w-full rounded-xl border px-5 py-4 text-left transition ${
                    active ? "border-brand-500/40 bg-white/5" : "border-transparent hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
                        active ? "bg-brand-500 text-white" : "bg-white/10 text-ink-300"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold transition ${active ? "text-white" : "text-ink-200"}`}>{s.title}</p>
                      {active && <p className="mt-1 text-sm text-ink-300">{s.body}</p>}
                    </div>
                  </div>
                  {active && (
                    <div className="ml-11 mt-3 h-0.5 overflow-hidden rounded-full bg-white/10">
                      <div key={step} className="h-full w-full origin-left animate-[progress_4.5s_linear] bg-brand-400" />
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="flex justify-center lg:justify-start" key={step}>
          <div className="animate-fadeSlideIn">
            <Mock />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }
      `}</style>
    </section>
  );
}
