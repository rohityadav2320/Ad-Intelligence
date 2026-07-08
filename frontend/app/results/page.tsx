"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Download, ChevronDown, ChevronUp, Play, ArrowLeft, FileText } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Ad {
  id: string;
  days_running: number;
  performance_tier: "PROVEN" | "TESTING" | "NEW";
  video_url: string;
  thumbnail_url: string;
  ad_copy: string;
  platforms: string[];
  brands: { name: string; category: string };
  transcripts: { full_text: string; hook_text: string } | null;
  ai_analysis: {
    hook: string;
    core_offer: string;
    cta: string;
    tone: string;
    pain_points: string[];
    target_audience: string;
    why_it_works: string;
    script_quality_score: number;
    hook_type: string;
  } | null;
}

const TIER_STYLES = {
  PROVEN: "bg-green-100 text-green-800 border-green-300",
  TESTING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  NEW: "bg-gray-100 text-gray-600 border-gray-300",
};

const TIER_DOT = {
  PROVEN: "bg-green-500",
  TESTING: "bg-yellow-500",
  NEW: "bg-gray-400",
};

function AdCard({ ad }: { ad: Ad }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const ai = ad.ai_analysis;
  const tr = ad.transcripts;
  const tier = ad.performance_tier as keyof typeof TIER_STYLES;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Full-screen video player modal */}
      {showPlayer && ad.video_url && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
          onClick={() => setShowPlayer(false)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPlayer(false)}
              className="absolute -top-10 right-0 text-white text-sm hover:text-gray-300"
            >
              ✕ Close
            </button>
            <video
              src={ad.video_url.startsWith('http') ? ad.video_url : `${API}${ad.video_url}`}
              className="max-h-[80vh] max-w-[90vw] rounded-lg"
              controls
              autoPlay
            />
          </div>
        </div>
      )}

      <div className="p-5 flex gap-4">
        {/* Video/Thumbnail — click to open full player */}
        <div
          className="w-32 h-20 bg-gray-100 rounded-xl flex-shrink-0 overflow-hidden relative cursor-pointer group"
          onClick={() => ad.video_url && setShowPlayer(true)}
        >
          {ad.video_url ? (
            <>
              <video
                src={ad.video_url.startsWith('http') ? ad.video_url : `${API}${ad.video_url}`}
                className="w-full h-full object-cover"
                controls={false}
                muted
                onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                onMouseLeave={(e) => {
                  const v = e.currentTarget as HTMLVideoElement;
                  v.pause();
                  v.currentTime = 0;
                }}
              />
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-white/90 rounded-full p-2">
                  <Play className="w-5 h-5 text-gray-900 fill-gray-900" />
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1.5 ${TIER_STYLES[tier]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[tier]}`} />
                {ad.days_running}d · {tier}
              </span>
              {ad.platforms.map((p) => (
                <span key={p} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full capitalize">{p}</span>
              ))}
            </div>
            {(ai?.script_quality_score ?? 0) > 0 && (
              <span className="text-sm font-bold text-gray-700 flex-shrink-0">
                {ai!.script_quality_score}/10
              </span>
            )}
          </div>

          {/* Hook */}
          {ai?.hook && (
            <p className="text-gray-900 font-medium text-sm mb-1">
              &ldquo;{ai.hook}&rdquo;
            </p>
          )}

          {/* Quick tags */}
          <div className="flex gap-2 flex-wrap">
            {ai?.tone && (
              <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">{ai.tone}</span>
            )}
            {ai?.hook_type && (
              <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{ai.hook_type}</span>
            )}
            {ai?.cta && (
              <span className="text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">CTA: {ai.cta}</span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-3 flex gap-2 border-t border-gray-100 pt-3">
        <button
          onClick={() => setShowAnalysis(!showAnalysis)}
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 font-medium transition-colors"
        >
          {showAnalysis ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          AI Summary
        </button>
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 font-medium transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          Transcript
        </button>
        {ad.video_url && (
          <a
            href={`${API}/api/download?path=${encodeURIComponent(ad.video_url)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 font-medium transition-colors ml-auto"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
        )}
      </div>

      {/* AI Analysis Expanded */}
      {showAnalysis && ai && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: "Core Offer", value: ai.core_offer },
              { label: "Target Audience", value: ai.target_audience },
              { label: "Why It Works", value: ai.why_it_works },
              { label: "Pain Points", value: Array.isArray(ai.pain_points) ? ai.pain_points.join(", ") : ai.pain_points },
            ].map(({ label, value }) => value && (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
                <div className="text-gray-800">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transcript Expanded */}
      {showTranscript && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          {tr?.hook_text && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="text-xs text-blue-600 font-semibold mb-1">HOOK (first 3 seconds)</div>
              <div className="text-blue-900 font-medium">{tr.hook_text}</div>
            </div>
          )}
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {tr?.full_text || <span className="text-gray-400 italic">Transcript not available yet</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const brand = searchParams.get("brand") || "";
  const adMeta = searchParams.get("ad") || "";  // single-ad view by Meta ID
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    if (adMeta) {
      // Single ad view
      fetch(`${API}/api/ad-by-meta/${encodeURIComponent(adMeta)}`)
        .then((r) => r.json())
        .then((data) => { setAds(data && data.id ? [data] : []); setLoading(false); })
        .catch(() => setLoading(false));
      return;
    }
    if (!brand) return;
    fetch(`${API}/api/ads?brand=${encodeURIComponent(brand)}&limit=50`)
      .then((r) => r.json())
      .then((data) => { setAds(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [brand, adMeta]);

  const filtered = filter === "ALL" ? ads : ads.filter((a) => a.performance_tier === filter);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/library" className="text-gray-400 hover:text-gray-600 transition-colors" title="Back to Ad Library">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {adMeta ? (ads[0]?.brands?.name || "Single Ad") : (brand || "Results")}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {adMeta ? "Single ad from link" : `${ads.length} ads analyzed · sorted by days running`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Tier filters only make sense in brand view with multiple ads */}
            {!adMeta && ["ALL", "PROVEN", "TESTING", "NEW"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  filter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f}
              </button>
            ))}
            {!adMeta && brand && (
              <a
                href={`${API}/api/export/csv?brand=${brand}`}
                className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-700 transition-colors flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> Export CSV
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading ads...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            No ads found. <a href="/" className="text-blue-600 hover:underline">Start a new analysis</a>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((ad) => <AdCard key={ad.id} ad={ad} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
