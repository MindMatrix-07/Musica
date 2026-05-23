"use client";

import { useEffect, useState } from "react";
import { hasActiveApiKey } from "@/lib/ai-settings";

interface AppHeaderProps {
  activeTab: "player" | "settings";
  onTabChange: (tab: "player" | "settings") => void;
}

export function AppHeader({ activeTab, onTabChange }: AppHeaderProps) {
  const [keyConfigured, setKeyConfigured] = useState(false);

  useEffect(() => {
    const sync = () => setKeyConfigured(hasActiveApiKey());
    sync();
    window.addEventListener("musica-settings-updated", sync);
    return () => window.removeEventListener("musica-settings-updated", sync);
  }, []);

  const buttonClass = (tab: "player" | "settings") =>
    `text-sm cursor-pointer transition ${
      activeTab === tab
        ? "font-medium text-accent"
        : "text-foreground/50 hover:text-foreground"
    }`;

  return (
    <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Private Workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Musica
        </h1>
      </div>

      <nav className="flex flex-col items-start gap-3 sm:items-end">
        <div className="flex gap-5">
          <button
            type="button"
            onClick={() => onTabChange("player")}
            className={buttonClass("player")}
          >
            Curate
          </button>
          <button
            type="button"
            onClick={() => onTabChange("settings")}
            className={buttonClass("settings")}
          >
            Settings
          </button>
        </div>
        <span
          className={`text-xs ${
            keyConfigured ? "text-emerald-400/90" : "text-amber-400/90"
          }`}
        >
          {keyConfigured ? "● API ready" : "● API key not set"}
        </span>
      </nav>
    </header>
  );
}
