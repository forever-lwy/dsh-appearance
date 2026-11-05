/**
 * Per-device appearance preferences. They describe how this browser shows
 * DSH (a phone and a desktop may want different answers), so they live in
 * localStorage rather than in the Host. Every read and write tolerates a
 * missing or throwing storage (private windows, blocked site data).
 */

export interface Prefs {
  /** Gather other plugins' composer buttons behind one tray button. */
  groupComposer: boolean
  /** Below the breakpoint, hide the sidebar rail and open it as a drawer. */
  mobileDrawer: boolean
  /** Below the breakpoint, apply the mobile spacing and input tweaks. */
  mobilePolish: boolean
  /** Viewport width (CSS px) at or below which the mobile layout applies. */
  breakpoint: number
}

export const DEFAULT_PREFS: Readonly<Prefs> = Object.freeze({
  groupComposer: true,
  mobileDrawer: true,
  mobilePolish: true,
  breakpoint: 768,
})

export const MIN_BREAKPOINT = 480
export const MAX_BREAKPOINT = 1023
export const STORAGE_KEY = 'dsh-appearance:prefs:v1'

/** Coerce arbitrary stored JSON into a complete, valid Prefs value. */
export function normalizePrefs(value: unknown): Prefs {
  const input = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
  const flag = (key: keyof Prefs) => typeof input[key] === 'boolean' ? input[key] as boolean : DEFAULT_PREFS[key] as boolean
  const raw = typeof input.breakpoint === 'number' && Number.isFinite(input.breakpoint) ? Math.round(input.breakpoint) : DEFAULT_PREFS.breakpoint
  return {
    groupComposer: flag('groupComposer'),
    mobileDrawer: flag('mobileDrawer'),
    mobilePolish: flag('mobilePolish'),
    breakpoint: Math.min(MAX_BREAKPOINT, Math.max(MIN_BREAKPOINT, raw)),
  }
}

export interface PrefsStore {
  getSnapshot(): Prefs
  subscribe(listener: () => void): () => void
  update(patch: Partial<Prefs>): void
  reset(): void
  dispose(): void
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function storageOf(win: Window | undefined): StorageLike | undefined {
  try { return win?.localStorage ?? undefined } catch { return undefined }
}

export function createPrefsStore(win: Window | undefined = typeof window === 'undefined' ? undefined : window): PrefsStore {
  const storage = storageOf(win)
  const read = (): Prefs => {
    try {
      const text = storage?.getItem(STORAGE_KEY)
      return normalizePrefs(text ? JSON.parse(text) : undefined)
    } catch { return normalizePrefs(undefined) }
  }
  let snapshot = read()
  const listeners = new Set<() => void>()
  const publish = (next: Prefs) => {
    if (JSON.stringify(next) === JSON.stringify(snapshot)) return
    snapshot = next
    for (const listener of [...listeners]) listener()
  }
  const write = (next: Prefs) => {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* keep the in-memory value */ }
    publish(next)
  }
  // Another tab changed the preferences: follow it.
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) publish(read()) }
  win?.addEventListener('storage', onStorage)
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    update: patch => write(normalizePrefs({ ...snapshot, ...patch })),
    reset: () => {
      try { storage?.removeItem(STORAGE_KEY) } catch { /* ignore */ }
      publish(normalizePrefs(undefined))
    },
    dispose: () => { win?.removeEventListener('storage', onStorage); listeners.clear() },
  }
}
