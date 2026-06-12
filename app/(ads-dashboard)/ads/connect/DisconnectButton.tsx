"use client";

import { useState } from "react";

export default function DisconnectButton() {
  const [loading, setLoading] = useState(false);

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your Meta Ads account?")) return;
    setLoading(true);
    await fetch("/api/ads/connect", { method: "DELETE" });
    window.location.reload();
  };

  return (
    <button
      onClick={handleDisconnect}
      disabled={loading}
      className="px-6 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-colors text-sm disabled:opacity-50"
    >
      {loading ? "Disconnecting..." : "Disconnect Account"}
    </button>
  );
}
