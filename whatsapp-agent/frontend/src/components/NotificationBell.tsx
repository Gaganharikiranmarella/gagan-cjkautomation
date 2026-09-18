"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/apiClient";
import type { NotificationItem } from "@/lib/types";

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await api.get<{ items: NotificationItem[]; unread_count: number }>("/notifications");
      setItems(res.items);
      setUnread(res.unread_count);
    } catch {
      /* not logged in yet, or a transient error — bell just stays quiet */
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    load();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-black/5 bg-white shadow-lg">
          <div className="border-b border-black/5 px-4 py-3 text-sm font-semibold text-ink-700">Notifications</div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-400">No notifications yet</p>}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`block w-full border-b border-black/5 px-4 py-3 text-left text-sm last:border-0 hover:bg-ink-50 ${
                  n.read_at ? "opacity-60" : ""
                }`}
              >
                <p className="font-medium text-ink-800">{n.subject}</p>
                <p className="text-xs text-ink-400">{n.lead_name || "—"} · {new Date(n.created_at).toLocaleString()}</p>
              </button>
            ))}
          </div>
          <Link href="/dashboard/leads" className="block px-4 py-2.5 text-center text-xs font-medium text-brand-600 hover:bg-ink-50">
            View all leads
          </Link>
        </div>
      )}
    </div>
  );
}
