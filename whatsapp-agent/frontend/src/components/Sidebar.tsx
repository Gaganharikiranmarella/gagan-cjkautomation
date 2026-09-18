"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

const NAV = [
  { href: "/dashboard/leads", label: "Leads", icon: "◧" },
  { href: "/dashboard/csv-import", label: "CSV Import", icon: "⇪" },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: "▶" },
  { href: "/dashboard/audit-log", label: "Audit Log", icon: "≡" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-black/5 bg-ink-800 text-white">
      <div className="px-5 py-5">
        <Link href="/dashboard/leads">
          <Logo light size={30} />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active ? "bg-brand-500/15 text-brand-300" : "text-ink-200 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4">
        <Link href="/support" className="text-xs text-ink-400 hover:text-white">
          Support & complaints
        </Link>
      </div>
    </aside>
  );
}
