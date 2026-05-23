"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hasApiKey } from "@/lib/settings";

export function AppHeader() {
  const pathname = usePathname();
  const [keyConfigured, setKeyConfigured] = useState(false);

  useEffect(() => {
    const sync = () => setKeyConfigured(hasApiKey());
    sync();
    window.addEventListener("musica-settings-updated", sync);
    return () => window.removeEventListener("musica-settings-updated", sync);
  }, [pathname]);

  const linkClass = (href: string) =>
    `text-sm transition ${
      pathname === href
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
          Musica Curator
        </h1>
      </div>

      <nav className="flex flex-col items-start gap-3 sm:items-end">
        <div className="flex gap-5">
          <Link href="/" className={linkClass("/")}>
            Curate
          </Link>
          <Link href="/settings" className={linkClass("/settings")}>
            Settings
          </Link>
        </div>
        <span
          className={`text-xs ${
            keyConfigured ? "text-emerald-400/90" : "text-amber-400/90"
          }`}
        >
          {keyConfigured ? "API key saved" : "API key not set"}
        </span>
      </nav>
    </header>
  );
}
