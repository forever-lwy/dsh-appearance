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
export declare const SOURCE_SLOTS: readonly ["conversation.input.left", "conversation.input.right"];
export type SourceSlot = typeof SOURCE_SLOTS[number];
export declare const TRAY_SLOT = "dsh-appearance.tray";
/** How far below the mirrored entry's priority the shadow sits. */
export declare const SHADOW_OFFSET = 1000;
export interface EntryLike {
    component: unknown;
    options: {
        id?: string;
        order?: number;
        label?: unknown;
        priority?: number;
    };
    inject?: unknown;
    children?: unknown;
    store?: unknown;
    locale?: string;
}
export interface SlotsLike {
    register(options: Record<string, unknown>, component: unknown): () => void;
    entries(key: string): readonly EntryLike[];
    subscribe(key: string, fn: () => void): () => void;
}
export interface MirrorOptions {
    /** Components this plugin registers into the source slots (never mirrored). */
    own: ReadonlySet<unknown>;
    /** The null-rendering shadow component. */
    shadow: unknown;
    /** Called after each reconcile with the mirrored ids (diagnostics, tests). */
    onChange?: (mirrored: readonly string[]) => void;
    /** Called when a single registration fails; that entry stays in the bar. */
    onError?: (error: unknown, key: string, id: string) => void;
}
/** Pick, per list cell id, the foreign entry that currently renders. */
export declare function foreignWinners(entries: readonly EntryLike[], own: ReadonlySet<unknown>, shadow: unknown): Map<string, EntryLike>;
/** Tray ordering: everything from the left row, then the right row. */
export declare function trayOrder(key: SourceSlot, order: number | undefined): number;
export declare function trayId(key: SourceSlot, id: string): string;
/**
 * Keep the tray in sync with the source slots until the returned disposer
 * runs. Must be started while the tray slot is declared.
 */
export declare function startMirror(slots: SlotsLike, options: MirrorOptions): () => void;
