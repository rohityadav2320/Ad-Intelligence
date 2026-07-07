"use client";

import { useState, useEffect } from "react";
import { Loader2, ChevronRight, Sparkles, Zap, Copy, Film, TrendingUp } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Client { id: string; name: string; }
interface MetaAds {
  total: number; brand_ads: number; competitor_ads: number;
  breakdown: { client: string; client_id: string; brand_ads: number; competitor_ads: number }[];
}
interface Scripts { total: number; fresh: number; copied: number; doubled: number; from_reels: number; }
interface Reels { total: number; scripts_made: number; unused: number; }
interface PerClient {
  client_id: string; client_name: string;
  total_ads: number; brand_ads: number; competitor_ads: number;
  fresh_scripts: number; copied_scripts: number; doubled_scripts: number;
  reels: number; reel_scripts: number;
}
interface DashData {
  clients: Client[]; meta_ads: MetaAds; scripts: Scripts; reels: Reels; per_client: PerClient[];
}

export default function Home() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeClient, setActiveClient] = useState("ALL");

  const load = async (cid?: string) => {
    setLoading(true);
    try {
      const url = cid && cid !== "ALL" ? `${API}/api/dashboard?client_id=${cid}` : `${API}/api/dashboard`;
      const d = await fetch(url).then(r => r.json());
      setData(d);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const switchClient = (cid: string) => { setActiveClient(cid); load(cid === "ALL" ? undefined : cid); };

  if (loading || !data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
    </div>
  );

  const { meta_ads, scripts, reels, per_client } = data;
  const allClients: Client[] = data.clients || [];
  const activeName = activeClient === "ALL" ? null : allClients.find(c => c.id === activeClient)?.name;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Everything happening on this portal{activeName ? ` — ${activeName}` : ""}
            </p>
          </div>
          <a href="/research" className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            + New Analysis
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

        {/* Client filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Filter:</span>
          {[{ id: "ALL", name: "All Clients" }, ...allClients].map(c => (
            <button key={c.id} onClick={() => switchClient(c.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeClient === c.id ? "bg-gray-900 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
              }`}>
              {c.name}
            </button>
          ))}
        </div>

        {/* 4 Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Box 1 — Meta Ads Scraped */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-gray-900">Meta Ads Scraped</h2>
                <p className="text-xs text-gray-400">Ads pulled from Facebook Ad Library</p>
              </div>
              <span className="text-3xl font-bold text-gray-900">{meta_ads.total}</span>
            </div>

            {meta_ads.total > 0 && (
              <div className="mb-4">
                <div className="flex rounded-full overflow-hidden h-2 mb-2 bg-gray-100">
                  <div className="bg-emerald-500 transition-all" style={{ width: `${(meta_ads.brand_ads / meta_ads.total) * 100}%` }} />
                  <div className="bg-orange-400 transition-all" style={{ width: `${(meta_ads.competitor_ads / meta_ads.total) * 100}%` }} />
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> {meta_ads.brand_ads} client brand ads
                  </span>
                  <span className="flex items-center gap-1.5 text-orange-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-orange-400" /> {meta_ads.competitor_ads} competitor ads
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1 mt-3">
              {meta_ads.breakdown.map(b => (
                <a key={b.client_id} href={`/client?id=${b.client_id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors group">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {b.client.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-gray-700 flex-1">{b.client}</span>
                  <div className="flex gap-3 text-xs font-semibold">
                    <span className="text-emerald-600">{b.brand_ads} brand</span>
                    <span className="text-orange-500">{b.competitor_ads} comp.</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
                </a>
              ))}
              {meta_ads.breakdown.length === 0 && <p className="text-sm text-gray-400 text-center py-3">No ads scraped yet</p>}
            </div>
          </div>

          {/* Box 2 — Scripts Made */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-gray-900">Scripts Generated</h2>
                <p className="text-xs text-gray-400">All AI-written scripts saved to portal</p>
              </div>
              <span className="text-3xl font-bold text-gray-900">{scripts.total}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: <Sparkles className="w-4 h-4" />, label: "Fresh Scripts", desc: "Written from scratch using client brief & competitor intel", count: scripts.fresh, bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", num: "text-emerald-800", href: "/scripts?type=fresh" },
                { icon: <Copy className="w-4 h-4" />, label: "Copied", desc: "Adapted from a competitor's working ad format", count: scripts.copied, bg: "bg-purple-50 border-purple-200", text: "text-purple-700", num: "text-purple-800", href: "/scripts?type=adapted" },
                { icon: <Zap className="w-4 h-4" />, label: "Doubled Down", desc: "New variations built on a winning ad format", count: scripts.doubled, bg: "bg-amber-50 border-amber-200", text: "text-amber-700", num: "text-amber-800", href: "/scripts?type=doubledown" },
                { icon: <Film className="w-4 h-4" />, label: "From Reels", desc: "Instagram reel format adapted for client", count: scripts.from_reels, bg: "bg-pink-50 border-pink-200", text: "text-pink-700", num: "text-pink-800", href: "/scripts?type=reel" },
              ].map(item => (
                <a key={item.label} href={item.href} className={`border rounded-xl p-3.5 hover:shadow-sm transition-shadow cursor-pointer ${item.bg}`}>
                  <div className={`flex items-center gap-1.5 mb-1.5 ${item.text}`}>{item.icon}<span className="text-xs font-semibold">{item.label}</span></div>
                  <div className={`text-2xl font-bold ${item.num}`}>{item.count}</div>
                  <div className="text-[11px] text-gray-400 mt-1 leading-tight">{item.desc}</div>
                </a>
              ))}
            </div>
            <a href="/scripts" className="mt-4 flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-blue-600 font-medium py-1.5 transition-colors">
              View all scripts <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Box 3 — Instagram Reels */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-gray-900">Instagram Reel Inspiration</h2>
                <p className="text-xs text-gray-400">Save a reel → AI transcribes → writes script for your client</p>
              </div>
            </div>

            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-pink-50 border border-pink-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-pink-700">{reels.total}</div>
                <div className="text-xs text-pink-600 font-semibold mt-0.5">Reels saved</div>
                <div className="text-[11px] text-gray-400 mt-1">Paste link → auto downloaded & transcribed</div>
              </div>
              <div className="flex-1 bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-purple-700">{reels.scripts_made}</div>
                <div className="text-xs text-purple-600 font-semibold mt-0.5">Scripts made</div>
                <div className="text-[11px] text-gray-400 mt-1">AI adapted reel format for the client</div>
              </div>
              {reels.unused > 0 && (
                <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">{reels.unused}</div>
                  <div className="text-xs text-amber-600 font-semibold mt-0.5">Unused</div>
                  <div className="text-[11px] text-gray-400 mt-1">Saved but no script yet</div>
                </div>
              )}
            </div>

            {reels.total === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-center text-sm text-gray-400">
                No reels saved yet — open a client workspace → click <strong>Reel Inspiration</strong>
              </div>
            ) : reels.unused > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                💡 {reels.unused} reel{reels.unused > 1 ? "s" : ""} saved with no script — open the client workspace and click "Make for [client]"
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs text-green-700">
                ✓ All saved reels have scripts — great output!
              </div>
            )}
          </div>

          {/* Box 4 — Per Client Activity */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Client Activity</h2>
                <p className="text-xs text-gray-400">What's been done per client — ads scraped & scripts made</p>
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-6 gap-1 px-3 pb-2 border-b border-gray-100">
              <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Client</span>
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider text-center">Ads</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider text-center">✨</span>
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider text-center">⚡</span>
              <span className="text-[10px] font-bold text-pink-500 uppercase tracking-wider text-center">🎬</span>
            </div>

            <div className="space-y-0.5 mt-2">
              {per_client.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>}
              {per_client.map(c => (
                <a key={c.client_id} href={`/client?id=${c.client_id}`}
                  className="grid grid-cols-6 gap-1 items-center px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                  <div className="col-span-2 flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {c.client_name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-800 truncate">{c.client_name}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-gray-700">{c.total_ads}</span>
                    <div className="text-[9px] text-gray-400">{c.brand_ads}b·{c.competitor_ads}c</div>
                  </div>
                  <div className="text-center">
                    <span className={`text-sm font-bold ${c.fresh_scripts > 0 ? "text-emerald-600" : "text-gray-300"}`}>{c.fresh_scripts}</span>
                  </div>
                  <div className="text-center">
                    <span className={`text-sm font-bold ${c.doubled_scripts > 0 ? "text-amber-500" : "text-gray-300"}`}>{c.doubled_scripts}</span>
                  </div>
                  <div className="text-center">
                    <span className={`text-sm font-bold ${c.reels > 0 ? "text-pink-500" : "text-gray-300"}`}>{c.reels}</span>
                    {c.reels > 0 && c.reel_scripts > 0 && <div className="text-[9px] text-purple-400">→{c.reel_scripts}s</div>}
                  </div>
                </a>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-gray-400">
              <span>✨ Fresh — scripts written from scratch</span>
              <span>⚡ DD — doubled down on winning ads</span>
              <span>🎬 Reels saved (→Xs = scripts made)</span>
              <span>Ads: b=brand · c=competitor</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
