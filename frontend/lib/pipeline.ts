const STORAGE_KEY = "musica_split_structure";

export function getSplitStructure(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(STORAGE_KEY);
  return v !== "false";
}

export function setSplitStructure(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new Event("musica-pipeline-updated"));
}
