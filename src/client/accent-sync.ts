/**
 * Keeps two records of the accent colour in step. The browser-side choice
 * (shared-accent.ts) is what every copylee plugin's page follows; the Host-side
 * one is what the pairing page and the phones are served. Either can change:
 * the shared one from any plugin's settings on this computer, the Host's from a
 * phone. Remembering the Host value last seen here tells the two cases apart.
 */
import { isAccent, readAccent, storedAccent, writeAccent, type Accent } from './shared-accent.js'

const SEEN = 'copylee.dsh.accent.remote-control'

function seen(): string | null { try { return localStorage.getItem(SEEN) } catch { return null } }
function remember(accent: Accent): void { try { localStorage.setItem(SEEN, accent) } catch { /* nothing to keep it in */ } }

/** Record a choice made on this computer, so the next sync does not mistake it for a change from a phone. */
export function chooseAccent(accent: Accent): void { remember(accent); writeAccent(accent) }

/**
 * @param host - the accent the Host currently holds.
 * @param push - called with the accent the Host should take when this computer's choice is the newer one.
 */
export function syncAccent(host: unknown, push: (accent: Accent) => void): void {
  if (!isAccent(host)) return
  const shared = storedAccent(), last = seen()
  if (shared === null || (last !== null && last !== host)) {
    // No choice in this browser yet, or a phone changed it: the Host's value wins.
    remember(host)
    if (readAccent() !== host || shared === null) writeAccent(host)
  } else if (shared !== host) {
    remember(shared); push(shared)
  } else if (last !== host) remember(host)
}
