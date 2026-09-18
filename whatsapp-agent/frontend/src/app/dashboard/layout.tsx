"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/lib/AuthContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 text-sm text-ink-400">Loading your workspace...</div>
    );
  }

  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-black/5 bg-white px-6 py-3">
          <div className="text-sm text-ink-400">{user.tenant?.name || "Your workspace"}</div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {user.name?.[0]?.toUpperCase()}
              </div>
              <div className="text-sm">
                <p className="font-medium text-ink-800">{user.name}</p>
                <p className="text-xs capitalize text-ink-400">{user.role.replace("_", " ")}</p>
              </div>
              <button onClick={logout} className="ml-2 text-xs text-ink-400 hover:text-red-600">
                Log out
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
