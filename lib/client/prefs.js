/**
 * Per-device appearance preferences. They describe how this browser shows
 * DSH (a phone and a desktop may want different answers), so they live in
 * localStorage rather than in the Host. Every read and write tolerates a
 * missing or throwing storage (private windows, blocked site data).
 */
export const DEFAULT_PREFS = Object.freeze({
    groupComposer: true,
    mobileDrawer: true,
    mobilePolish: true,
    breakpoint: 768,
});
export const MIN_BREAKPOINT = 480;
export const MAX_BREAKPOINT = 1023;
export const STORAGE_KEY = 'dsh-appearance:prefs:v1';
/** Coerce arbitrary stored JSON into a complete, valid Prefs value. */
export function normalizePrefs(value) {
    const input = value !== null && typeof value === 'object' ? value : {};
    const flag = (key) => typeof input[key] === 'boolean' ? input[key] : DEFAULT_PREFS[key];
    const raw = typeof input.breakpoint === 'number' && Number.isFinite(input.breakpoint) ? Math.round(input.breakpoint) : DEFAULT_PREFS.breakpoint;
    return {
        groupComposer: flag('groupComposer'),
        mobileDrawer: flag('mobileDrawer'),
        mobilePolish: flag('mobilePolish'),
        breakpoint: Math.min(MAX_BREAKPOINT, Math.max(MIN_BREAKPOINT, raw)),
    };
}
function storageOf(win) {
    try {
        return win?.localStorage ?? undefined;
    }
    catch {
        return undefined;
    }
}
export function createPrefsStore(win = typeof window === 'undefined' ? undefined : window) {
    const storage = storageOf(win);
    const read = () => {
        try {
            const text = storage?.getItem(STORAGE_KEY);
            return normalizePrefs(text ? JSON.parse(text) : undefined);
        }
        catch {
            return normalizePrefs(undefined);
        }
    };
    let snapshot = read();
    const listeners = new Set();
    const publish = (next) => {
        if (JSON.stringify(next) === JSON.stringify(snapshot))
            return;
        snapshot = next;
        for (const listener of [...listeners])
            listener();
    };
    const write = (next) => {
        try {
            storage?.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        catch { /* keep the in-memory value */ }
        publish(next);
    };
    // Another tab changed the preferences: follow it.
    const onStorage = (event) => { if (event.key === STORAGE_KEY || event.key === null)
        publish(read()); };
    win?.addEventListener('storage', onStorage);
    return {
        getSnapshot: () => snapshot,
        subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        update: patch => write(normalizePrefs({ ...snapshot, ...patch })),
        reset: () => {
            try {
                storage?.removeItem(STORAGE_KEY);
            }
            catch { /* ignore */ }
            publish(normalizePrefs(undefined));
        },
        dispose: () => { win?.removeEventListener('storage', onStorage); listeners.clear(); },
    };
}
