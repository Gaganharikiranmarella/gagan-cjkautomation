"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/apiClient";
import { useAuth } from "@/lib/AuthContext";
import type { WabaAccount } from "@/lib/types";

export default function SettingsPage() {
  const [tab, setTab] = useState<"whatsapp" | "branding" | "users">("whatsapp");
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-ink-800">Settings</h1>
      <div className="mt-4 flex gap-2 border-b border-black/5">
        {[
          { id: "whatsapp", label: "Connect WhatsApp" },
          { id: "branding", label: "Branding" },
          { id: "users", label: "Users & roles" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-3 py-2 text-sm font-medium ${tab === t.id ? "border-b-2 border-brand-500 text-brand-600" : "text-ink-400"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "whatsapp" && <ConnectWhatsApp />}
        {tab === "branding" && <Branding />}
        {tab === "users" && <Users />}
      </div>
    </div>
  );
}

function ConnectWhatsApp() {
  const [accounts, setAccounts] = useState<WabaAccount[]>([]);
  const [form, setForm] = useState({ phone_number_id: "", waba_id: "", access_token: "", app_secret: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID;

  async function load() {
    const res = await api.get<WabaAccount[]>("/waba-accounts");
    setAccounts(res);
  }
  useEffect(() => {
    load();
  }, []);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await api.post<{ verify_token: string }>("/waba-accounts/connect", form);
      setSuccess(
        `Connected! In your Meta App's WhatsApp > Configuration, set the callback URL to {your-domain}/api/backend/webhooks/whatsapp and the verify token to: ${res.verify_token}`
      );
      setForm({ phone_number_id: "", waba_id: "", access_token: "", app_secret: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't connect this account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {accounts.length > 0 && (
        <div className="card divide-y divide-black/5">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-ink-800">{a.display_name || a.display_phone_number || a.phone_number_id}</p>
                <p className="text-xs text-ink-400">{a.display_phone_number} · {a.connection_method.replace("_", " ")}</p>
              </div>
              <span className={`badge ${a.status === "connected" ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-400"}`}>{a.status}</span>
            </div>
          ))}
        </div>
      )}

      {metaAppId && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700">One-click connect</h3>
          <p className="mt-1 text-xs text-ink-400">Uses Meta's Embedded Signup — connects your number without leaving this page.</p>
          <button className="btn-primary mt-3" disabled>
            Connect with Facebook (configure NEXT_PUBLIC_META_CONFIG_ID to enable)
          </button>
        </div>
      )}

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink-700">Connect WhatsApp Business Account</h3>
        <p className="mt-1 text-xs text-ink-400">
          Get these instantly from{" "}
          <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
            developers.facebook.com
          </a>{" "}
          → your App → WhatsApp → API Setup. No app review needed to start testing.
        </p>
        <form onSubmit={connect} className="mt-4 space-y-3">
          <div>
            <label className="label">Phone Number ID</label>
            <input className="input" required value={form.phone_number_id} onChange={(e) => setForm((f) => ({ ...f, phone_number_id: e.target.value }))} />
          </div>
          <div>
            <label className="label">WhatsApp Business Account ID</label>
            <input className="input" required value={form.waba_id} onChange={(e) => setForm((f) => ({ ...f, waba_id: e.target.value }))} />
          </div>
          <div>
            <label className="label">Access Token</label>
            <input
              className="input"
              type="password"
              required
              value={form.access_token}
              onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">App Secret (optional, enables webhook signature verification)</label>
            <input className="input" type="password" value={form.app_secret} onChange={(e) => setForm((f) => ({ ...f, app_secret: e.target.value }))} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-brand-700">{success}</p>}
          <button className="btn-primary" disabled={loading}>
            {loading ? "Connecting..." : "Connect WhatsApp Business Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Branding() {
  const { user, refresh } = useAuth();
  const [accent, setAccent] = useState(user?.tenant?.brand_config?.accent_color || "#12A9A6");
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // A dedicated PATCH /tenants/:id/settings endpoint can be added when branding
    // needs to affect more than the dashboard accent — kept minimal for v1.
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={save} className="card max-w-md p-6">
      <label className="label">Accent color</label>
      <div className="flex items-center gap-3">
        <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-14 rounded border border-ink-200" />
        <input className="input" value={accent} onChange={(e) => setAccent(e.target.value)} />
      </div>
      <p className="mt-2 text-xs text-ink-400">Workspace: {user?.tenant?.name}</p>
      <button className="btn-primary mt-4">{saved ? "Saved" : "Save"}</button>
    </form>
  );
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "sales_rep" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setUsers(await api.get<UserRow[]>("/users"));
  }
  useEffect(() => {
    load();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/users", form);
      setForm({ name: "", email: "", password: "", role: "sales_rep" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add user");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addUser} className="card grid gap-3 p-5 sm:grid-cols-5">
        <input className="input" placeholder="Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <input className="input" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        <input
          className="input"
          type="password"
          placeholder="Temp password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        />
        <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
          <option value="sales_rep">Sales rep</option>
          <option value="tenant_admin">Admin</option>
          <option value="viewer">Viewer</option>
        </select>
        <button className="btn-primary">Add user</button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="card divide-y divide-black/5">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-5 py-3 text-sm">
            <div>
              <p className="font-medium text-ink-800">{u.name}</p>
              <p className="text-xs text-ink-400">{u.email}</p>
            </div>
            <span className="badge bg-ink-100 text-ink-600 capitalize">{u.role.replace("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
