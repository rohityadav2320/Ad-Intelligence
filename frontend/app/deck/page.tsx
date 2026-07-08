"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Search, Mic, ImageIcon, PenLine, Brain, BarChart2,
  Clapperboard, Users, Wand2, Database, Clock,
  ChevronLeft, ChevronRight, Link, Check, Megaphone,
} from "lucide-react";

/* ── Data ──────────────────────────────────────────────────── */
const PROBLEMS = [
  {
    Icon: Search,
    title: "Hours of manual scrolling",
    desc: "Finding winning competitor ads meant scrolling Meta Ad Library and Instagram by hand, for hours, per client.",
  },
  {
    Icon: Mic,
    title: "No way to analyze what worked",
    desc: "There was no easy way to transcribe an ad or break down why it actually converted.",
  },
  {
    Icon: ImageIcon,
    title: "Insights never got reused",
    desc: "Findings lived in scattered screenshots and notes, forgotten right after the pitch.",
  },
  {
    Icon: PenLine,
    title: "Scripts started from zero",
    desc: "Writers began from a blank page instead of learning from ads already proven to work.",
  },
];

const FEATURES = [
  { Icon: Megaphone, title: "Scrape any brand's ads",   desc: "Meta Ad Library — or a single ad link — pulled automatically." },
  { Icon: Mic,       title: "Auto-transcription",         desc: "Every ad's audio and dialogue, transcribed instantly." },
  { Icon: Brain,     title: "AI breakdown",               desc: "Hook, tone, CTA, pain points, audience, and a quality score." },
  { Icon: BarChart2, title: "Performance tiers",          desc: "Proven / Testing / New — the longest-running ads are working." },
  { Icon: Clapperboard, title: "Reel inspiration",         desc: "Paste any Instagram reel link, get an instant transcript." },
  { Icon: Users,     title: "Client workspaces",          desc: "Organize competitors and inspiration separately per client." },
  { Icon: Wand2,     title: "One-click scripts",          desc: 'Fresh, adapted from competitor ads, or "Double Down" variations.' },
  { Icon: Database,  title: "Central library",            desc: "Every ad and script — searchable and reusable by the whole team." },
];

const STATS = [
  { Icon: Clock,    big: "Hours → Minutes",  label: "Competitor research time, cut dramatically" },
  { Icon: Brain,    big: "Data-Driven",       label: "Scripts grounded in ads proven to work, not guesswork" },
  { Icon: Users,    big: "One Shared Tool",   label: "No more scattered screenshots or outdated notes" },
  { Icon: Wand2,    big: "4 Script Modes",    label: "Copy Script · Double Down · Write New · Copy Insta Reel" },
];

const SLIDE_LABELS = ["Title", "Problem", "Features", "Impact"];

/* ── Logo SVG (shared) ─────────────────────────────────────── */
function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="9" fill="#0B0F19" />
      <rect x="1" y="1" width="34" height="34" rx="8.5" stroke="#1e3a8a" strokeWidth="1.5" />
      {/* A legs */}
      <path d="M10 27L18 9L26 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Blue crossbar = intelligence */}
      <path d="M13.5 21.5h9" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
      {/* Apex spark */}
      <circle cx="18" cy="9" r="2.2" fill="#2563EB" />
    </svg>
  );
}

/* ── Slides ────────────────────────────────────────────────── */
function Slide1() {
  return (
    <div
      className="h-full flex flex-col justify-center px-16 overflow-hidden"
      style={{ background: "#0B0F19" }}
    >
      {/* Decorative orbs */}
      <div className="absolute -top-32 right-0 w-[620px] h-[620px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 right-20 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)" }} />

      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-blue-900/50"
        style={{ background: "#2563EB" }}>
        <Brain size={30} className="text-white" />
      </div>

      <p className="text-blue-500 text-xs font-bold tracking-[0.22em] uppercase mb-4">Built for Vidrow</p>
      <h1 className="text-7xl font-extrabold text-white tracking-tight leading-none mb-6">
        Ad<br />Intelligence
      </h1>
      <p className="text-xl text-slate-400 max-w-xl leading-relaxed">
        Competitor Ad Research &amp; Script Generation, Automated.
      </p>
    </div>
  );
}

