"use client";

import { usePathname } from "next/navigation";

const NAV = [
  {
    href: "/",
    label: "Dashboard",
    desc: "Analytics & activity overview",
    match: (p: string) => p === "/",
    icon: (
      <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>
    ),
  },
  {
    href: "/clients",
    label: "Clients",
    desc: "Open a client workspace",
    match: (p: string) => p.startsWith("/client"),
    icon: (
      <><circle cx="7" cy="7" r="3" /><path d="M2 17c0-2.8 2.2-5 5-5s5 2.2 5 5" /><path d="M14 5a3 3 0 0 1 0 6" /><path d="M18 17c0-2-1-3.7-2.5-4.5" /></>
    ),
  },
  {
    href: "/library",
    label: "Ad Library",
    desc: "Browse & search all ads",
    match: (p: string) => p.startsWith("/library") || p.startsWith("/results"),
    icon: (
      <><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M7 3v14M3 8h4" /></>
    ),
  },
  {
    href: "/scripts",
    label: "Scripts",
    desc: "Fresh, copied & doubled-down scripts",
    match: (p: string) => p.startsWith("/scripts"),
    icon: (
      <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname() || "/";
  const onResearch = pathname.startsWith("/research");
  const onDash = pathname === "/";

  return (
    <aside className="w-64 shrink-0 bg-slate-900 text-slate-300 flex flex-col fixed h-screen z-20">
      {/* Brand */}
      <a href="/" className="px-5 py-5 border-b border-slate-800 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">A</div>
        <div>
          <div className="font-bold text-white leading-tight">Ad Intelligence</div>
          <div className="text-xs text-slate-500">by Vidrow</div>
        </div>
      </a>

      {/* Primary action — big and obvious */}
      <div className="p-4 border-b border-slate-800">
        <a
          href="/research"
          className={`flex items-center justify-center gap-2.5 w-full px-4 py-3.5 rounded-xl font-semibold text-base bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/40 transition-all ${onResearch ? "ring-2 ring-blue-400/60" : ""}`}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>
          New Analysis
        </a>
        <p className="text-xs text-slate-500 text-center mt-2">Paste Meta Ads Library links</p>
      </div>

      {/* Nav */}
      <nav className="px-3 pt-3 space-y-1 flex-1">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">Workspace</p>
        {NAV.map((item) => {
          const active = item.match(pathname) && !onResearch;
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">{item.icon}</svg>
              <span>
                <span className="font-semibold text-sm block leading-tight">{item.label}</span>
                <span className={`text-xs leading-tight ${active ? "text-slate-400" : "text-slate-600"}`}>{item.desc}</span>
              </span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
            </a>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> Backend connected
        </div>
      </div>
    </aside>
  );
}
