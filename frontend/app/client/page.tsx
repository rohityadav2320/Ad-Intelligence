"use client";

import { useState, useEffect, Suspense, useCallback, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import { Play, Download, FileText, Sparkles, Plus, X, Loader2, Check, Search, Target, Swords, BookOpen, Wand2, Copy } from "lucide-react";

const InstaIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Brand { id: string; name: string; role: "client" | "competitor"; }
interface Client { id: string; name: string; brands: Brand[]; }
interface Ad {
  id: string;
  meta_library_id: string;
  brand_name: string;
  role: "client" | "competitor";
  days_running: number;
  performance_tier: "PROVEN" | "TESTING" | "NEW";
  video_url: string;
  ad_copy: string;
  transcripts: { full_text: string; hook_text: string } | null;
  ai_analysis: {
    hook: string; core_offer: string; cta: string; tone: string;
    hook_type: string; script_quality_score: number; why_it_works: string;
    target_audience: string; pain_points: string[];
  } | null;
}
interface InspirationReel {
  id: string;
  reel_url: string;
  video_url: string;
  transcript: string;
  hook_text: string;
  created_at: string;
}

interface LibraryAd {
  id: string;
  meta_library_id: string;
  days_running: number;
  performance_tier: string;
  video_url: string;
  brands: { name: string };
  ai_analysis: { hook: string; tone: string; script_quality_score: number } | null;
}

const TIER: Record<string, string> = {
  PROVEN: "bg-green-100 text-green-800",
  TESTING: "bg-yellow-100 text-yellow-800",
  NEW: "bg-gray-100 text-gray-600",
};

function ScriptDisplay({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm">
      {lines.map((line, i) => {
        const trimmed = line.trim();

        // CHARACTERS: header
        if (trimmed === "CHARACTERS:") return (
          <p key={i} className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-4 mb-1">Characters</p>
        );
        // Character bullet
        if (trimmed.startsWith("•")) return (
          <p key={i} className="text-gray-700 pl-2">{trimmed}</p>
        );
        // SCENE heading
        if (/^SCENE\s+\d+/i.test(trimmed) || trimmed === "🎯 CTA SCENE") return (
          <div key={i} className="mt-5 mb-1">
            <span className="inline-block bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">{trimmed}</span>
          </div>
        );
        // Location 📍
        if (trimmed.startsWith("📍")) return (
          <p key={i} className="text-xs text-gray-400 font-medium mt-1">{trimmed}</p>
        );
        // Situation 🎬
        if (trimmed.startsWith("🎬")) return (
          <p key={i} className="text-xs text-gray-500 italic mt-0.5 mb-2">{trimmed.replace("🎬", "").trim()}</p>
        );
        // Divider ---
        if (trimmed === "---" || trimmed === "═══════════════════════════") return (
          <hr key={i} className="border-gray-100 my-3" />
        );
        // Dialogue line — CHARACTER NAME: dialogue
        const dialogueMatch = trimmed.match(/^([A-Z][A-Z\s0-9]+):\s(.+)/);
        if (dialogueMatch) return (
          <div key={i} className="flex gap-2 mt-1">
            <span className="text-xs font-bold text-purple-600 shrink-0 mt-0.5 w-28 truncate">{dialogueMatch[1]}</span>
            <span className="text-gray-800 leading-relaxed">{dialogueMatch[2]}</span>
          </div>
        );
        // Empty line
        if (!trimmed) return <div key={i} className="h-1" />;
        // Default
        return <p key={i} className="text-gray-600 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

function ClientContent() {
  const params = useSearchParams();
  const clientId = params.get("id") || "";
  const [client, setClient] = useState<Client | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("ALL");
  const [showBrief, setShowBrief] = useState(false);
  const [brief, setBrief] = useState("");
  const [briefDocUrl, setBriefDocUrl] = useState("");
  const [docInput, setDocInput] = useState("");
  const [briefSaving, setBriefSaving] = useState(false);
  const [briefSaved, setBriefSaved] = useState(false);
  const [briefError, setBriefError] = useState("");

  // Adapt script modal (competitor → client)
  const [scriptModal, setScriptModal] = useState<{ ad: Ad } | null>(null);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState("");
  const [scriptCopied, setScriptCopied] = useState(false);

  // Double down modal
  const [ddModal, setDdModal] = useState<{ ad: Ad } | null>(null);
  const [generatingDD, setGeneratingDD] = useState(false);
  const [ddScripts, setDdScripts] = useState<{ label: string; script: string }[]>([]);
  const [ddCopied, setDdCopied] = useState<number | null>(null);
  const [ddSaved, setDdSaved] = useState<number | null>(null);
  const [adaptSaved, setAdaptSaved] = useState(false);

  // Cache generated results so reopening doesn't re-call API
  const [adaptCache, setAdaptCache] = useState<Record<string, string>>({}); // adId → script
  const [ddCache, setDdCache] = useState<Record<string, { label: string; script: string }[]>>({}); // adId → scripts

  // Saved script ad ids — persists across reloads (from DB)
  const [savedAdaptIds, setSavedAdaptIds] = useState<Set<string>>(new Set());
  const [savedDDIds, setSavedDDIds] = useState<Set<string>>(new Set());

  // Inspiration reels
  const [reels, setReels] = useState<InspirationReel[]>([]);
  const [reelInput, setReelInput] = useState("");
  const [reelLoading, setReelLoading] = useState(false);
  const [reelError, setReelError] = useState("");
  const [reelPlayer, setReelPlayer] = useState<string | null>(null);
  const [reelTranscript, setReelTranscript] = useState<string | null>(null);
  const [reelScriptModal, setReelScriptModal] = useState<InspirationReel | null>(null);
  const [reelScript, setReelScript] = useState("");
  const [generatingReelScript, setGeneratingReelScript] = useState(false);
  const [reelScriptCopied, setReelScriptCopied] = useState(false);
  const [reelCache, setReelCache] = useState<Record<string, string>>({});
  const [savedReelIds, setSavedReelIds] = useState<Set<string>>(new Set());

  // Fresh script
  const [freshModal, setFreshModal] = useState(false);
  const [freshPrompt, setFreshPrompt] = useState("");
  const [generatingFresh, setGeneratingFresh] = useState(false);
  const [freshScripts, setFreshScripts] = useState<{ label: string; script: string }[]>([]);
  const [freshSaved, setFreshSaved] = useState<number | null>(null);
  const [freshCopied, setFreshCopied] = useState<number | null>(null);

  // Multi-ad select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [multiModal, setMultiModal] = useState(false);
  const [generatingMulti, setGeneratingMulti] = useState(false);
  const [multiScripts, setMultiScripts] = useState<{ label: string; script: string }[]>([]);
  const [multiCopied, setMultiCopied] = useState<number | null>(null);
  const [multiSaved, setMultiSaved] = useState<number | null>(null);
  const [player, setPlayer] = useState<string | null>(null);
  const [openTranscript, setOpenTranscript] = useState<string | null>(null);
  const [openSummary, setOpenSummary] = useState<string | null>(null);

  // inline detail panel
  const [detailAd, setDetailAd] = useState<Ad | null>(null);
  const [detailShowTranscript, setDetailShowTranscript] = useState(false);
  const [detailShowAnalysis, setDetailShowAnalysis] = useState(false);

  // add competitor inline
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addDone, setAddDone] = useState(false);
  const [libraryBrands, setLibraryBrands] = useState<{ id: string; name: string }[]>([]);

  // select-from-library modal
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [modalRole, setModalRole] = useState<"client" | "competitor">("competitor");
  const [libraryAds, setLibraryAds] = useState<LibraryAd[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [sending, setSending] = useState<string | null>(null); // ad.id being sent
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!clientId) return;
    try {
      const [c, a, b, scripts, reelsData] = await Promise.all([
        fetch(`${API}/api/clients/${clientId}`).then((r) => r.json()),
        fetch(`${API}/api/clients/${clientId}/ads`).then((r) => r.json()),
        fetch(`${API}/api/clients/${clientId}/brief`).then((r) => r.json()),
        fetch(`${API}/api/scripts?client_id=${clientId}`).then((r) => r.json()),
        fetch(`${API}/api/instagram/reels?client_id=${clientId}`).then((r) => r.json()),
      ]);
      setClient(c);
      setAds(a);
      setBrief(b.brief || "");
      setBriefDocUrl(b.brief_doc_url || "");
      setDocInput(b.brief_doc_url || "");

      // Build sets of which ad ids have saved scripts by type
      const adaptIds = new Set<string>();
      const ddIds = new Set<string>();
      const reelSavedIds = new Set<string>();
      const reelCacheFromDb: Record<string, string> = {};
      if (Array.isArray(scripts)) {
        for (const s of scripts) {
          if (s.type === "adapted" && s.ad_id) adaptIds.add(s.ad_id);
          if (s.type === "doubledown" && s.ad_id) ddIds.add(s.ad_id);
          if (s.reel_id) {
            reelSavedIds.add(s.reel_id);
            reelCacheFromDb[s.reel_id] = s.script_text; // pre-load so "View Script" shows saved text
          }
        }
      }
      setSavedAdaptIds(adaptIds);
      setSavedDDIds(ddIds);
      setSavedReelIds(reelSavedIds);
      setReelCache(reelCacheFromDb);
      setReels(Array.isArray(reelsData) ? reelsData : []);
    } catch (e) {
      console.error("[load] failed:", e);
    }
    setLoading(false);
  }, [clientId]);

  const saveBrief = async () => {
    setBriefSaving(true);
    setBriefError("");
    try {
      const res = await fetch(`${API}/api/clients/${clientId}/brief`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_doc_url: docInput.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        setBriefError(d.detail || "Failed to fetch doc");
      } else {
        setBriefDocUrl(docInput.trim());
        // Refresh brief text
        const b = await fetch(`${API}/api/clients/${clientId}/brief`).then(r => r.json());
        setBrief(b.brief || "");
        setBriefSaved(true);
        setTimeout(() => setBriefSaved(false), 2500);
      }
    } catch {
      setBriefError("Could not connect to backend");
    }
    setBriefSaving(false);
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch(`${API}/api/brands`).then((r) => r.json()).then(setLibraryBrands).catch(() => {});
  }, []);

  const openLibraryModal = async (role: "client" | "competitor") => {
    setModalRole(role);
    setShowLibraryModal(true);
    setLibrarySearch("");
    setSentIds(new Set());
    setLibraryLoading(true);
    try {
      const data = await fetch(`${API}/api/library?limit=200`).then((r) => r.json());
      setLibraryAds(data);
    } catch {}
    setLibraryLoading(false);
  };

  const sendAdToClient = async (ad: LibraryAd) => {
    setSending(ad.id);
    try {
      const res = await fetch(`${API}/api/clients/${clientId}/link-ad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_id: ad.id, role: modalRole }),
      });
      if (res.ok) {
        setSentIds((prev) => new Set(prev).add(ad.id));
        load();
      }
    } catch {}
    setSending(null);
  };

  const addCompetitor = async () => {
    const name = query.trim();
    if (!name || !clientId) return;
    setAdding(true); setAddError("");
    try {
      const res = await fetch(`${API}/api/clients/${clientId}/link-brand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_name: name, role: "competitor" }),
      });
      if (res.ok) {
        setAddDone(true);
        await load();
        setActiveTab(name);
        setTimeout(() => { setShowAdd(false); setQuery(""); setAddDone(false); }, 800);
      } else {
        const d = await res.json().catch(() => ({}));
        setAddError(d.detail || "Something went wrong.");
      }
    } catch { setAddError("Could not connect."); }
    setAdding(false);
  };

  const saveScript = async (adId: string, type: string, label: string, scriptText: string, idx?: number) => {
    await fetch(`${API}/api/scripts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, ad_id: adId, type, label, script_text: scriptText }),
    });
    // Update saved ID sets immediately so button updates without reload
    if (type === "adapted") setSavedAdaptIds(prev => new Set(prev).add(adId));
    if (type === "doubledown") setSavedDDIds(prev => new Set(prev).add(adId));

    if (idx !== undefined) {
      setDdSaved(idx);
      setTimeout(() => setDdSaved(null), 2500);
    } else {
      setAdaptSaved(true);
      setTimeout(() => setAdaptSaved(false), 2500);
    }
  };

  const loadSavedAdapt = async (ad: Ad) => {
    setScriptModal({ ad });
    setScriptCopied(false);
    setAdaptSaved(false);
    if (adaptCache[ad.id]) { setGeneratedScript(adaptCache[ad.id]); return; }
    setGeneratedScript("");
    setGeneratingScript(true);
    try {
      const scripts = await fetch(`${API}/api/scripts?client_id=${clientId}`).then(r => r.json());
      const match = Array.isArray(scripts) ? scripts.find((s: any) => s.ad_id === ad.id && s.type === "adapted") : null;
      if (match) {
        setGeneratedScript(match.script_text);
        setAdaptCache(prev => ({ ...prev, [ad.id]: match.script_text }));
      }
    } catch {}
    setGeneratingScript(false);
  };

  const loadSavedDD = async (ad: Ad) => {
    setDdModal({ ad });
    setDdCopied(null);
    setDdSaved(null);
    if (ddCache[ad.id]) { setDdScripts(ddCache[ad.id]); return; }
    setDdScripts([]);
    setGeneratingDD(true);
    try {
      const scripts = await fetch(`${API}/api/scripts?client_id=${clientId}`).then(r => r.json());
      const matches = Array.isArray(scripts) ? scripts.filter((s: any) => s.ad_id === ad.id && s.type === "doubledown") : [];
      const formatted = matches.map((s: any) => ({ label: s.label, script: s.script_text }));
      if (formatted.length) {
        setDdScripts(formatted);
        setDdCache(prev => ({ ...prev, [ad.id]: formatted }));
      }
    } catch {}
    setGeneratingDD(false);
  };

  const openScriptModal = async (ad: Ad, forceRegenerate = false) => {
    setScriptModal({ ad });
    setScriptCopied(false);
    setAdaptSaved(false);

    // Use cache unless regenerating
    if (!forceRegenerate && adaptCache[ad.id]) {
      setGeneratedScript(adaptCache[ad.id]);
      return;
    }

    setGeneratedScript("");
    setGeneratingScript(true);
    try {
      const res = await fetch(`${API}/api/generate-script/adapt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_id: ad.id, client_id: clientId }),
      });
      const d = await res.json();
      const script = d.script || "Could not generate script.";
      setGeneratedScript(script);
      setAdaptCache(prev => ({ ...prev, [ad.id]: script }));
    } catch {
      setGeneratedScript("Error: Could not connect to backend.");
    }
    setGeneratingScript(false);
  };

  const copyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    setScriptCopied(true);
    setTimeout(() => setScriptCopied(false), 2000);
  };

  const openDDModal = async (ad: Ad, forceRegenerate = false) => {
    setDdModal({ ad });
    setDdCopied(null);
    setDdSaved(null);

    // Use cache unless regenerating
    if (!forceRegenerate && ddCache[ad.id]) {
      setDdScripts(ddCache[ad.id]);
      return;
    }

    setDdScripts([]);
    setGeneratingDD(true);
    try {
      const res = await fetch(`${API}/api/generate-script/doubledown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_id: ad.id, client_id: clientId }),
      });
      const d = await res.json();
      const scripts = d.scripts || [];
      setDdScripts(scripts);
      setDdCache(prev => ({ ...prev, [ad.id]: scripts }));
    } catch {
      setDdScripts([{ label: "Error", script: "Could not connect to backend." }]);
    }
    setGeneratingDD(false);
  };

  const runFreshScripts = async () => {
    if (!freshPrompt.trim()) return;
    setGeneratingFresh(true);
    setFreshScripts([]);
    setFreshSaved(null);
    setFreshCopied(null);
    try {
      const res = await fetch(`${API}/api/generate-script/fresh`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, prompt: freshPrompt }),
      });
      const data = await res.json();
      setFreshScripts(data.scripts || []);
    } catch { setFreshScripts([{ label: "Error", script: "Failed to generate. Try again." }]); }
    setGeneratingFresh(false);
  };

  const runMultiDown = async (forceRegenerate = false) => {
    setMultiModal(true);
    if (!forceRegenerate && multiScripts.length) return; // use cached
    setMultiScripts([]);
    setMultiCopied(null);
    setMultiSaved(null);
    setGeneratingMulti(true);
    try {
      const res = await fetch(`${API}/api/generate-script/multidown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_ids: Array.from(selectedIds), client_id: clientId }),
      });
      const d = await res.json();
      setMultiScripts(d.scripts || []);
    } catch {
      setMultiScripts([{ label: "Error", script: "Could not connect to backend." }]);
    }
    setGeneratingMulti(false);
  };

  const addReel = async () => {
    const url = reelInput.trim();
    if (!url) return;
    setReelError("");
    setReelLoading(true);
    try {
      const res = await fetch(`${API}/api/instagram/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, client_id: clientId }),
      });
      const d = await res.json();
      if (!res.ok) { setReelError(d.detail || "Failed to download"); }
      else { setReels(prev => [d, ...prev.filter(r => r.id !== d.id)]); setReelInput(""); }
    } catch { setReelError("Could not connect to backend"); }
    setReelLoading(false);
  };

  const deleteReel = async (id: string) => {
    await fetch(`${API}/api/instagram/reels/${id}`, { method: "DELETE" });
    setReels(prev => prev.filter(r => r.id !== id));
  };

  const openReelScript = async (reel: InspirationReel, forceRegenerate = false) => {
    setReelScriptModal(reel);
    setReelScriptCopied(false);
    if (!forceRegenerate && reelCache[reel.id]) { setReelScript(reelCache[reel.id]); return; }
    setReelScript("");
    setGeneratingReelScript(true);
    try {
      const res = await fetch(`${API}/api/generate-script/inspiration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reel_id: reel.id, client_id: clientId }),
      });
      const d = await res.json();
      const s = d.script || "Could not generate script.";
      setReelScript(s);
      setReelCache(prev => ({ ...prev, [reel.id]: s }));
    } catch { setReelScript("Error connecting to backend."); }
    setGeneratingReelScript(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const brands = client?.brands || [];
  const clientBrandName = client?.name || "";
  const competitors = brands.filter((b) => b.role === "competitor");

  const filtered =
    activeTab === "ALL"
      ? ads
      : activeTab === clientBrandName
      ? ads.filter((a) => a.role === "client")
      : ads.filter((a) => a.brand_name === activeTab);
  const playerAd = ads.find((a) => a.id === player);

  const suggestions = libraryBrands.filter(
    (b) => query.length > 0 && b.name.toLowerCase().includes(query.toLowerCase()) &&
    !brands.find((br) => br.name.toLowerCase() === b.name.toLowerCase())
  );

  const filteredLibraryAds = libraryAds.filter((a) =>
    !librarySearch || a.brands?.name?.toLowerCase().includes(librarySearch.toLowerCase()) ||
    a.ai_analysis?.hook?.toLowerCase().includes(librarySearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Video modal */}
      {playerAd?.video_url && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setPlayer(null)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPlayer(null)} className="absolute -top-10 right-0 text-white text-sm">✕ Close</button>
            <video src={playerAd.video_url.startsWith('http') ? playerAd.video_url : `${API}${playerAd.video_url}`} className="max-h-[80vh] max-w-[90vw] rounded-lg" controls autoPlay />
          </div>
        </div>
      )}

      {/* Ad Detail modal */}
      {detailAd && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-6" onClick={() => setDetailAd(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${
                  detailAd.performance_tier === "PROVEN" ? "bg-green-100 text-green-800 border-green-300" :
                  detailAd.performance_tier === "TESTING" ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
                  "bg-gray-100 text-gray-600 border-gray-300"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${detailAd.performance_tier === "PROVEN" ? "bg-green-500" : detailAd.performance_tier === "TESTING" ? "bg-yellow-500" : "bg-gray-400"}`} />
                  {detailAd.days_running}d · {detailAd.performance_tier}
                </span>
                <span className="text-sm text-gray-400">{detailAd.brand_name}</span>
              </div>
              <div className="flex items-center gap-3">
                {detailAd.ai_analysis?.script_quality_score && (
                  <span className="text-lg font-bold text-gray-700">{detailAd.ai_analysis.script_quality_score}/10</span>
                )}
                <button onClick={() => setDetailAd(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-6">
              {/* Video + info */}
              <div className="flex gap-4 mb-5">
                {detailAd.video_url && (
                  <div className="w-40 h-28 bg-gray-100 rounded-xl flex-shrink-0 overflow-hidden relative cursor-pointer group"
                    onClick={() => setPlayer(detailAd.id)}>
                    <video src={detailAd.video_url.startsWith('http') ? detailAd.video_url : `${API}${detailAd.video_url}`} className="w-full h-full object-cover"
                      muted
                      onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                      onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-white/90 rounded-full p-2"><Play className="w-5 h-5 text-gray-900 fill-gray-900" /></div>
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {detailAd.ai_analysis?.hook && (
                    <p className="text-gray-900 font-semibold text-base mb-3">&ldquo;{detailAd.ai_analysis.hook}&rdquo;</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {detailAd.ai_analysis?.tone && <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">{detailAd.ai_analysis.tone}</span>}
                    {detailAd.ai_analysis?.hook_type && <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{detailAd.ai_analysis.hook_type.replace("_", " ")}</span>}
                    {detailAd.ai_analysis?.cta && <span className="text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">CTA: {detailAd.ai_analysis.cta}</span>}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 border-t border-gray-100 pt-4 mb-4">
                <button onClick={() => { setDetailShowAnalysis(!detailShowAnalysis); setDetailShowTranscript(false); }}
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${detailShowAnalysis ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:text-purple-600 hover:bg-purple-50"}`}>
                  <Sparkles className="w-4 h-4" /> AI Summary
                </button>
                <button onClick={() => { setDetailShowTranscript(!detailShowTranscript); setDetailShowAnalysis(false); }}
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${detailShowTranscript ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:text-blue-600 hover:bg-blue-50"}`}>
                  <FileText className="w-4 h-4" /> Transcript
                </button>
                {detailAd.video_url && (
                  <a href={detailAd.video_url.startsWith('http') ? detailAd.video_url : `${API}/api/download?path=${encodeURIComponent(detailAd.video_url)}`}
                    target="_blank" rel="noopener noreferrer" download
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors ml-auto">
                    <Download className="w-4 h-4" /> Download
                  </a>
                )}
              </div>

              {/* AI Analysis */}
              {detailShowAnalysis && detailAd.ai_analysis && (
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  {[
                    { label: "Core Offer", value: detailAd.ai_analysis.core_offer },
                    { label: "Target Audience", value: detailAd.ai_analysis.target_audience },
                    { label: "Why It Works", value: detailAd.ai_analysis.why_it_works },
                    { label: "Pain Points", value: Array.isArray(detailAd.ai_analysis.pain_points) ? detailAd.ai_analysis.pain_points.join(", ") : detailAd.ai_analysis.pain_points },
                  ].map(({ label, value }) => value && (
                    <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="text-xs text-gray-400 font-medium mb-1">{label}</div>
                      <div className="text-gray-800">{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Transcript */}
              {detailShowTranscript && (
                <div className="bg-gray-50 rounded-xl p-4 text-sm">
                  {detailAd.transcripts?.hook_text && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <div className="text-xs text-blue-600 font-semibold mb-1">HOOK (first 3 seconds)</div>
                      <div className="text-blue-900 font-medium">{detailAd.transcripts.hook_text}</div>
                    </div>
                  )}
                  <div className="text-gray-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {detailAd.transcripts?.full_text || <span className="text-gray-400 italic">Transcript not available</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Client Brief panel */}
      {showBrief && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-6" onClick={() => { setShowBrief(false); setBriefError(""); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Client Brief — {client?.name}</h2>
                <p className="text-sm text-gray-400 mt-0.5">Link a Google Doc. AI will read it when writing scripts.</p>
              </div>
              <button onClick={() => { setShowBrief(false); setBriefError(""); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6">
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Google Doc URL</label>
              <p className="text-xs text-gray-400 mb-3">Make sure the doc is set to <span className="font-medium text-gray-600">"Anyone with the link can view"</span></p>
              <input
                value={docInput}
                onChange={(e) => { setDocInput(e.target.value); setBriefError(""); }}
                placeholder="https://docs.google.com/document/d/..."
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 font-mono"
              />
              {briefError && <p className="mt-2 text-sm text-red-500">{briefError}</p>}

              {/* Preview if already saved */}
              {brief && (
                <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="text-xs text-gray-400 font-medium mb-2 flex items-center justify-between">
                    <span>LAST FETCHED CONTENT PREVIEW</span>
                    <span>{brief.length} chars</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-4 whitespace-pre-wrap">{brief}</p>
                </div>
              )}
            </div>

            <div className="px-6 pb-5 flex justify-between items-center">
              {briefDocUrl && (
                <a href={briefDocUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Open doc ↗</a>
              )}
              <div className="flex gap-3 ml-auto">
                <button onClick={() => { setShowBrief(false); setBriefError(""); }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                <button
                  onClick={saveBrief}
                  disabled={briefSaving || !docInput.trim()}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {briefSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching...</> : briefSaved ? <><Check className="w-4 h-4" /> Synced!</> : "Fetch & Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi Down Modal */}
      {/* ── Fresh Script Modal ── */}
      {freshModal && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-6" onClick={() => setFreshModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" /> Write Fresh Script for {client?.name}
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">AI uses client brief + proven ads + competitor intel to write from scratch</p>
              </div>
              <button onClick={() => setFreshModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Prompt input */}
            {!generatingFresh && freshScripts.length === 0 && (
              <div className="px-6 py-6 flex flex-col gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">What should this script be about?</label>
                  <p className="text-xs text-gray-400 mb-3">Give direction — a scenario, emotion, character, hook idea, or angle. The more specific, the better.</p>
                  <textarea
                    autoFocus
                    rows={4}
                    value={freshPrompt}
                    onChange={e => setFreshPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runFreshScripts(); }}
                    placeholder={`e.g. "A CA guy who realizes he's been overpaying on his loan EMI for 2 years" or "Husband and wife argument about money that Oolka solves" or "College student who just got his first job"`}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-400 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-2">⌘+Enter to generate</p>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={runFreshScripts}
                    disabled={!freshPrompt.trim()}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> Generate 2 Scripts
                  </button>
                </div>
              </div>
            )}

            {/* Generating */}
            {generatingFresh && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-sm text-gray-400">Reading brief + {brief ? "client requirements, " : ""}analysing proven ads → writing fresh scripts...</p>
              </div>
            )}

            {/* Scripts output */}
            {!generatingFresh && freshScripts.length > 0 && (
              <>
                <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
                  {freshScripts.map((s, i) => (
                    <div key={i} className="px-6 py-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">{s.label}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { navigator.clipboard.writeText(s.script); setFreshCopied(i); setTimeout(() => setFreshCopied(null), 2000); }}
                            className="text-xs flex items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50">
                            {freshCopied === i ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                          </button>
                          <button onClick={async () => {
                            await fetch(`${API}/api/scripts`, {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ client_id: clientId, type: "fresh", label: s.label, script_text: s.script }),
                            });
                            setFreshSaved(i);
                          }}
                            className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-colors ${freshSaved === i ? "bg-green-100 text-green-700" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
                            {freshSaved === i ? <><Check className="w-3.5 h-3.5" /> Saved</> : "Save to Scripts →"}
                          </button>
                        </div>
                      </div>
                      <ScriptDisplay text={s.script} />
                    </div>
                  ))}
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-400">Based on: {brief ? "client brief · " : ""}{ads.filter(a => a.role === "client").length} client ads · {ads.filter(a => a.role === "competitor").length} competitor ads</p>
                  <button onClick={() => { setFreshScripts([]); setFreshSaved(null); }}
                    className="text-sm text-gray-400 hover:text-emerald-600 flex items-center gap-1.5">
                    <Wand2 className="w-4 h-4" /> Try different prompt
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {multiModal && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-6" onClick={() => setMultiModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg">🧠</span>
                  <h2 className="text-lg font-bold text-gray-900">Script Using {selectedIds.size} Ads That Worked</h2>
                </div>
                <p className="text-xs text-gray-400">AI found the common pattern across your selected winning ads and wrote 2 new scripts from it</p>
              </div>
              <button onClick={() => setMultiModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex gap-2 flex-wrap text-xs text-indigo-700">
              {Array.from(selectedIds).map(id => {
                const ad = ads.find(a => a.id === id);
                return ad ? (
                  <span key={id} className="bg-white border border-indigo-200 px-2 py-0.5 rounded-full">
                    &ldquo;{ad.ai_analysis?.hook?.slice(0, 35) || ad.brand_name}&rdquo;
                  </span>
                ) : null;
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {generatingMulti ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
                  <p className="text-sm text-gray-400">Decoding {selectedIds.size} ads → finding master pattern → writing scripts...</p>
                  <p className="text-xs text-gray-300">This takes ~20 seconds</p>
                </div>
              ) : multiScripts.map((s, i) => (
                <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-600">{s.label}</span>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { navigator.clipboard.writeText(s.script); setMultiCopied(i); setTimeout(() => setMultiCopied(null), 2000); }}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        {multiCopied === i ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                      </button>
                      <button
                        onClick={async () => {
                          // Save with reference to first selected ad
                          const firstId = Array.from(selectedIds)[0];
                          await fetch(`${API}/api/scripts`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ client_id: clientId, ad_id: firstId, type: "doubledown", label: `[Multi] ${s.label}`, script_text: s.script }),
                          });
                          setMultiSaved(i);
                          setTimeout(() => setMultiSaved(null), 2500);
                        }}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                      >
                        {multiSaved === i ? <><Check className="w-3.5 h-3.5" /> Saved!</> : "Save to Scripts →"}
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <ScriptDisplay text={s.script} />
                  </div>
                </div>
              ))}
            </div>

            {!generatingMulti && multiScripts.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
                <button onClick={() => runMultiDown(true)} className="text-sm text-gray-400 hover:text-indigo-600 transition-colors">
                  ↻ Generate 2 more
                </button>
                <span className="text-xs text-gray-400">Based on {selectedIds.size} winning ads</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Script Generator Modal */}
      {scriptModal && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-6" onClick={() => setScriptModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Wand2 className="w-4 h-4 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-900">Adapted Script for {client?.name}</h2>
                </div>
                <p className="text-xs text-gray-400">
                  Based on competitor ad — &ldquo;{scriptModal.ad.ai_analysis?.hook?.slice(0, 60) || scriptModal.ad.brand_name}&rdquo;
                </p>
              </div>
              <button onClick={() => setScriptModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Context strip */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex gap-4 text-xs text-gray-500 flex-wrap">
              <span>📹 <strong>{scriptModal.ad.brand_name}</strong> competitor ad</span>
              {scriptModal.ad.ai_analysis?.tone && <span>🎭 {scriptModal.ad.ai_analysis.tone}</span>}
              {scriptModal.ad.ai_analysis?.hook_type && <span>🪝 {scriptModal.ad.ai_analysis.hook_type.replace("_", " ")}</span>}
              {!brief && <span className="text-orange-500">⚠ No client brief saved — add one for better results</span>}
            </div>

            {/* Script output */}
            <div className="flex-1 overflow-y-auto p-6">
              {generatingScript ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-purple-500" />
                  <p className="text-sm text-gray-400">Decoding psychology + writing script...</p>
                </div>
              ) : (
                <ScriptDisplay text={generatedScript} />
              )}
            </div>

            {/* Footer */}
            {!generatingScript && generatedScript && (
              <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
                <button
                  onClick={() => openScriptModal(scriptModal.ad, true)}
                  className="text-sm text-gray-400 hover:text-purple-600 flex items-center gap-1.5 transition-colors"
                >
                  <Wand2 className="w-4 h-4" /> Regenerate
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={copyScript}
                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
                  >
                    {scriptCopied ? <><Check className="w-4 h-4 text-green-500" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                  </button>
                  <button
                    onClick={() => saveScript(scriptModal.ad.id, "adapted", `Adapted from ${scriptModal.ad.brand_name}`, generatedScript)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 flex items-center gap-2"
                  >
                    {adaptSaved ? <><Check className="w-4 h-4" /> Saved to Scripts</> : "Save to Scripts →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Double Down Modal */}
      {ddModal && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-6" onClick={() => setDdModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg">⚡</span>
                  <h2 className="text-lg font-bold text-gray-900">Double Down — 2 New Scripts</h2>
                </div>
                <p className="text-xs text-gray-400">
                  Based on winning format — &ldquo;{ddModal.ad.ai_analysis?.hook?.slice(0, 60) || ddModal.ad.brand_name}&rdquo;
                </p>
              </div>
              <button onClick={() => setDdModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Context strip */}
            <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex gap-4 text-xs text-amber-700 flex-wrap">
              <span>🎯 Proven format from <strong>{ddModal.ad.brand_name}</strong></span>
              {ddModal.ad.ai_analysis?.tone && <span>🎭 {ddModal.ad.ai_analysis.tone}</span>}
              {ddModal.ad.ai_analysis?.hook_type && <span>🪝 {ddModal.ad.ai_analysis.hook_type.replace("_", " ")}</span>}
              {!brief && <span className="text-red-500 font-medium">⚠ No client brief — add one for better results</span>}
            </div>

            {/* Scripts */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {generatingDD ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
                  <p className="text-sm text-gray-400">Generating 2 variations...</p>
                </div>
              ) : ddScripts.map((s, i) => (
                <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Script header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-600">{s.label}</span>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(s.script);
                          setDdCopied(i);
                          setTimeout(() => setDdCopied(null), 2000);
                        }}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        {ddCopied === i ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                      </button>
                      <button
                        onClick={() => saveScript(ddModal.ad.id, "doubledown", s.label, s.script, i)}
                        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
                      >
                        {ddSaved === i ? <><Check className="w-3.5 h-3.5" /> Saved!</> : "Save to Scripts →"}
                      </button>
                    </div>
                  </div>
                  {/* Script content */}
                  <div className="p-4">
                    <ScriptDisplay text={s.script} />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            {!generatingDD && ddScripts.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
                <button
                  onClick={() => openDDModal(ddModal.ad, true)}
                  className="text-sm text-gray-400 hover:text-amber-600 flex items-center gap-1.5 transition-colors"
                >
                  ↻ Generate 2 more
                </button>
                <span className="text-xs text-gray-400">2 variations generated</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Select from Library modal */}
      {showLibraryModal && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-6" onClick={() => setShowLibraryModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Select ads from library</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Adding as{" "}
                  <button onClick={() => setModalRole("client")} className={`font-semibold px-1.5 py-0.5 rounded ${modalRole === "client" ? "bg-emerald-100 text-emerald-700" : "text-gray-400 hover:text-gray-600"}`}>
                    <Target className="w-3 h-3 inline mr-0.5" />client brand
                  </button>
                  {" / "}
                  <button onClick={() => setModalRole("competitor")} className={`font-semibold px-1.5 py-0.5 rounded ${modalRole === "competitor" ? "bg-orange-100 text-orange-700" : "text-gray-400 hover:text-gray-600"}`}>
                    <Swords className="w-3 h-3 inline mr-0.5" />competitor
                  </button>
                  {" "}to <span className="text-gray-800">{client?.name}</span>
                </p>
              </div>
              <button onClick={() => setShowLibraryModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search by brand or hook..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            {/* Ad list */}
            <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
              {libraryLoading ? (
                <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
              ) : filteredLibraryAds.length === 0 ? (
                <div className="py-16 text-center text-gray-400">No ads found.</div>
              ) : filteredLibraryAds.map((ad) => {
                const isSent = sentIds.has(ad.id);
                const isSending = sending === ad.id;
                return (
                  <div key={ad.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50">
                    {/* Brand + hook */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-800">{ad.brands?.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TIER[ad.performance_tier] || ""}`}>{ad.days_running}d</span>
                        {ad.ai_analysis?.tone && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">{ad.ai_analysis.tone}</span>}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{ad.ai_analysis?.hook || "—"}</p>
                    </div>
                    {/* Score */}
                    {ad.ai_analysis?.script_quality_score && (
                      <span className="text-sm font-bold text-gray-600 shrink-0">{ad.ai_analysis.script_quality_score}/10</span>
                    )}
                    {/* Add button */}
                    <button
                      onClick={() => sendAdToClient(ad)}
                      disabled={isSent || isSending}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                        isSent
                          ? "bg-emerald-100 text-emerald-700 cursor-default"
                          : modalRole === "client"
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-orange-500 text-white hover:bg-orange-600"
                      } disabled:opacity-60`}
                    >
                      {isSent ? <><Check className="w-3.5 h-3.5" /> Added</> :
                       isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                       modalRole === "client" ? <><Target className="w-3.5 h-3.5" /> Add as client</> :
                       <><Swords className="w-3.5 h-3.5" /> Add as competitor</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs text-gray-400 mb-1">
            <a href="/clients" className="hover:text-gray-600">Clients</a> / {client?.name || "Client"}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg font-bold">
                {(client?.name || "C").charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{client?.name || "Client"}</h1>
                <p className="text-sm text-gray-500">
                  {brands.filter((b) => b.role === "client").length} client brand · {competitors.length} competitors · {ads.length} ads
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Brief button — shows green dot if brief is filled */}
              <button
                onClick={() => setShowBrief(true)}
                className="px-4 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Client Brief
                {brief && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
              </button>
              {/* Write Fresh Script */}
              <button
                onClick={() => { setFreshModal(true); setFreshScripts([]); setFreshPrompt(""); }}
                className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Write Fresh Script
              </button>
              {/* Pick winning ads → AI finds pattern → write scripts */}
              <button
                onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectMode
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                }`}
                title="Select 2+ winning ads — AI finds what made them work and writes new scripts from that pattern"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1 2-2h11"/></svg>
                {selectMode ? "Cancel selection" : "Script Using Multiple Ads"}
              </button>
              {/* Instagram Reel Inspiration */}
              <button
                onClick={() => { setActiveTab("__inspiration__"); setShowAdd(false); setSelectMode(false); setSelectedIds(new Set()); }}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === "__inspiration__"
                    ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md"
                    : "border border-pink-300 text-pink-600 bg-pink-50 hover:bg-pink-100"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
                Reel Inspiration
              </button>
              {/* Select from Library button */}
              <button
                onClick={() => openLibraryModal("competitor")}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Search className="w-4 h-4" /> Select ads from library
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6">
        {/* Floating Multi-Down bar */}
        {selectMode && selectedIds.size >= 2 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
            <span className="text-sm font-medium">{selectedIds.size} winning ads selected</span>
            <button
              onClick={() => runMultiDown()}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              ✦ Find pattern & write scripts
            </button>
            <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Brand tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
              activeTab === "ALL" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            All Ads ({ads.length})
          </button>

          {clientBrandName && (
            <button
              onClick={() => setActiveTab(clientBrandName)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
                activeTab === clientBrandName ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              {clientBrandName}
              <span className="text-xs text-gray-400">({ads.filter((a) => a.role === "client").length})</span>
            </button>
          )}

          {competitors.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveTab(c.name)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
                activeTab === c.name ? "border-orange-500 text-orange-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
              {c.name}
              <span className="text-xs text-gray-400">({ads.filter((a) => a.brand_name === c.name).length})</span>
            </button>
          ))}

          {/* Inspiration tab removed from here — now a header button */}

          <button
            onClick={() => { setShowAdd((v) => !v); setQuery(""); setAddError(""); setAddDone(false); }}
            className="ml-2 px-3 py-2 text-sm text-gray-400 hover:text-blue-600 flex items-center gap-1 shrink-0 transition-colors"
          >
            {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAdd ? "Cancel" : "Add competitor"}
          </button>
          <div className="ml-auto" />
        </div>

        {/* Add competitor inline form */}
        {showAdd && activeTab !== "__inspiration__" && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5 flex items-start gap-3 flex-wrap shadow-sm">
            <div className="relative flex-1 min-w-[220px]">
              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setAddError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") addCompetitor(); if (e.key === "Escape") setShowAdd(false); }}
                placeholder="Competitor brand name..."
                className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
              />
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                  {suggestions.slice(0, 6).map((b) => (
                    <button key={b.id} onClick={() => setQuery(b.name)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0">
                      {b.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={addCompetitor}
              disabled={adding || !query.trim()}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2 shrink-0"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : addDone ? <><Check className="w-4 h-4" /> Added</> : "Add"}
            </button>
            {addError && <div className="w-full text-sm text-red-600">{addError}</div>}
          </div>
        )}

        {/* Reel script modal */}
        {reelScriptModal && (
          <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-6" onClick={() => setReelScriptModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <InstaIcon />
                    <h2 className="text-lg font-bold text-gray-900">Script for {client?.name}</h2>
                  </div>
                  <p className="text-xs text-gray-400">Based on Instagram Reel format</p>
                </div>
                <button onClick={() => setReelScriptModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {generatingReelScript ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-pink-400" />
                    <p className="text-sm text-gray-400">Decoding reel format → writing script for {client?.name}...</p>
                  </div>
                ) : <ScriptDisplay text={reelScript} />}
              </div>
              {!generatingReelScript && reelScript && (
                <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
                  <button onClick={() => openReelScript(reelScriptModal, true)} className="text-sm text-gray-400 hover:text-pink-500 flex items-center gap-1.5">
                    <Wand2 className="w-4 h-4" /> Regenerate
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(reelScript); setReelScriptCopied(true); setTimeout(() => setReelScriptCopied(false), 2000); }}
                      className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                      {reelScriptCopied ? <><Check className="w-4 h-4 text-green-500" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                    </button>
                    <button onClick={async () => {
                      if (!reelScriptModal) return;
                      await fetch(`${API}/api/scripts`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ client_id: clientId, reel_id: reelScriptModal.id, type: "adapted", label: `From Insta Reel`, script_text: reelScript }),
                      });
                      setSavedReelIds(prev => new Set(prev).add(reelScriptModal.id));
                      setReelScriptModal(null);
                    }} className="px-4 py-2 bg-pink-500 text-white rounded-xl text-sm font-medium hover:bg-pink-600 flex items-center gap-2">
                      Save to Scripts →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Inspiration Tab Content */}
        {activeTab === "__inspiration__" ? (
          <div>
            {/* Paste reel URL */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
              <label className="text-sm font-semibold text-gray-700 mb-1 block">Paste Instagram Reel link</label>
              <p className="text-xs text-gray-400 mb-3">Any public reel — content creator, viral format, ad style you liked</p>
              <div className="flex gap-3">
                <input
                  value={reelInput}
                  onChange={e => { setReelInput(e.target.value); setReelError(""); }}
                  onKeyDown={e => e.key === "Enter" && addReel()}
                  placeholder="https://www.instagram.com/reel/..."
                  disabled={reelLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-pink-400 font-mono"
                />
                <button
                  onClick={addReel}
                  disabled={reelLoading || !reelInput.trim()}
                  className="px-5 py-2.5 bg-pink-500 text-white rounded-xl text-sm font-semibold hover:bg-pink-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {reelLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Downloading...</> : "Add Reel"}
                </button>
              </div>
              {reelError && <p className="mt-2 text-sm text-red-500">{reelError}</p>}
            </div>

            {/* Reels grid */}
            {reels.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <span className="text-4xl block text-center mb-3 opacity-30">📷</span>
                <p className="font-medium">No reels yet</p>
                <p className="text-sm mt-1">Paste an Instagram Reel link above to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {reels.map(reel => (
                  <div key={reel.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="flex gap-4 p-4">
                      {/* Video */}
                      <div className="shrink-0">
                        {reel.video_url ? (
                          <div className="w-24 h-16 bg-gray-100 rounded-xl overflow-hidden relative cursor-pointer group"
                            onClick={() => setReelPlayer(reel.video_url)}>
                            <video src={reel.video_url.startsWith('http') ? reel.video_url : `${API}${reel.video_url}`} className="w-full h-full object-cover" muted
                              onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
                              onMouseLeave={e => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="bg-white/90 rounded-full p-1.5"><Play className="w-3.5 h-3.5 fill-gray-900 text-gray-900" /></div>
                            </div>
                          </div>
                        ) : <div className="w-24 h-16 bg-gray-100 rounded-xl flex items-center justify-center"><span className="text-gray-300">📷</span></div>}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <a href={reel.reel_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-pink-500 hover:underline truncate max-w-[300px] font-mono">
                            {reel.reel_url.replace("https://www.instagram.com/", "instagram.com/")}
                          </a>
                          <button onClick={() => deleteReel(reel.id)} className="text-gray-300 hover:text-red-400 shrink-0 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Hook / transcript preview */}
                        {reel.hook_text && (
                          <p className="text-sm text-gray-700 font-medium mb-1">&ldquo;{reel.hook_text}&rdquo;</p>
                        )}
                        {reel.transcript && (
                          <p className="text-xs text-gray-400 line-clamp-2">{reel.transcript}</p>
                        )}

                        {/* Transcript toggle */}
                        <button onClick={() => setReelTranscript(reelTranscript === reel.id ? null : reel.id)}
                          className="text-xs text-blue-500 hover:text-blue-700 mt-1.5 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {reelTranscript === reel.id ? "Hide transcript" : "View transcript"}
                        </button>
                      </div>

                      {/* Make script button */}
                      <div className="shrink-0 flex items-center">
                        <button
                          onClick={() => openReelScript(reel)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${
                            savedReelIds.has(reel.id) ? "bg-green-100 text-green-700 hover:bg-green-200" :
                            reelCache[reel.id] ? "bg-pink-100 text-pink-700 hover:bg-pink-200" : "bg-pink-500 text-white hover:bg-pink-600"
                          }`}
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          {savedReelIds.has(reel.id) ? "View Script ✓" : reelCache[reel.id] ? "View Script" : `Make for ${client?.name}`}
                        </button>
                      </div>
                    </div>

                    {/* Transcript expanded */}
                    {reelTranscript === reel.id && reel.transcript && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                        <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-sans">{reel.transcript}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Ads table — hidden when Inspiration tab active */}
        {activeTab !== "__inspiration__" && (loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : ads.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="mb-4">No ads yet.</p>
            <button onClick={() => openLibraryModal("competitor")} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-2 mx-auto">
              <Search className="w-4 h-4" /> Select ads from library
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No ads for this brand yet.</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {selectMode && <th className="px-4 py-3 w-8" />}
                    {["Video", "Days", "Hook", "Tone", "Hook Type", "CTA", "Score", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((ad) => {
                    const ai = ad.ai_analysis;
                    return (
                      <Fragment key={ad.id}>
                        <tr
                          className={`hover:bg-gray-50 cursor-pointer ${selectMode && selectedIds.has(ad.id) ? "bg-indigo-50" : ""}`}
                          onClick={() => { if (selectMode) { toggleSelect(ad.id); } else { setDetailAd(ad); setDetailShowTranscript(false); setDetailShowAnalysis(false); } }}
                        >
                          {selectMode && (
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(ad.id)}
                                onChange={() => toggleSelect(ad.id)}
                                className="w-4 h-4 accent-indigo-600 cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {ad.video_url ? (
                              <button onClick={() => setPlayer(ad.id)} className="w-14 h-9 bg-gray-100 rounded flex items-center justify-center hover:bg-gray-200">
                                <Play className="w-4 h-4 text-gray-600 fill-gray-600" />
                              </button>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER[ad.performance_tier]}`}>{ad.days_running}d</span>
                          </td>
                          <td className="px-4 py-3 text-gray-800 max-w-xs"><div className="line-clamp-2">{ai?.hook || "—"}</div></td>
                          <td className="px-4 py-3">{ai?.tone && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full whitespace-nowrap">{ai.tone}</span>}</td>
                          <td className="px-4 py-3">{ai?.hook_type && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">{ai.hook_type.replace("_", " ")}</span>}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-[160px]"><div className="line-clamp-2">{ai?.cta || "—"}</div></td>
                          <td className="px-4 py-3 font-bold text-gray-700 whitespace-nowrap">{ai?.script_quality_score ? `${ai.script_quality_score}/10` : "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2 items-center">
                              {/* Competitor: Copy Script + Double Down */}
                              {ad.role === "competitor" && (
                                <>
                                  {(savedAdaptIds.has(ad.id) || adaptCache[ad.id]) ? (
                                    <button
                                      onClick={() => savedAdaptIds.has(ad.id) && !adaptCache[ad.id] ? loadSavedAdapt(ad) : openScriptModal(ad)}
                                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                                    >
                                      <Check className="w-3 h-3" /> View Script
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openScriptModal(ad)}
                                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors"
                                    >
                                      <Wand2 className="w-3.5 h-3.5" /> Copy Script
                                    </button>
                                  )}
                                  {(savedDDIds.has(ad.id) || ddCache[ad.id]) ? (
                                    <button
                                      onClick={() => savedDDIds.has(ad.id) && !ddCache[ad.id] ? loadSavedDD(ad) : openDDModal(ad)}
                                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                                    >
                                      <Check className="w-3 h-3" /> View Scripts
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openDDModal(ad)}
                                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
                                    >
                                      ⚡ Double Down
                                    </button>
                                  )}
                                </>
                              )}
                              {/* Client: Double Down only */}
                              {ad.role === "client" && (
                                (savedDDIds.has(ad.id) || ddCache[ad.id]) ? (
                                  <button
                                    onClick={() => savedDDIds.has(ad.id) && !ddCache[ad.id] ? loadSavedDD(ad) : openDDModal(ad)}
                                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                                  >
                                    <Check className="w-3 h-3" /> View Scripts
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => openDDModal(ad)}
                                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
                                  >
                                    ⚡ Double Down
                                  </button>
                                )
                              )}
                              <button onClick={() => { setOpenSummary(openSummary === ad.id ? null : ad.id); setOpenTranscript(null); }} className="text-gray-400 hover:text-purple-600" title="AI Summary"><Sparkles className="w-4 h-4" /></button>
                              <button onClick={() => { setOpenTranscript(openTranscript === ad.id ? null : ad.id); setOpenSummary(null); }} className="text-gray-400 hover:text-blue-600" title="Transcript"><FileText className="w-4 h-4" /></button>
                              {ad.video_url && <a href={ad.video_url.startsWith('http') ? ad.video_url : `${API}/api/download?path=${encodeURIComponent(ad.video_url)}`} target="_blank" rel="noopener noreferrer" download className="text-gray-400 hover:text-blue-600" title="Download"><Download className="w-4 h-4" /></a>}
                              <button
                                onClick={async () => {
                                  if (!confirm("Remove this ad from this client workspace?")) return;
                                  await fetch(`${API}/api/clients/${clientId}/ads/${ad.id}`, { method: "DELETE" });
                                  load();
                                }}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                                title="Remove from workspace"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {openSummary === ad.id && ai && (
                          <tr key={`${ad.id}-s`}>
                            <td colSpan={8} className="px-4 py-4 bg-purple-50/40">
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {[
                                  { label: "Core Offer", value: ai.core_offer },
                                  { label: "Target Audience", value: ai.target_audience },
                                  { label: "Why It Works", value: ai.why_it_works },
                                  { label: "Pain Points", value: Array.isArray(ai.pain_points) ? ai.pain_points.join(", ") : ai.pain_points },
                                ].map(({ label, value }) => value && (
                                  <div key={label} className="bg-white rounded-lg p-3 border border-gray-100">
                                    <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
                                    <div className="text-gray-800">{value}</div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                        {openTranscript === ad.id && (
                          <tr key={`${ad.id}-t`}>
                            <td colSpan={8} className="px-4 py-4 bg-gray-50">
                              {ad.transcripts?.hook_text && (
                                <div className="mb-2 text-sm"><span className="text-blue-600 font-semibold">HOOK: </span>{ad.transcripts.hook_text}</div>
                              )}
                              <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{ad.transcripts?.full_text || "No transcript"}</div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Video player for reels */}
        {reelPlayer && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setReelPlayer(null)}>
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setReelPlayer(null)} className="absolute -top-10 right-0 text-white text-sm">✕ Close</button>
              <video src={`${API}${reelPlayer}`} className="max-h-[80vh] max-w-[90vw] rounded-lg" controls autoPlay />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>}>
      <ClientContent />
    </Suspense>
  );
}
