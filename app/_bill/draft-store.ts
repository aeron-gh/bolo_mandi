// The open bill on this device, one per shop. Storage can be blocked (private mode), so every call is guarded.
import { restoreDraft, type BillDraft } from "@/lib/draft.ts";

export const draftKey = (shopKey: string) => `bolo-draft:${shopKey}`;

export function loadDraft(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Keep only bills worth coming back to; saved, cancelled and empty bills are forgotten.
export function keepDraft(key: string, draft: BillDraft): void {
  try {
    if (restoreDraft(draft)) localStorage.setItem(key, JSON.stringify(draft));
    else localStorage.removeItem(key);
  } catch {
    // Storage full or blocked: billing still works, the bill just won't survive a reload.
  }
}

export function forgetDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing stored, nothing to forget.
  }
}
