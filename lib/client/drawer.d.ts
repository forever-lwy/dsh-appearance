/**
 * Mobile drawer behaviour. The open/closed state stays the layout's own
 * (`narrowExpanded`, toggled through `ctx.layout.toggleSidebar()`); this
 * controller only reads it from the frame's `data-sidebar-collapsed`
 * attribute and asks the layout to close when the person navigates.
 */
import type { PrefsStore } from './prefs.js';
export interface DrawerController {
    toggle(): void;
    /** Close the drawer if it is open on a mobile viewport. */
    close(): void;
    isOpen(): boolean;
    isMobile(): boolean;
    /** Report the Session the composer currently shows. */
    onSession(sessionId: string): void;
    dispose(): void;
}
interface PanelSource {
    getSnapshot(): {
        activePanelId: unknown;
    };
    subscribe(listener: () => void): () => void;
}
export interface DrawerDeps {
    doc: Document;
    win: Window;
    prefs: PrefsStore;
    toggleSidebar: () => void;
    panelInfo?: PanelSource;
}
export declare function frameOf(doc: Document): HTMLElement | null;
export declare function createDrawerController({ doc, win, prefs, toggleSidebar, panelInfo }: DrawerDeps): DrawerController;
export {};
