import { type ReactNode } from 'react';
import { type Prefs, type PrefsStore } from './prefs.js';
import { type Translate } from './locales.js';
export declare function usePrefs(store: PrefsStore): Prefs;
/**
 * Count the rendered tray entries (entries may legitimately render nothing).
 * The rc.5 renderer wraps every slot outlet in a `display: contents`
 * `div[data-slot]`, so those wrappers are looked through, not counted.
 */
export declare function countItems(node: Element): number;
export interface ComposerEntryFace {
    prefs: PrefsStore;
    t?: Translate;
    onSession?: (sessionId: string) => void;
}
interface ComposerEntryProps extends ComposerEntryFace {
    sessionId: string;
    renderSlot: (key: string, owner: object) => ReactNode;
}
/**
 * The single composer entry this plugin owns. It always reports the current
 * Session (the drawer closes on navigation) and, when grouping is enabled,
 * renders the tray button whose panel hosts the mirrored plugin entries.
 */
export declare function ComposerEntry(props: ComposerEntryProps): import("react").JSX.Element | null;
export declare function ComposerTray({ renderSlot, t, breakpoint }: {
    renderSlot: (key: string, owner: object) => ReactNode;
    t: Translate;
    breakpoint: number;
}): import("react").JSX.Element;
export interface DrawerFace {
    prefs: PrefsStore;
    toggle: () => void;
    close: () => void;
    t?: Translate;
}
/** Header leading seat: the top-left button on the Conversation view. */
export declare function HeaderMenuButton(props: DrawerFace): import("react").JSX.Element | null;
/**
 * Shell overlay: the drawer backdrop and, on global panels (Plugins and
 * other full-page panels without the Conversation header), a floating
 * top-left button. CSS shows both only on mobile.
 */
export declare function DrawerOverlay(props: DrawerFace & {
    usePanelInfo?: (selector: (info: {
        activePanelId: unknown;
    }) => unknown) => unknown;
}): import("react").JSX.Element | null;
export declare function AppearanceSettings(props: {
    prefs: PrefsStore;
    t?: Translate;
}): import("react").JSX.Element;
export {};
