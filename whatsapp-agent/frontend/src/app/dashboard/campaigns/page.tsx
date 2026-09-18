"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/apiClient";

interface Template {
  id: string;
  name: string;
  locale: string;
  category: string;
  status: string;
}
interface Campaign {
  id: string;
  name: string;
  template_name: string | null;
  status: string;
  schedule_type: string;
  created_at: string;
}
interface FollowUpRule {
  id: string;
  name: string;
  trigger_status: string;
  delay_minutes: number;
  action: string;
  active: boolean;
}

const LEAD_STATUSES = ["new", "contacted", "qualifying", "qualified", "unqualified", "dormant"];

export default function CampaignsPage() {
  const [tab, setTab] = useState<"campaigns" | "templates" | "rules">("campaigns");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [rules, setRules] = useState<FollowUpRule[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [t, c, r] = await Promise.all([
      api.get<Template[]>("/templates"),
      api.get<Campaign[]>("/campaigns"),
      api.get<FollowUpRule[]>("/follow-up-rules"),
    ]);
    setTemplates(t);
    setCampaigns(c);
    setRules(r);
  }

  useEffect(() => {
    load();
  }, []);

  const [newTemplate, setNewTemplate] = useState({ name: "", locale: "en", body: "" });
  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/templates", newTemplate);
      setNewTemplate({ name: "", locale: "en", body: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create template");
    }
  }

  const [newCampaign, setNewCampaign] = useState({ name: "", template_id: "", status: "" });
  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/campaigns", {
        name: newCampaign.name,
        template_id: newCampaign.template_id,
        audience_filter: newCampaign.status ? { status: newCampaign.status } : {},
        schedule_type: "immediate",
      });
      setNewCampaign({ name: "", template_id: "", status: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create campaign");
    }
  }

  const [newRule, setNewRule] = useState({ name: "", trigger_status: "new", delay_minutes: 240, action: "send_template", template_id: "" });
  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/follow-up-rules", { ...newRule, template_id: newRule.template_id || null });
      setNewRule({ name: "", trigger_status: "new", delay_minutes: 240, action: "send_template", template_id: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create rule");
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold text-ink-800">Campaigns & follow-ups</h1>
      <div className="mt-4 flex gap-2 border-b border-black/5">
        {(["campaigns", "templates", "rules"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-brand-500 text-brand-600" : "text-ink-400"}`}
          >
            {t === "rules" ? "Follow-up rules" : t}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {tab === "templates" && (
        <div className="mt-6 space-y-6">
          <form onSubmit={createTemplate} className="card grid gap-3 p-5 sm:grid-cols-4">
            <input className="input sm:col-span-1" placeholder="Template name" required value={newTemplate.name} onChange={(e) => setNewTemplate((t) => ({ ...t, name: e.target.value }))} />
            <select className="input" value={newTemplate.locale} onChange={(e) => setNewTemplate((t) => ({ ...t, locale: e.target.value }))}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
            <input className="input sm:col-span-1" placeholder="Message body" required value={newTemplate.body} onChange={(e) => setNewTemplate((t) => ({ ...t, body: e.target.value }))} />
            <button className="btn-primary">Add template</button>
          </form>
          <div className="card divide-y divide-black/5">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink-800">{t.name}</p>
                  <p className="text-xs text-ink-400">{t.locale.toUpperCase()} · {t.category}</p>
                </div>
                <span className="badge bg-amber-50 text-amber-700 capitalize">{t.status}</span>
              </div>
            ))}
            {templates.length === 0 && <p className="px-5 py-6 text-center text-sm text-ink-400">No templates yet</p>}
          </div>
        </div>
      )}

      {tab === "campaigns" && (
        <div className="mt-6 space-y-6">
          <form onSubmit={createCampaign} className="card grid gap-3 p-5 sm:grid-cols-4">
            <input className="input" placeholder="Campaign name" required value={newCampaign.name} onChange={(e) => setNewCampaign((c) => ({ ...c, name: e.target.value }))} />
            <select className="input" required value={newCampaign.template_id} onChange={(e) => setNewCampaign((c) => ({ ...c, template_id: e.target.value }))}>
              <option value="">Select template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select className="input" value={newCampaign.status} onChange={(e) => setNewCampaign((c) => ({ ...c, status: e.target.value }))}>
              <option value="">Audience: all leads</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  Status: {s}
                </option>
              ))}
            </select>
            <button className="btn-primary">Send campaign</button>
          </form>
          <div className="card divide-y divide-black/5">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink-800">{c.name}</p>
                  <p className="text-xs text-ink-400">{c.template_name || "—"}</p>
                </div>
                <span className="badge bg-blue-50 text-blue-700 capitalize">{c.status}</span>
              </div>
            ))}
            {campaigns.length === 0 && <p className="px-5 py-6 text-center text-sm text-ink-400">No campaigns yet</p>}
          </div>
        </div>
      )}

      {tab === "rules" && (
        <div className="mt-6 space-y-6">
          <form onSubmit={createRule} className="card grid gap-3 p-5 sm:grid-cols-5">
            <input className="input" placeholder="Rule name" required value={newRule.name} onChange={(e) => setNewRule((r) => ({ ...r, name: e.target.value }))} />
            <select className="input" value={newRule.trigger_status} onChange={(e) => setNewRule((r) => ({ ...r, trigger_status: e.target.value }))}>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  If status = {s}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="input"
              placeholder="Delay (minutes)"
              required
              value={newRule.delay_minutes}
              onChange={(e) => setNewRule((r) => ({ ...r, delay_minutes: Number(e.target.value) }))}
            />
            <select className="input" value={newRule.action} onChange={(e) => setNewRule((r) => ({ ...r, action: e.target.value }))}>
              <option value="send_template">Send template</option>
              <option value="move_dormant">Move to dormant</option>
            </select>
            {newRule.action === "send_template" ? (
              <select className="input" value={newRule.template_id} onChange={(e) => setNewRule((r) => ({ ...r, template_id: e.target.value }))}>
                <option value="">Select template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : (
              <div />
            )}
            <button className="btn-primary sm:col-span-5">Add rule</button>
          </form>
          <div className="card divide-y divide-black/5">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink-800">{r.name}</p>
                  <p className="text-xs text-ink-400">
                    {r.trigger_status} → wait {r.delay_minutes}m → {r.action.replace("_", " ")}
                  </p>
                </div>
                <span className={`badge ${r.active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-400"}`}>{r.active ? "Active" : "Paused"}</span>
              </div>
            ))}
            {rules.length === 0 && <p className="px-5 py-6 text-center text-sm text-ink-400">No follow-up rules yet</p>}
          </div>
        </div>
      )}
    </div>
  );
}
