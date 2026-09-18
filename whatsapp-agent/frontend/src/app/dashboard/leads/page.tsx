"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import type { LeadListItem } from "@/lib/types";
import { StatusBadge, ScoreBadge } from "@/components/StatusBadge";

const STATUSES = ["new", "contacted", "qualifying", "qualified", "unqualified", "converted", "dormant"];

export default function LeadsPage() {
  const [items, setItems] = useState<LeadListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    try {
      const res = await api.get<{ items: LeadListItem[]; total: number }>(`/leads?${params.toString()}`);
      setItems(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function exportCsv() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const blob = await api.get<Blob>(`/leads/export?${params.toString()}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-800">Leads</h1>
          <p className="text-sm text-ink-400">{total} total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-56"
            placeholder="Search name, phone, company..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <button className="btn-secondary" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="w-10 px-4 py-3"></th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Owner</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink-400">
                  No leads yet — they'll show up here as soon as someone messages your WhatsApp number, or you
                  import a CSV.
                </td>
              </tr>
            )}
            {items.map((lead) => (
              <tr key={lead.id} className="border-b border-black/5 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggle(lead.id)} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/leads/${lead.id}`} className="font-medium text-ink-800 hover:text-brand-600">
                    {lead.contact_name || "Unknown"}
                  </Link>
                  {lead.company && <p className="text-xs text-ink-400">{lead.company}</p>}
                </td>
                <td className="px-4 py-3 text-ink-500">{lead.phone_e164}</td>
                <td className="px-4 py-3 text-ink-500">{lead.source.replace("_", " ")}</td>
                <td className="px-4 py-3">
                  <ScoreBadge score={lead.score} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-3 text-ink-500">{lead.owner_name || "Unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
