"use client";

const MAC_DOWNLOAD_URL = "https://github.com/rohityadav2320/Ad-Intelligence/releases/latest/download/AdIntelligenceAgent-Mac.zip";
const WIN_DOWNLOAD_URL = "https://github.com/rohityadav2320/Ad-Intelligence/releases/latest/download/AdIntelligenceAgent-Windows.zip";

const MAC_RUN_CMD = `F=$(find ~/Downloads -maxdepth 2 -name 'AdIntelligenceAgent-Mac' -type d -print0 2>/dev/null | xargs -0 ls -dt 2>/dev/null | head -1); echo "Found: $F"; xattr -cr "$F"; chmod +x "$F/run.command"; open "$F/run.command"`;

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function InstallPage() {
  const [os, setOs] = useState<"mac" | "windows">("mac");
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(MAC_RUN_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-white/10 px-8 py-4 flex items-center gap-3">
        <span className="text-xl font-bold">Ad Intelligence</span>
        <span className="text-white/30 text-sm">by Vidrow</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <h1 className="text-3xl font-bold mb-2 text-center">Install Agent</h1>
        <p className="text-white/50 text-center mb-8 max-w-md">
          The agent runs on your laptop and does all the scraping. Takes 2 minutes to set up — only once.
        </p>

        {/* OS toggle */}
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 mb-8">
          <button
            onClick={() => setOs("mac")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${os === "mac" ? "bg-blue-600 text-white" : "text-white/50 hover:text-white/80"}`}
          >
            🍎 Mac
          </button>
          <button
            onClick={() => setOs("windows")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${os === "windows" ? "bg-blue-600 text-white" : "text-white/50 hover:text-white/80"}`}
          >
            🪟 Windows
          </button>
        </div>

        {/* Download card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 w-full max-w-md mb-8">
          <div className="text-5xl mb-4 text-center">{os === "mac" ? "🍎" : "🪟"}</div>
          <h2 className="text-xl font-bold text-center mb-1">Download for {os === "mac" ? "Mac" : "Windows"}</h2>
          <p className="text-white/40 text-sm text-center mb-6">{os === "mac" ? "macOS 12+" : "Windows 10/11"} · ~11 KB</p>
          <a
            href={os === "mac" ? MAC_DOWNLOAD_URL : WIN_DOWNLOAD_URL}
            className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-center py-3 rounded-xl transition-colors"
          >
            ⬇ Download
          </a>
        </div>

        {/* Steps */}
        {os === "mac" ? (
          <div className="w-full max-w-md space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">1</div>
              <div>
                <p className="font-semibold mb-1">Download the agent</p>
                <p className="text-white/50 text-sm">
                  Click Download above. If Chrome says "can't scan this file" → click <strong className="text-white/80">Download anyway</strong>. That's normal.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">2</div>
              <div className="flex-1">
                <p className="font-semibold mb-1">Unzip it, then run this in Terminal</p>
                <p className="text-white/50 text-sm mb-3">
                  Double-click the downloaded zip to unzip it. Open <strong className="text-white/80">Terminal</strong> (Cmd+Space → type Terminal → Enter). Paste the command below and press Enter:
                </p>
                <div className="bg-black/50 border border-white/10 rounded-xl p-4 relative">
                  <code className="text-green-400 text-xs leading-relaxed break-all">{MAC_RUN_CMD}</code>
                  <button
                    onClick={copy}
                    className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 rounded-lg p-1.5 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/60" />}
                  </button>
                </div>
                <p className="text-white/40 text-xs mt-2">
                  This command finds the app, unblocks it, and runs it — even if it downloaded as "(1)".
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">3</div>
              <div>
                <p className="font-semibold mb-1">Wait for setup (first time only)</p>
                <p className="text-white/50 text-sm">
                  Terminal will install everything automatically (~2 min). Once you see <strong className="text-green-400">Polling every 5s for scrape jobs</strong> — you're live! 🎉
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">✓</div>
              <div>
                <p className="font-semibold mb-1">Next time: just run the same command</p>
                <p className="text-white/50 text-sm">
                  No re-download needed. Open Terminal, paste the same command, and the agent starts instantly.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">1</div>
              <div>
                <p className="font-semibold mb-1">Install Python (if you don't have it)</p>
                <p className="text-white/50 text-sm">
                  Download from <a href="https://www.python.org/downloads/" target="_blank" className="text-blue-400 underline">python.org/downloads</a>. During install, check the box <strong className="text-white/80">"Add Python to PATH"</strong> — this is important.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">2</div>
              <div>
                <p className="font-semibold mb-1">Download & unzip the agent</p>
                <p className="text-white/50 text-sm">
                  Click Download above. Once downloaded, right-click the zip → <strong className="text-white/80">Extract All</strong>.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">3</div>
              <div>
                <p className="font-semibold mb-1">Double-click run.bat</p>
                <p className="text-white/50 text-sm">
                  Open the extracted folder and double-click <strong className="text-white/80">run.bat</strong>. If Windows shows "Windows protected your PC" → click <strong className="text-white/80">More info → Run anyway</strong>.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">4</div>
              <div>
                <p className="font-semibold mb-1">Wait for setup (first time only)</p>
                <p className="text-white/50 text-sm">
                  A black window will install everything automatically (~2 min). Once you see <strong className="text-green-400">Polling every 5s for scrape jobs</strong> — you're live! 🎉
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">✓</div>
              <div>
                <p className="font-semibold mb-1">Next time: just double-click run.bat again</p>
                <p className="text-white/50 text-sm">
                  No re-download or re-setup needed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Note */}
        <div className="mt-10 bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4 w-full max-w-md">
          <p className="text-amber-400 text-sm font-medium mb-1">⚡ Keep the window open while using the app</p>
          <p className="text-amber-400/70 text-sm">The agent runs in that window. As long as it's open, any scrape you submit from the portal will be processed automatically.</p>
        </div>
      </div>
    </div>
  );
}
