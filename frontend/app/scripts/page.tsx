"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Check, Trash2, Play, X, Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface SavedScript {
  id: string;
  client_id: string;
  ad_id: string | null;
  reel_id: string | null;
  type: "adapted" | "doubledown" | "fresh";
  label: string;
  script_text: string;
  created_at: string;
  ai_clients: { name: string } | null;
  ads: {
    meta_library_id: string;
    video_url: string;
    brands: { name: string } | null;
    ai_analysis: { hook: string; tone: string; hook_type: string } | null;
  } | null;
  inspiration_reels: { reel_url: string; video_url: string } | null;
}

interface Client { id: string; name: string; }

function ScriptDisplay({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed === "CHARACTERS:") return (
          <p key={i} className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-4 mb-1">Characters</p>
        );
        if (trimmed.startsWith("•")) return (
          <p key={i} className="text-gray-700 pl-2">{trimmed}</p>
        );
        if (/^SCENE\s+\d+/i.test(trimmed) || trimmed === "🎯 CTA SCENE") return (
          <div key={i} className="mt-5 mb-1">
            <span className="inline-block bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">{trimmed}</span>
          </div>
        );
        if (trimmed.startsWith("📍")) return (
          <p key={i} className="text-xs text-gray-400 font-medium mt-1">{trimmed}</p>
        );
        if (trimmed.startsWith("🎬")) return (
          <p key={i} className="text-xs text-gray-500 italic mt-0.5 mb-2">{trimmed.replace("🎬", "").trim()}</p>
        );
        if (trimmed === "---" || trimmed === "═══════════════════════════") return (
          <hr key={i} className="border-gray-100 my-3" />
        );
        const dialogueMatch = trimmed.match(/^([A-Z][A-Z\s0-9]+):\s(.+)/);
        if (dialogueMatch) return (
          <div key={i} className="flex gap-2 mt-1">
            <span className="text-xs font-bold text-purple-600 shrink-0 mt-0.5 w-28 truncate">{dialogueMatch[1]}</span>
            <span className="text-gray-800 leading-relaxed">{dialogueMatch[2]}</span>
          </div>
        );
        if (!trimmed) return <div key={i} className="h-1" />;
        return <p key={i} className="text-gray-600 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

function ScriptsPageInner() {
  const searchParams = useSearchParams();
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filterClient, setFilterClient] = useState("ALL");
  const [filterType, setFilterType] = useState(searchParams.get("type") || "ALL");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [player, setPlayer] = useState<string | null>(null); // video_url
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        fetch(`${API}/api/scripts`).then(r => r.json()),
        fetch(`${API}/api/clients`).then(r => r.json()),
      ]);
      setScripts(Array.isArray(s) ? s : []);
      setClients(Array.isArray(c) ? c : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deleteScript = async (id: string) => {
    if (!confirm("Delete this script?")) return;
    await fetch(`${API}/api/scripts/${id}`, { method: "DELETE" });
    setScripts(prev => prev.filter(s => s.id !== id));
  };

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = scripts.filter(s => {
    if (filterClient !== "ALL" && s.client_id !== filterClient) return false;
    if (filterType === "reel") return !!s.reel_id;
    if (filterType !== "ALL" && s.type !== filterType) return false;
    return true;
  });

  // Group by client
  const grouped: Record<string, SavedScript[]> = {};
  for (const s of filtered) {
    const key = s.ai_clients?.name || "Unknown Client";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Video player modal */}
      {player && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setPlayer(null)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPlayer(null)} className="absolute -top-10 right-0 text-white text-sm">✕ Close</button>
            <video src={`${API}${player}`} className="max-h-[80vh] max-w-[90vw] rounded-lg" controls autoPlay />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scripts</h1>
            <p className="text-sm text-gray-500 mt-0.5">{scripts.length} saved scripts — fresh, copied & doubled down</p>
          </div>
          {/* Filters */}
          <div className="flex items-center gap-3">
            <select
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none"
            >
              <option value="ALL">All clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex bg-gray-100 rounded-xl p-1">
              {[["ALL", "All"], ["fresh", "Fresh"], ["adapted", "Copied"], ["doubledown", "Doubled Down"], ["reel", "From Reels"]].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilterType(val)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterType === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-6 space-y-8">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium mb-2">No scripts saved yet</p>
            <p className="text-sm">Go to a client workspace, click <strong>Copy Script</strong> or <strong>⚡ Double Down</strong>, then save to see them here.</p>
          </div>
        ) : Object.entries(grouped).map(([clientName, clientScripts]) => (
          <div key={clientName}>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{clientName}</h2>
            <div className="space-y-3">
              {clientScripts.map(s => {
                const ad = s.ads;
                const reel = s.inspiration_reels;
                const isReel = !!s.reel_id;
                const videoUrl = reel?.video_url || ad?.video_url || null;
                const isExpanded = expanded === s.id;
                const preview = s.script_text.slice(0, 120) + (s.script_text.length > 120 ? "..." : "");

                // Badge
                let badge = { label: "⚡ Doubled Down", cls: "bg-amber-100 text-amber-700" };
                if (isReel) badge = { label: "🎬 Inspiration", cls: "bg-pink-100 text-pink-700" };
                else if (s.type === "fresh") badge = { label: "✨ Fresh", cls: "bg-emerald-100 text-emerald-700" };
                else if (s.type === "adapted") badge = { label: "Copied", cls: "bg-purple-100 text-purple-700" };

                return (
                  <div key={s.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="flex gap-4 p-4">
                      {/* Reference video thumbnail */}
                      <div className="shrink-0">
                        {videoUrl ? (
                          <div
                            className="w-20 h-14 bg-gray-100 rounded-xl overflow-hidden relative cursor-pointer group"
                            onClick={() => setPlayer(videoUrl)}
                          >
                            <video
                              src={`${API}${videoUrl}`}
                              className="w-full h-full object-cover"
                              muted
                              onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
                              onMouseLeave={e => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="bg-white/90 rounded-full p-1.5"><Play className="w-3.5 h-3.5 fill-gray-900 text-gray-900" /></div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-20 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
                            <Play className="w-5 h-5 text-gray-300" />
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1 text-center truncate w-20">
                          {isReel ? "Instagram" : ad?.brands?.name || "—"}
                        </p>
                      </div>

                      {/* Script content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                              {badge.label}
                            </span>
                            <span className="text-xs text-gray-500">{s.label}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => copyText(s.id, s.script_text)}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title="Copy script"
                            >
                              {copied === s.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => deleteScript(s.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Reference ad context (only for non-reel ads) */}
                        {!isReel && ad?.ai_analysis && (
                          <div className="flex gap-2 mb-2 flex-wrap">
                            {ad.ai_analysis.tone && <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">{ad.ai_analysis.tone}</span>}
                            {ad.ai_analysis.hook_type && <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{ad.ai_analysis.hook_type.replace("_", " ")}</span>}
                            {ad.ai_analysis.hook && <span className="text-[10px] text-gray-400 truncate max-w-[300px]">ref: &ldquo;{ad.ai_analysis.hook.slice(0, 60)}&rdquo;</span>}
                          </div>
                        )}
                        {isReel && reel?.reel_url && (
                          <div className="mb-2">
                            <a href={reel.reel_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-pink-500 hover:text-pink-700 truncate max-w-[300px] block">
                              {reel.reel_url.replace("https://www.", "").slice(0, 50)}…
                            </a>
                          </div>
                        )}

                        {/* Script preview / expanded */}
                        <div className="text-sm text-gray-700">
                          {isExpanded ? (
                            <ScriptDisplay text={s.script_text} />
                          ) : (
                            <p className="text-gray-500 leading-relaxed">{preview}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setExpanded(isExpanded ? null : s.id)}
                          className="text-xs text-blue-500 hover:text-blue-700 mt-1.5 font-medium"
                        >
                          {isExpanded ? "Show less ↑" : "Read full script ↓"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Suspense } from "react";
export default function ScriptsPage() {
  return <Suspense><ScriptsPageInner /></Suspense>;
}
