"use client";

const MAC_DOWNLOAD_URL = "https://github.com/rohityadav2320/Ad-Intelligence/releases/latest/download/AdIntelligenceAgent-Mac.zip";
const WIN_DOWNLOAD_URL = "https://github.com/rohityadav2320/Ad-Intelligence/releases/latest/download/AdIntelligenceAgent-Windows.zip";

const MAC_RUN_CMD = `F=$(find ~/Downloads -maxdepth 2 -name 'AdIntelligenceAgent-Mac' -type d -print0 2>/dev/null | xargs -0 ls -dt 2>/dev/null | head -1); echo "Found: $F"; xattr -cr "$F"; chmod +x "$F/run.command"; open "$F/run.command"`;

import { useState } from "react";
import { Copy, Check, ChevronDown } from "lucide-react";

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3.5 text-left"
      >
        <span className="text-sm font-medium text-white/90">{q}</span>
        <ChevronDown className={`w-4 h-4 text-white/40 shrink-0 ml-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="text-sm text-white/50 pb-4 leading-relaxed">{a}</p>}
    </div>
  );
}

export default function InstallPage() {
  const [os, setOs] = useState<"mac" | "windows">("mac");
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(MAC_RUN_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-white/10 px-8 py-4 flex items-center gap-3">
        <span className="text-xl font-bold">Ad Intelligence</span>
        <span className="text-white/30 text-sm">by Vidrow</span>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-14">
        <h1 className="text-3xl font-bold mb-2 text-center">Set Up Your Scraper</h1>
        <p className="text-white/50 text-center mb-3 max-w-lg leading-relaxed">
          To pull ads from Meta &amp; Instagram, a small helper program needs to run on your laptop.
          It's a <strong className="text-white/70">one-time setup that takes about 2 minutes</strong> — after that, you'll just reopen it whenever you want to use the portal.
        </p>
        <p className="text-white/30 text-xs text-center mb-10 max-w-md">
          Nothing to install permanently. No password or login needed. Just follow the steps below exactly.
        </p>

        {/* OS toggle */}
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 mb-8">
          <button
            onClick={() => setOs("mac")}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${os === "mac" ? "bg-blue-600 text-white" : "text-white/50 hover:text-white/80"}`}
          >
            🍎 I use a Mac
          </button>
          <button
            onClick={() => setOs("windows")}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${os === "windows" ? "bg-blue-600 text-white" : "text-white/50 hover:text-white/80"}`}
          >
            🪟 I use Windows
          </button>
        </div>

        {/* Download card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 w-full max-w-lg mb-10">
          <div className="text-5xl mb-4 text-center">{os === "mac" ? "🍎" : "🪟"}</div>
          <h2 className="text-xl font-bold text-center mb-1">Step 1 — Download</h2>
          <p className="text-white/40 text-sm text-center mb-6">{os === "mac" ? "For macOS" : "For Windows 10 / 11"}</p>
          <a
            href={os === "mac" ? MAC_DOWNLOAD_URL : WIN_DOWNLOAD_URL}
            className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-center py-3.5 rounded-xl transition-colors text-base"
          >
            ⬇ Download Agent
          </a>
          <p className="text-white/30 text-xs text-center mt-3">
            It saves to your <strong className="text-white/50">Downloads</strong> folder.
            {os === "mac"
              ? ' If a warning pops up saying "cannot verify this file" or Chrome says it "can\'t scan this file" — click Download/Keep anyway. This is completely normal for internal tools.'
              : ' Your browser may warn "this file isn\'t commonly downloaded" — click Keep. This is completely normal for internal tools.'}
          </p>
        </div>

        {/* Steps */}
        <div className="w-full max-w-lg">
          <h2 className="text-lg font-bold mb-5">Step 2 — Run it</h2>

          {os === "mac" ? (
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">A</div>
                <div>
                  <p className="font-semibold mb-1">Open Terminal</p>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">Cmd</kbd> + <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">Space</kbd> on your keyboard,
                    type <strong className="text-white/80">Terminal</strong>, and press <strong className="text-white/80">Enter</strong>. A black/white window will open — that's Terminal.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">B</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold mb-1">Copy the command below</p>
                  <p className="text-white/50 text-sm leading-relaxed mb-3">
                    Click the <strong className="text-white/80">copy icon</strong> on the right of the box. You don't need to understand this text — just copy it as-is.
                  </p>
                  <div className="bg-black/50 border border-white/10 rounded-xl p-4 relative">
                    <code className="text-green-400 text-xs leading-relaxed break-all block pr-8">{MAC_RUN_CMD}</code>
                    <button
                      onClick={copy}
                      className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 rounded-lg p-1.5 transition-colors"
                      title="Copy command"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/60" />}
                    </button>
                  </div>
                  {copied && <p className="text-green-400 text-xs mt-2">✓ Copied! Now go paste it in Terminal.</p>}
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">C</div>
                <div>
                  <p className="font-semibold mb-1">Paste it into Terminal and press Enter</p>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Click inside the Terminal window, press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">Cmd</kbd> + <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">V</kbd> to paste,
                    then press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">Enter</kbd>. This automatically finds your downloaded file, unlocks it, and starts it — no matter what it's named.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">D</div>
                <div>
                  <p className="font-semibold mb-1">Wait for it to finish setting up</p>
                  <p className="text-white/50 text-sm leading-relaxed">
                    The first time only, it takes about 2-3 minutes to install everything. You'll see lots of text scroll by — that's normal.
                    When you see the line <strong className="text-green-400">"Polling every 5s for scrape jobs"</strong>, you're done and ready to go! 🎉
                  </p>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">✓</div>
                <div>
                  <p className="font-semibold mb-1">Next time you want to use the portal</p>
                  <p className="text-white/50 text-sm leading-relaxed">
                    No need to download again. Just repeat steps A–C (open Terminal, paste the same command, press Enter) — it starts instantly.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">A</div>
                <div>
                  <p className="font-semibold mb-1">Install Python (skip if you already have it)</p>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Go to <a href="https://www.python.org/downloads/" target="_blank" className="text-blue-400 underline">python.org/downloads</a> and click the yellow "Download Python" button.
                    Open the downloaded file to install it. <strong className="text-white/80">Important:</strong> on the first install screen, tick the checkbox that says
                    <strong className="text-white/80"> "Add Python to PATH"</strong> before clicking Install.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">B</div>
                <div>
                  <p className="font-semibold mb-1">Open your Downloads folder and unzip the file</p>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Find <strong className="text-white/80">AdIntelligenceAgent-Windows.zip</strong> in your Downloads folder.
                    Right-click it → <strong className="text-white/80">Extract All</strong> → click <strong className="text-white/80">Extract</strong>.
                    A new folder with the same name will appear.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">C</div>
                <div>
                  <p className="font-semibold mb-1">Open that folder and double-click "run"</p>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Look for a file named <strong className="text-white/80">run.bat</strong> (it may just show as "run") and double-click it.
                    If a blue box appears saying <strong className="text-white/80">"Windows protected your PC"</strong>, click
                    <strong className="text-white/80"> "More info"</strong>, then click <strong className="text-white/80">"Run anyway"</strong>. This is normal for internal tools.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">D</div>
                <div>
                  <p className="font-semibold mb-1">Wait for it to finish setting up</p>
                  <p className="text-white/50 text-sm leading-relaxed">
                    A black window will open and install everything automatically — about 2-3 minutes the first time. Lots of text will scroll by, that's normal.
                    When you see <strong className="text-green-400">"Polling every 5s for scrape jobs"</strong>, you're done and ready to go! 🎉
                  </p>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">✓</div>
                <div>
                  <p className="font-semibold mb-1">Next time you want to use the portal</p>
                  <p className="text-white/50 text-sm leading-relaxed">
                    No need to download or extract again. Just open that same folder and double-click <strong className="text-white/80">run.bat</strong> — it starts instantly.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Keep-open note */}
        <div className="mt-10 bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4 w-full max-w-lg">
          <p className="text-amber-400 text-sm font-medium mb-1">⚡ Keep that window open while you use the app</p>
          <p className="text-amber-400/70 text-sm leading-relaxed">
            That black window is doing the actual scraping. As long as it stays open, anything you submit on the portal
            (a Meta ad link, an Instagram reel, a brand name) will be picked up and processed automatically within a few seconds.
            You can minimize it, just don't close it.
          </p>
        </div>

        {/* FAQ */}
        <div className="mt-10 w-full max-w-lg">
          <h2 className="text-lg font-bold mb-2">Common questions</h2>
          <div className="bg-white/5 border border-white/10 rounded-2xl px-5">
            <FaqItem
              q="Do I need to keep doing this every day?"
              a="No — only the first-time setup takes a few minutes. After that, starting the agent is one click (Windows) or one paste (Mac), and takes a few seconds."
            />
            <FaqItem
              q="Is this safe? Why does my browser/antivirus warn me?"
              a="Yes, it's safe — this warning shows up for any small internal tool that isn't a big-name app from an app store. The agent only talks to our own Supabase database and backend server, nothing else."
            />
            <FaqItem
              q="What does this program actually do?"
              a="It watches for scrape requests submitted on the Ad Intelligence portal (a Meta ad link, brand name, or Instagram reel), fetches that content using your internet connection, and sends the results back to the portal automatically. You don't need to do anything manually — just leave the window open."
            />
            <FaqItem
              q="Can I close my laptop lid?"
              a="No — closing the lid puts your laptop to sleep and pauses the agent. Keep your laptop open (screen can be dim/off is fine as long as it's not fully asleep) while you want scrapes to run."
            />
            <FaqItem
              q="I ran the command/file and nothing happened, or I see an error"
              a="Double check you copied the entire command (Mac) or that Python installed correctly with 'Add to PATH' checked (Windows). If it still doesn't work, message the team on WhatsApp with a screenshot of what you see."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
