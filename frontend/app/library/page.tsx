"use client";

import { useState, useEffect, Fragment } from "react";
import { Search, Download, Play, Check, Loader2, Trash2, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Ad {
  id: string;
  meta_library_id: string;
  days_running: number;
  performance_tier: string;
  video_url: string;
  ad_copy: string;
  brands: { name: string; category: string };
  transcripts: { hook_text: string } | null;
  ai_analysis: {
    hook: string;
    tone: string;
    hook_type: string;
    cta: string;
    script_quality_score: number;
    target_audience: string;
  } | null;
}

interface ClientBrand { name: string; role: "client" | "competitor"; }
interface Client { id: string; name: string; brands: ClientBrand[]; }

const TIER_STYLES: Record<string, string> = {
  PROVEN: "bg-green-100 text-green-800",
  TESTING: "bg-yellow-100 text-yellow-800",
  NEW: "bg-gray-100 text-gray-600",
};

export default function LibraryPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<Ad | null>(null);
  const [filters, setFilters] = useState({
    tone: "", hook_type: "", min_days: "", min_score: "", brand: ""
  });

  // send-to-client
  const [clients, setClients] = useState<Client[]>([]);
  const [sending, setSending] = useState(false);
  const [sentKey, setSentKey] = useState<string | null>(null);
  const [sendMenuFor, setSendMenuFor] = useState<string | null>(null);

  // multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // batchDest = "clientId::client" or "clientId::competitor::CompetitorName"
  const [batchDest, setBatchDest] = useState("");
  const [batchSending, setBatchSending] = useState(false);
  const [batchDone, setBatchDone] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === ads.length) setSelected(new Set());
    else setSelected(new Set(ads.map((a) => a.id)));
  };

  const sendBatch = async () => {
    if (!batchDest || selected.size === 0) return;
    const [clientId, role] = batchDest.split("::");
    setBatchSending(true);
    await Promise.all(
      [...selected].map((adId) =>
        fetch(`${API}/api/clients/${clientId}/link-ad`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ad_id: adId, role }),
        })
      )
    );
    setBatchDone(true);
    setTimeout(() => { setSelected(new Set()); setBatchDone(false); }, 1500);
    setBatchSending(false);
  };

  const fetchAds = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.tone) params.set("tone", filters.tone);
    if (filters.hook_type) params.set("hook_type", filters.hook_type);
    if (filters.min_days) params.set("min_days", filters.min_days);
    if (filters.min_score) params.set("min_score", filters.min_score);
    if (filters.brand) params.set("brand", filters.brand);
    params.set("limit", "100");
    try {
      const res = await fetch(`${API}/api/library?${params}`);
      const data = await res.json();
      setAds(data);
    } catch {}
    setLoading(false);
  };

  // Instant filter on dropdown change (avoids stale closure issue)
  const fetchWithOverride = async (override: Partial<typeof filters>) => {
    const merged = { ...filters, ...override };
    const params = new URLSearchParams();
    if (merged.tone) params.set("tone", merged.tone);
    if (merged.hook_type) params.set("hook_type", merged.hook_type);
    if (merged.min_days) params.set("min_days", merged.min_days);
    if (merged.min_score) params.set("min_score", merged.min_score);
    if (merged.brand) params.set("brand", merged.brand);
    params.set("limit", "100");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/library?${params}`);
      const data = await res.json();
      setAds(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchAds();
    fetch(`${API}/api/clients`).then((r) => r.json()).then((data) => {
      setClients(data);
    }).catch(() => {});
  }, []);

  const refreshClients = () =>
    fetch(`${API}/api/clients`).then((r) => r.json()).then(setClients).catch(() => {});

  const sendToClient = async (ad: Ad, clientId: string, role: "client" | "competitor") => {
    if (!ad.brands?.name) return;
    setSending(true);
    const key = `${clientId}:${role}`;
    try {
      const res = await fetch(`${API}/api/clients/${clientId}/link-ad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_id: ad.id, role }),
      });
      if (res.ok) {
        setSentKey(key);
        await refreshClients(); // update competitor lists immediately
        setTimeout(() => { setSendMenuFor(null); setSentKey(null); }, 1200);
      }
    } catch {}
    setSending(false);
  };

  const toneOptions = ["comedy", "fear", "emotional", "informational", "aspirational", "story"];
  const hookTypes = ["question", "shocking_statement", "story", "pain_point", "curiosity", "stat"];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Video modal */}
      {player?.video_url && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setPlayer(null)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPlayer(null)} className="absolute -top-10 right-0 text-white text-sm hover:text-gray-300">✕ Close</button>
            <video src={player.video_url.startsWith('http') ? player.video_url : `${API}${player.video_url}`} className="max-h-[80vh] max-w-[90vw] rounded-lg" controls autoPlay />
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ad Library</h1>
            <p className="text-sm text-gray-500 mt-0.5">Every ad you&apos;ve ever analyzed, in one searchable place.</p>
          </div>
          <a
            href={`${API}/api/export/csv`}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export CSV
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6">
        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search brand..."
              value={filters.brand}
              onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && fetchAds()}
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {/* Tone */}
          <select
            value={filters.tone}
            onChange={(e) => { const v = e.target.value; setFilters((f) => ({ ...f, tone: v })); fetchWithOverride({ tone: v }); }}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">Tone</option>
            {toneOptions.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          {/* Hook type */}
          <select
            value={filters.hook_type}
            onChange={(e) => { const v = e.target.value; setFilters((f) => ({ ...f, hook_type: v })); fetchWithOverride({ hook_type: v }); }}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">Hook type</option>
            {hookTypes.map((h) => <option key={h} value={h}>{h.replace("_", " ")}</option>)}
          </select>
          {/* Min days */}
          <input
            type="number"
            placeholder="Min days"
            value={filters.min_days}
            onChange={(e) => setFilters({ ...filters, min_days: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && fetchAds()}
            className="w-28 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {/* Active filter chips */}
          {(filters.brand || filters.tone || filters.hook_type || filters.min_days) && (
            <button
              onClick={() => { setFilters({ tone: "", hook_type: "", min_days: "", min_score: "", brand: "" }); fetchWithOverride({ tone: "", hook_type: "", min_days: "", min_score: "", brand: "" }); }}
              className="flex items-center gap-1 px-3 py-2 bg-red-50 border border-red-100 text-red-500 rounded-xl text-xs font-medium hover:bg-red-100 transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <div className="ml-auto text-sm text-gray-400">
            {loading ? "Loading..." : `${ads.length} ads`}
          </div>
        </div>

        {/* Table */}
        {!loading && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={ads.length > 0 && selected.size === ads.length}
                      onChange={selectAll}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                  </th>
                  {["Brand", "Hook", "Tone", "Hook Type", "CTA", "Score", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ads.map((ad) => (
                  <Fragment key={ad.id}>
                    <tr className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected.has(ad.id) ? "bg-blue-50" : ""}`}
                      onClick={() => window.location.href = `/results?ad=${ad.meta_library_id}`}>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(ad.id)}
                          onChange={() => toggleSelect(ad.id)}
                          className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{ad.brands?.name}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700" style={{maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{ad.ai_analysis?.hook || "—"}</td>
                      <td className="px-4 py-3">
                        {ad.ai_analysis?.tone && (
                          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{ad.ai_analysis.tone}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {ad.ai_analysis?.hook_type && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            {ad.ai_analysis.hook_type.replace("_", " ")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600" style={{maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{ad.ai_analysis?.cta || "—"}</td>
                      <td className="px-4 py-3 font-bold text-gray-700">
                        {ad.ai_analysis?.script_quality_score ? `${ad.ai_analysis.script_quality_score}/10` : "—"}
                      </td>
                      <td className="py-3 pr-4" style={{minWidth: 110}} onClick={(e) => e.stopPropagation()}>
                        <div style={{display:"flex", gap:4, alignItems:"center"}}>
                          {ad.video_url && (
                            <button onClick={() => setPlayer(ad)} title="Play"
                              style={{padding:"6px", borderRadius:"8px", color:"#6b7280", background:"none", border:"none", cursor:"pointer", display:"flex"}}>
                              <Play style={{width:16,height:16}} />
                            </button>
                          )}
                          <select
                            title="Send to client"
                            disabled={clients.length === 0 || sending}
                            value=""
                            onChange={async (e) => {
                              const val = e.target.value;
                              if (!val) return;
                              const [clientId, role] = val.split("::");
                              await sendToClient(ad, clientId, role as "client" | "competitor");
                              e.target.value = "";
                            }}
                            style={{padding:"4px 2px", borderRadius:"8px", color:"#6b7280", background:"none", border:"1px solid #e5e7eb", cursor:"pointer", fontSize:12, maxWidth:28, opacity: clients.length === 0 ? 0.4 : 1}}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="">↗</option>
                            {clients.map((c) => (
                              <optgroup key={c.id} label={`── ${c.name} ──`}>
                                <option value={`${c.id}::client`}>✦ {c.name} — client brand</option>
                                {(c.brands || []).filter((b: ClientBrand) => b.role === "competitor").map((b: ClientBrand) => (
                                  <option key={b.name} value={`${c.id}::competitor`}>⚔ → {b.name} (competitor)</option>
                                ))}
                                <option value={`${c.id}::competitor`}>+ New competitor in {c.name}</option>
                              </optgroup>
                            ))}
                          </select>
                          <button title="Delete permanently"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm("Permanently delete this ad?")) return;
                              await fetch(`${API}/api/ads/${ad.id}`, { method: "DELETE" });
                              setAds((prev) => prev.filter((a) => a.id !== ad.id));
                            }}
                            style={{padding:"6px", borderRadius:"8px", color:"#ef4444", background:"none", border:"none", cursor:"pointer", display:"flex"}}>
                            <Trash2 style={{width:16,height:16}} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
                {ads.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                      No ads found. <a href="/" className="text-blue-600 hover:underline">Analyze a brand first.</a>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sticky batch send bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-gray-900 text-white px-8 py-4 flex items-center gap-4 flex-wrap shadow-2xl">
          <span className="font-semibold text-sm">{selected.size} ad{selected.size > 1 ? "s" : ""} selected</span>
          <div className="flex-1" />
          <select
            value={batchDest}
            onChange={(e) => setBatchDest(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm focus:outline-none focus:border-blue-400 min-w-[220px]"
          >
            <option value="">Send to...</option>
            {clients.map((c) => (
              <optgroup key={c.id} label={`── ${c.name} ──`}>
                <option value={`${c.id}::client`}>✦ {c.name} — as Client brand</option>
                {(c.brands || []).filter((b: ClientBrand) => b.role === "competitor").map((b: ClientBrand) => (
                  <option key={b.name} value={`${c.id}::competitor`}>⚔ {c.name} → {b.name} (competitor)</option>
                ))}
                <option value={`${c.id}::competitor`}>+ Add as new competitor to {c.name}</option>
              </optgroup>
            ))}
          </select>
          <button
            onClick={sendBatch}
            disabled={batchSending || !batchDest}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            {batchDone ? <><Check className="w-4 h-4" /> Sent!</> :
             batchSending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> :
             <>Send {selected.size} ad{selected.size > 1 ? "s" : ""}</>}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-white ml-1">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