function Slide2() {
  return (
    <div
      className="h-full flex flex-col justify-center px-16 py-10"
      style={{ background: "#F8FAFC" }}
    >
      <p className="text-blue-600 text-xs font-bold tracking-[0.22em] uppercase mb-2">The Problem</p>
      <h2 className="text-4xl font-extrabold text-slate-900 mb-8 max-w-2xl leading-tight">
        Creative research was slow, manual, and easy to lose
      </h2>
      <div className="grid grid-cols-2 gap-4 max-w-4xl">
        {PROBLEMS.map(({ Icon, title, desc }) => (
          <div key={title} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "#DBEAFE" }}>
              <Icon size={17} className="text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm mb-1.5">{title}</p>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide3() {
  return (
    <div
      className="h-full flex flex-col justify-center px-16 py-10"
      style={{ background: "#F8FAFC" }}
    >
      <p className="text-blue-600 text-xs font-bold tracking-[0.22em] uppercase mb-2">What It Does</p>
      <h2 className="text-[2.4rem] font-extrabold text-slate-900 mb-6 leading-tight">
        One tool, from competitor research to a ready script
      </h2>
      <div className="grid grid-cols-4 gap-3">
        {FEATURES.map(({ Icon, title, desc }) => (
          <div key={title} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="w-9 h-9 rounded-full flex items-center justify-center mb-3" style={{ background: "#EFF6FF" }}>
              <Icon size={15} className="text-blue-600" />
            </div>
            <p className="font-bold text-slate-900 text-sm mb-1.5 leading-snug">{title}</p>
            <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide4() {
  return (
    <div
      className="h-full flex flex-col justify-center px-16 overflow-hidden"
      style={{ background: "#0B0F19" }}
    >
      <div className="absolute -bottom-24 -left-24 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.10) 0%, transparent 70%)" }} />

      <p className="text-blue-500 text-xs font-bold tracking-[0.22em] uppercase mb-2">Why It Matters</p>
      <h2 className="text-4xl font-extrabold text-white mb-8 leading-tight max-w-2xl">
        From hours of scrolling to minutes of insight
      </h2>
      <div className="grid grid-cols-2 gap-4 max-w-4xl">
        {STATS.map(({ Icon, big, label }) => (
          <div key={big} className="rounded-2xl p-5 flex items-start gap-4" style={{ background: "#141A2A" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(37,99,235,0.18)" }}>
              <Icon size={15} className="text-blue-400" />
            </div>
            <div>
              <p className="font-extrabold text-blue-400 text-lg mb-1 leading-tight">{big}</p>
              <p className="text-slate-400 text-sm leading-relaxed">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SLIDES = [Slide1, Slide2, Slide3, Slide4];
const SLIDE_COUNT = SLIDES.length;

/* ── Page ──────────────────────────────────────────────────── */
export default function DeckPage() {
  const [current, setCurrent] = useState(0);
  const [copied, setCopied] = useState(false);

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent((c) => Math.min(SLIDE_COUNT - 1, c + 1)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const Slide = SLIDES[current];
  const isDark = current === 0 || current === 3;

  return (
    /* Fixed overlay — covers the sidebar completely */
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: isDark ? "#0B0F19" : "#F8FAFC", transition: "background 0.3s ease" }}
    >
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header
        className={`flex items-center justify-between px-8 py-3 border-b shrink-0 ${
          isDark ? "border-white/10" : "border-slate-200"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <LogoMark size={30} />
          <span className={`font-bold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
            Ad Intelligence
          </span>
          <span className={`text-xs ${isDark ? "text-white/30" : "text-slate-400"}`}>by Vidrow</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Slide label pill */}
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              isDark ? "bg-white/10 text-white/50" : "bg-slate-100 text-slate-500"
            }`}
          >
            {SLIDE_LABELS[current]}
          </span>
          <span className={`text-xs font-mono ${isDark ? "text-white/30" : "text-slate-400"}`}>
            {current + 1} / {SLIDE_COUNT}
          </span>
          <button
            onClick={copyLink}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isDark
                ? "bg-white/10 hover:bg-white/20 text-white/60"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            {copied ? (
              <><Check size={12} className="text-green-400" /> Copied!</>
            ) : (
              <><Link size={12} /> Share</>
            )}
          </button>
          <a
            href="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isDark
                ? "bg-white/10 hover:bg-white/20 text-white/60"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            ← App
          </a>
        </div>
      </header>

      {/* ── Slide area ──────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        <Slide />

        {/* Dot navigation — right edge */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              title={SLIDE_LABELS[i]}
              className="transition-all duration-200 rounded-full"
              style={{
                width: i === current ? 10 : 8,
                height: i === current ? 10 : 8,
                background: i === current
                  ? "#3B82F6"
                  : isDark
                  ? "rgba(255,255,255,0.2)"
                  : "#CBD5E1",
              }}
            />
          ))}
        </div>

        {/* Arrow nav — bottom right */}
        <div className="absolute bottom-6 right-16 flex items-center gap-2">
          <button
            onClick={prev}
            disabled={current === 0}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-25 ${
              isDark
                ? "bg-white/10 hover:bg-white/20 text-white"
                : "bg-slate-200 hover:bg-slate-300 text-slate-700"
            }`}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={next}
            disabled={current === SLIDE_COUNT - 1}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-25"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Keyboard hint */}
        <p
          className={`absolute bottom-7 left-1/2 -translate-x-1/2 text-xs pointer-events-none ${
            isDark ? "text-white/15" : "text-slate-300"
          }`}
        >
          ← → arrow keys to navigate
        </p>
      </div>
    </div>
  );
}
