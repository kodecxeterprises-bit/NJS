interface StoredRequestKeys {
  keys: Record<string, string>;
}

export interface SupportReplyDraft {
  message: string;
  timestampPending: boolean;
}

export type SupportReplyDrafts = Record<string, SupportReplyDraft>;

export function buildAdminSupportReplyPayload(ticketId: string, message: string) {
  return { action: "reply" as const, ticketId, message: message.trim() };
}

/** Update one ticket's draft without mutating drafts belonging to other tickets. */
export function updateSupportReplyDraft(
  drafts: SupportReplyDrafts,
  ticketId: string,
  draft: SupportReplyDraft | null,
): SupportReplyDrafts {
  if (draft === null) {
    const { [ticketId]: _removed, ...remaining } = drafts;
    return remaining;
  }
  return { ...drafts, [ticketId]: draft };
}

/** Ignore asynchronous UI updates after navigation or component unmount. */
export function canApplyTicketResponse(
  responseTicketId: string,
  selectedTicketId: string | null,
  mounted: boolean,
) {
  return mounted && responseTicketId === selectedTicketId;
}

const memoryFallback = new Map<string, StoredRequestKeys>();

async function payloadHash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readStored(scope: string): StoredRequestKeys {
  try {
    const value = sessionStorage.getItem(scope);
    if (value) {
      const parsed = JSON.parse(value) as StoredRequestKeys;
      if (parsed && typeof parsed.keys === "object" && parsed.keys !== null) return parsed;
    }
    return memoryFallback.get(scope) ?? { keys: {} };
  } catch {
    return memoryFallback.get(scope) ?? { keys: {} };
  }
}

function writeStored(scope: string, value: StoredRequestKeys) {
  memoryFallback.set(scope, value);
  try { sessionStorage.setItem(scope, JSON.stringify(value)); } catch { /* in-memory retry remains available */ }
}

/** Reuses a key for the same draft across retries and reloads, without storing message text. */
export async function getSupportIdempotencyKey(scope: string, payload: string) {
  const hash = await payloadHash(payload);
  const stored = readStored(scope);
  const existing = stored.keys[hash];
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const nextKey = newKey();
  const next = { keys: { ...stored.keys, [hash]: nextKey } };
  writeStored(scope, next);
  return nextKey;
}

export function clearSupportIdempotencyKey(scope: string, key: string) {
  const stored = readStored(scope);
  const keys = Object.fromEntries(Object.entries(stored.keys).filter(([, value]) => value !== key));
  if (Object.keys(keys).length === Object.keys(stored.keys).length) return;
  if (Object.keys(keys).length === 0) {
    memoryFallback.delete(scope);
    try { sessionStorage.removeItem(scope); } catch { /* nothing else to clear */ }
  } else {
    writeStored(scope, { keys });
  }
}
