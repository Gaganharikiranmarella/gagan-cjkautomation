"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import type { LeadDetail, Message } from "@/lib/types";
import { StatusBadge, ScoreBadge } from "@/components/StatusBadge";

const STATUSES = ["new", "contacted", "qualifying", "qualified", "unqualified", "converted", "dormant"];

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const l = await api.get<LeadDetail>(`/leads/${params.id}`);
    setLead(l);
    setOverrideStatus(l.status);
    if (l.conversation_id) {
      const convo = await api.get<{ messages: Message[] }>(`/conversations/${l.conversation_id}/messages`);
      setMessages(convo.messages);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function sendReply() {
    if (!lead?.conversation_id || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api.post(`/conversations/${lead.conversation_id}/messages`, { text: reply });
      setReply("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that message");
    } finally {
      setSending(false);
    }
  }

  async function suggestReply() {
    if (!lead?.conversation_id) return;
    setSuggesting(true);
    try {
      const res = await api.post<{ draft: string }>(`/conversations/${lead.conversation_id}/suggest-reply`, {
        instruction: "Draft a helpful, concise follow-up reply.",
      });
      setReply(res.draft);
    } finally {
      setSuggesting(false);
    }
  }

  async function submitOverride() {
    if (!lead) return;
    await api.patch(`/leads/${lead.id}`, { status: overrideStatus, reason: overrideReason });
    setOverrideOpen(false);
    setOverrideReason("");
    await load();
  }

  if (!lead) return <div className="text-sm text-ink-400">Loading...</div>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="card flex h-[calc(100vh-140px)] flex-col">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
            <div>
              <h1 className="font-semibold text-ink-800">{lead.contact_name || lead.phone_e164}</h1>
              <p className="text-xs text-ink-400">{lead.phone_e164}</p>
            </div>
            <StatusBadge status={lead.status} />
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {messages.length === 0 && <p className="text-center text-sm text-ink-400">No messages yet</p>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    m.direction === "outbound" ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content?.text}</p>
                  <p className={`mt-1 text-[10px] ${m.direction === "outbound" ? "text-white/70" : "text-ink-400"}`}>
                    {new Date(m.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-black/5 p-4">
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
            <div className="flex items-end gap-2">
              <textarea
                className="input min-h-[44px] flex-1 resize-none"
                placeholder="Type a reply..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <button className="btn-secondary" onClick={suggestReply} disabled={suggesting} title="AI-suggested reply">
                {suggesting ? "..." : "✨ Suggest"}
              </button>
              <button className="btn-primary" onClick={sendReply} disabled={sending || !reply.trim()}>
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink-700">Lead score</h2>
          <div className="mt-2 flex items-baseline gap-2">
            <ScoreBadge score={lead.score} />
            <span className="text-xs text-ink-400">/ 100</span>
          </div>
          {lead.score_history[0] && (
            <ul className="mt-3 space-y-1.5 text-xs text-ink-500">
              {Object.entries(lead.score_history[0].breakdown).map(([key, val]: [string, any]) => (
                <li key={key} className="flex justify-between">
                  <span className="capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="font-medium text-ink-700">{val?.points ?? val}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-700">Details</h2>
            <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setOverrideOpen((v) => !v)}>
              Override
            </button>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-400">Company</dt>
              <dd className="text-ink-700">{lead.company || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-400">Source</dt>
              <dd className="text-ink-700">{lead.source.replace("_", " ")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-400">Owner</dt>
              <dd className="text-ink-700">{lead.owner_name || "Unassigned"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-400">Language</dt>
              <dd className="text-ink-700 uppercase">{lead.locale}</dd>
            </div>
          </dl>

          {overrideOpen && (
            <div className="mt-4 space-y-3 border-t border-black/5 pt-4">
              <div>
                <label className="label">New status</label>
                <select className="input" value={overrideStatus} onChange={(e) => setOverrideStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Reason (required, written to audit log)</label>
                <input className="input" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
              </div>
              <button className="btn-primary w-full" disabled={overrideReason.length < 3} onClick={submitOverride}>
                Save override
              </button>
            </div>
          )}
        </div>

        {lead.tags.length > 0 && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-ink-700">Tags</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lead.tags.map((t) => (
                <span key={t} className="badge bg-ink-100 text-ink-600">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
