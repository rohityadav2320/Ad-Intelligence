"use client";

import { useState, useEffect } from "react";
import { Plus, Users, Target, Swords, ChevronRight, Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface ClientBrand {
  name: string;
  role: "client" | "competitor";
}
interface Client {
  id: string;
  name: string;
  created_at: string;
  brands: ClientBrand[];
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchClients = async () => {
    try {
      const res = await fetch(`${API}/api/clients`);
      setClients(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const createClient = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const c = await res.json();
      window.location.href = `/client?id=${c.id}`;
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="text-sm text-gray-500 mt-0.5">Each client is its own workspace of brands + competitors</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Client
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* New client form */}
        {showNew && (
          <div className="bg-white border border-blue-200 rounded-2xl p-5 mb-6 shadow-sm">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Client name</label>
            <div className="flex gap-3">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createClient()}
                placeholder="e.g. Oolka, Masai School..."
                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              />
              <button
                onClick={createClient}
                disabled={creating || !newName.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </button>
              <button onClick={() => setShowNew(false)} className="px-4 py-3 text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : clients.length === 0 && !showNew ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No clients yet. Create one to start grouping a brand + its competitors.</p>
            <button onClick={() => setShowNew(true)} className="text-blue-600 font-medium hover:underline">+ Create your first client</button>
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map((c) => {
              const own = c.brands.filter((b) => b.role === "client");
              const comp = c.brands.filter((b) => b.role === "competitor");
              return (
                <div
                  key={c.id}
                  onClick={() => (window.location.href = `/client?id=${c.id}`)}
                  className="bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-gray-900 text-lg mb-1">{c.name}</div>
                    <div className="flex items-center gap-3 text-sm">
                      {own.length > 0 && (
                        <span className="flex items-center gap-1 text-green-700">
                          <Target className="w-3.5 h-3.5" /> {own.map((b) => b.name).join(", ")}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-gray-500">
                        <Swords className="w-3.5 h-3.5" /> {comp.length} competitor{comp.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
