"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DashboardPage } from "@/components/DashboardPage";
import { SettingsPage } from "@/components/SettingsPage";
import { setServerKeyAvailable } from "@/lib/ai-settings";

function AnimatedBackground() {
  return (
    <div className="ambient-bg" aria-hidden>
      <div className="ambient-blob ambient-blob--violet" />
      <div className="ambient-blob ambient-blob--purple" />
      <div className="ambient-blob ambient-blob--rose" />
      <div className="ambient-blob ambient-blob--orange" />
      <div className="ambient-blob ambient-blob--red" />
      <div className="ambient-noise" />
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"player" | "settings">("player");

  useEffect(() => {
    let apiBase = "";
    if (
      typeof window !== "undefined" &&
      (window.location.origin.startsWith("capacitor://") ||
        window.location.origin === "http://localhost" ||
        window.location.protocol === "file:")
    ) {
      const customHost = localStorage.getItem("musica-custom-api-host");
      apiBase = customHost || "https://ais-dev-2py2nr7d52ngl3f6fxatdu-99924698939.asia-east1.run.app";
    }

    fetch(`${apiBase}/api/config`)
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.hasGeminiKey === "boolean") {
          setServerKeyAvailable(data.hasGeminiKey);
        }
      })
      .catch((err) => console.error("Error fetching background configuration:", err));
  }, []);

  return (
    <div className="relative min-h-screen Selection-text overflow-x-hidden">
      <div className="app-drag-strip" aria-hidden />
      {/* Immersive animated audio visualization background */}
      <AnimatedBackground />

      {/* Main glass card and viewport container */}
      <main className="relative z-10 mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 lg:px-8 flex flex-col justify-start">
        {/* App Header with unified state navigation triggers */}
        <AppHeader activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab content renderer with slide transitions */}
        <div className="w-full mt-4 flex-1">
          {activeTab === "player" ? (
            <DashboardPage onTabChange={setActiveTab} />
          ) : (
            <SettingsPage onTabChange={setActiveTab} />
          )}
        </div>
      </main>
    </div>
  );
}
