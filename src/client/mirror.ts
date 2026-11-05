/**
 * Composer tray mirroring.
 *
 * Other plugins contribute composer buttons as entries of the official list
 * slots `conversation.input.left` / `conversation.input.right`. rc.5 list
 * slots support cell shadowing: entries sharing an `id` coexist at distinct
 * priorities and only the lowest one renders. For every foreign entry we
 *
 *   1. register a null-rendering shadow at the same id with a lower priority,
 *      which removes the original button from the composer row, and
 *   2. re-register the very same component (with its own inject, locale and
 *      store declarations) into the tray's child list slot, so the official
 *      renderer still builds its props exactly as for the original.
 *
 * Nothing is patched or monkey-patched: removing a registration (plugin
 * unload, preference off, composer re-declaration) restores the original.
 * Entries that declare child slots are left alone, because a slot can only
 * have one declarer.
 */

export const SOURCE_SLOTS = ['conversation.input.left', 'conversation.input.right'] as const
export type SourceSlot = typeof SOURCE_SLOTS[number]
export const TRAY_SLOT = 'dsh-appearance.tray'
/** How far below the mirrored entry's priority the shadow sits. */
export const SHADOW_OFFSET = 1000

export interface EntryLike {
  component: unknown
  options: { id?: string; order?: number; label?: unknown; priority?: number }
  inject?: unknown
  children?: unknown
  store?: unknown
  locale?: string
}

export interface SlotsLike {
  register(options: Record<string, unknown>, component: unknown): () => void
  entries(key: string): readonly EntryLike[]
  subscribe(key: string, fn: () => void): () => void
}

export interface MirrorOptions {
  /** Components this plugin registers into the source slots (never mirrored). */
  own: ReadonlySet<unknown>
  /** The null-rendering shadow component. */
  shadow: unknown
  /** Called after each reconcile with the mirrored ids (diagnostics, tests). */
  onChange?: (mirrored: readonly string[]) => void
  /** Called when a single registration fails; that entry stays in the bar. */
  onError?: (error: unknown, key: string, id: string) => void
}

interface Mirror {
  entry: EntryLike
  dispose: () => void
}

const hasChildren = (entry: EntryLike) => entry.children !== undefined && entry.children !== null
  && Object.keys(entry.children as object).length > 0

/** Pick, per list cell id, the foreign entry that currently renders. */
export function foreignWinners(entries: readonly EntryLike[], own: ReadonlySet<unknown>, shadow: unknown): Map<string, EntryLike> {
  const winners = new Map<string, EntryLike>()
  for (const entry of entries) {
    const id = entry.options.id
    if (id === undefined || entry.component === shadow || own.has(entry.component)) continue
    const current = winners.get(id)
    // Ties keep registration order, matching the registry's own projection.
    if (current === undefined || (entry.options.priority ?? 0) < (current.options.priority ?? 0)) winners.set(id, entry)
  }
  return winners
}

/** Tray ordering: everything from the left row, then the right row. */
export function trayOrder(key: SourceSlot, order: number | undefined): number {
  return (key === 'conversation.input.left' ? 0 : 100000) + (order ?? 0)
}

export function trayId(key: SourceSlot, id: string): string {
  return `${key === 'conversation.input.left' ? 'left' : 'right'}:${id}`
}

/**
 * Keep the tray in sync with the source slots until the returned disposer
 * runs. Must be started while the tray slot is declared.
 */
export function startMirror(slots: SlotsLike, options: MirrorOptions): () => void {
  const mirrors = new Map<string, Mirror>()
  let disposed = false
  let running = false

  const mirror = (key: SourceSlot, id: string, entry: EntryLike): Mirror | undefined => {
    const disposers: Array<() => void> = []
    try {
      const trayOptions: Record<string, unknown> = { name: TRAY_SLOT, id: trayId(key, id), order: trayOrder(key, entry.options.order) }
      if (entry.options.label !== undefined) trayOptions.label = entry.options.label
      if (entry.inject !== undefined) trayOptions.inject = entry.inject
      if (entry.locale !== undefined) trayOptions.locale = entry.locale
      if (entry.store !== undefined) trayOptions.store = entry.store
      disposers.push(slots.register(trayOptions, entry.component))
      const shadowOptions: Record<string, unknown> = { name: key, id, priority: (entry.options.priority ?? 0) - SHADOW_OFFSET }
      if (entry.options.order !== undefined) shadowOptions.order = entry.options.order
      disposers.push(slots.register(shadowOptions, options.shadow))
      return { entry, dispose: () => { for (const dispose of disposers.reverse()) dispose() } }
    } catch (error) {
      for (const dispose of disposers.reverse()) { try { dispose() } catch { /* already gone */ } }
      options.onError?.(error, key, id)
      return undefined
    }
  }

  const reconcile = () => {
    if (disposed || running) return
    running = true
    try {
      const wanted = new Map<string, { key: SourceSlot; id: string; entry: EntryLike }>()
      for (const key of SOURCE_SLOTS) {
        for (const [id, entry] of foreignWinners(slots.entries(key), options.own, options.shadow)) {
          if (hasChildren(entry)) continue
          wanted.set(`${key}\u0000${id}`, { key, id, entry })
        }
      }
      for (const [cell, current] of mirrors) {
        if (wanted.get(cell)?.entry === current.entry) continue
        mirrors.delete(cell)
        current.dispose()
      }
      for (const [cell, { key, id, entry }] of wanted) {
        if (mirrors.has(cell)) continue
        const created = mirror(key, id, entry)
        if (created) mirrors.set(cell, created)
      }
      options.onChange?.([...mirrors.keys()].map(cell => cell.replace('\u0000', '#')))
    } finally { running = false }
  }

  const unsubscribe = SOURCE_SLOTS.map(key => slots.subscribe(key, reconcile))
  reconcile()
  return () => {
    if (disposed) return
    disposed = true
    for (const stop of unsubscribe) stop()
    for (const current of mirrors.values()) { try { current.dispose() } catch { /* collapsed with its slot */ } }
    mirrors.clear()
  }
}
