/**
 * Per-device appearance preferences. They describe how this browser shows
 * DSH (a phone and a desktop may want different answers), so they live in
 * localStorage rather than in the Host. Every read and write tolerates a
 * missing or throwing storage (private windows, blocked site data).
 */
export interface Prefs {
    /** Gather other plugins' composer buttons behind one tray button. */
    groupComposer: boolean;
    /** Below the breakpoint, hide the sidebar rail and open it as a drawer. */
    mobileDrawer: boolean;
    /** Below the breakpoint, apply the mobile spacing and input tweaks. */
    mobilePolish: boolean;
    /** Viewport width (CSS px) at or below which the mobile layout applies. */
    breakpoint: number;
}
export declare const DEFAULT_PREFS: Readonly<Prefs>;
export declare const MIN_BREAKPOINT = 480;
export declare const MAX_BREAKPOINT = 1023;
export declare const STORAGE_KEY = "dsh-appearance:prefs:v1";
/** Coerce arbitrary stored JSON into a complete, valid Prefs value. */
export declare function normalizePrefs(value: unknown): Prefs;
export interface PrefsStore {
    getSnapshot(): Prefs;
    subscribe(listener: () => void): () => void;
    update(patch: Partial<Prefs>): void;
    reset(): void;
    dispose(): void;
}
export declare function createPrefsStore(win?: Window | undefined): PrefsStore;
