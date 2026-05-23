const SPLIT_STRUCTURE_KEY = "musica_split_structure";

function notify(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("musica-pipeline-updated"));
  }
}

export function getSplitStructure(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SPLIT_STRUCTURE_KEY) !== "false";
}

export function setSplitStructure(value: boolean): void {
  localStorage.setItem(SPLIT_STRUCTURE_KEY, value ? "true" : "false");
  notify();
}
