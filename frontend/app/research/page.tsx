"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface ClientBrand { name: string; role: "client" | "competitor"; }
interface Client { id: string; name: string; brands: ClientBrand[]; }

export default function ResearchPage() {
  const [links, setLinks] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [dest, setDest] = useState(""); // "clientId::role"
  const [analyzing, setAnalyzing] = useState(false);
  const [sessions, setSessions] = useState<string[]>([]);
  const [progress, setProgress] = useState<{done: number; total: number; current: string}>({done: 0, total: 0, current: ""});
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API}/api/clients`).then(r => r.json()).then(setClients).catch(() => {});
  }, []);

  // Parse links from textarea — one per line, filter valid Meta Ad Library URLs
  const parseLinks = () => {
    return links.split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 10 && l.includes("facebook.com/ads"));
  };

  const extractMetaId = (url: string) => {
    const m = url.match(/[?&]id=(\d+)/);
    return m ? m[1] : null;
  };

  // Poll sessions → redirect when all done
  useEffect(() => {
    if (!sessions.length) return;
    const iv = setInterval(async () => {
      try {
        let done = 0;
        let lastCompleted: string | null = null;
        for (const sid of sessions) {
          const s = await fetch(`${API}/api/sessions/${sid}`).then(r => r.json());
          if (s.status === "completed" || s.status === "failed") {
            done++;
            if (s.status === "completed") lastCompleted = sid;
          }
        }
        setProgress(p => ({ ...p, done }));
        if (done === sessions.length) {
          setAnalyzing(false);
          setSessions([]);
          // If single ad redirect to results, else to library
          if (sessions.length === 1 && lastCompleted) {
            const s = await fetch(`${API}/api/sessions/${lastCompleted}`).then(r => r.json());
            const metaId = s.input_brand?.match?.(/[?&]id=(\d+)/)?.[1];
            window.location.href = metaId
              ? `/results?ad=${encodeURIComponent(metaId)}`
              : `/library`;
          } else {
            window.location.href = `/library`;
          }
        }
      } catch {}
    }, 3000);
    return () => clearInterval(iv);
  }, [sessions]);

  const analyze = async () => {
    const urlList = parseLinks();
    if (!urlList.length) { setErr("Paste at least one Meta Ad Library link"); return; }
    setErr(""); setAnalyzing(true);
    const [destClientId, destRole] = dest ? dest.split("::") : ["", "competitor"];
    const newSessions: string[] = [];

    setProgress({ done: 0, total: urlList.length, current: "" });

    for (const url of urlList) {
      try {
        const res = await fetch(`${API}/api/analyze-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ad_url: url,
            client_id: destClientId || null,
            role: destRole || "competitor",
          }),
        });
        const d = await res.json();
        if (d.session_id) newSessions.push(d.session_id);
      } catch {
        setErr("Could not connect to backend");
        setAnalyzing(false);
        return;
      }
    }
    setSessions(newSessions);
  };

  const cancel = async () => {
    for (const sid of sessions) {
      try { await fetch(`${API}/api/sessions/${sid}/cancel`, { method: "POST" }); } catch {}
    }
    setAnalyzing(false);
    setSessions([]);
  };

  const urlCount = parseLinks().length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">New Analysis</h1>
          <p className="text-sm text-gray-500 mt-0.5">Paste one or multiple Meta Ad Library links — we scrape, transcribe and analyze all of them.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">

          {/* Textarea */}
          <label className="text-sm font-semibold text-gray-700 mb-1 block">
            Meta Ad Library links
          </label>
          <p className="text-xs text-gray-400 mb-3">
            Paste one link per line. Single ad or multiple ads — works for both.
          </p>
          <textarea
            value={links}
            onChange={e => setLinks(e.target.value)}
            disabled={analyzing}
            rows={6}
            placeholder={`https://www.facebook.com/ads/library/?id=123456789\nhttps://www.facebook.com/ads/library/?id=987654321\nhttps://www.facebook.com/ads/library/?id=111222333`}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono resize-none"
          />

          {/* Link count pill */}
          {urlCount > 0 && (
            <p className="mt-2 text-xs text-blue-600 font-medium">{urlCount} ad{urlCount > 1 ? "s" : ""} detected</p>
          )}

          {/* Save to client */}
          {clients.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Save to client workspace <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={dest}
                onChange={e => setDest(e.target.value)}
                disabled={analyzing}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[260px]"
              >
                <option value="">Don't save to any client</option>
                {clients.map(c => (
                  <optgroup key={c.id} label={`── ${c.name} ──`}>
                    <option value={`${c.id}::client`}>✦ {c.name} — as client brand</option>
                    {(c.brands || []).filter(b => b.role === "competitor").map(b => (
                      <option key={b.name} value={`${c.id}::competitor`}>⚔ {b.name} (competitor)</option>
                    ))}
                    <option value={`${c.id}::competitor`}>+ Add as new competitor to {c.name}</option>
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

          {/* Progress */}
          {analyzing && (
            <div className="mt-4 bg-blue-50 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">
                  Processing {progress.done}/{progress.total} ads...
                </span>
                <button onClick={cancel} className="text-xs text-red-500 hover:text-red-700 font-medium">Stop</button>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : "0%" }}
                />
              </div>
            </div>
          )}

          {/* Analyze button */}
          <div className="mt-4 flex justify-end">
            {analyzing ? (
              <button onClick={cancel} className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Stop
              </button>
            ) : (
              <button
                onClick={analyze}
                disabled={!urlCount}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Analyze {urlCount > 0 ? `${urlCount} ad${urlCount > 1 ? "s" : ""}` : ""} →
              </button>
            )}
          </div>
        </div>

        {/* Steps */}
        <div className="mt-4 bg-blue-50/50 border border-blue-100 rounded-2xl p-5">
          <div className="text-sm font-semibold text-gray-700 mb-3">What happens</div>
          <div className="flex items-center gap-2">
            {[
              { n: 1, top: "Download", sub: "videos" },
              { n: 2, top: "Transcribe", sub: "ElevenLabs" },
              { n: 3, top: "AI analysis", sub: "hook, tone, score" },
              { n: 4, top: "Save", sub: "to library" },
            ].map((st, i, arr) => (
              <div key={st.n} className="flex items-center gap-2 flex-1">
                <div className="flex-1 text-center">
                  <div className="w-9 h-9 mx-auto rounded-full bg-white border border-blue-200 flex items-center justify-center text-blue-600 font-bold text-sm">{st.n}</div>
                  <div className="text-xs text-gray-600 mt-1.5">{st.top}<br />{st.sub}</div>
                </div>
                {i < arr.length - 1 && <div className="w-6 border-t border-dashed border-blue-300 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
