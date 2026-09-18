"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  reason: string | null;
  actor_name: string | null;
  created_at: string;
}

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.get<{ items: AuditEntry[]; total: number }>("/audit-log").then((res) => {
      setItems(res.items);
      setTotal(res.total);
    });
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-800">Audit log</h1>
      <p className="text-sm text-ink-400">{total} entries · every manual override, logged with actor and reason</p>

      <div className="card mt-5 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-400">
                  No audit entries yet
                </td>
              </tr>
            )}
            {items.map((e) => (
              <tr key={e.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 text-ink-500">{new Date(e.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-ink-700">{e.actor_name || "System"}</td>
                <td className="px-4 py-3 text-ink-700">{e.action}</td>
                <td className="px-4 py-3 text-ink-500">
                  {e.entity} {e.entity_id ? `#${e.entity_id.slice(0, 8)}` : ""}
                </td>
                <td className="px-4 py-3 text-ink-500">{e.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
