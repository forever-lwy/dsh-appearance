import type { Prefs } from './prefs.js';
/**
 * Structural hooks into the rc.5 shell. CSS-module class names carry a build
 * hash prefix (`pI_x6G_sidebarCol`), so we match on the stable local part and
 * on the data attributes the shell renders, never on the hash.
 */
export declare const FRAME = "div:has(> [data-shell-overlay])";
export declare const SIDEBAR_COL = "div:has(> [data-shell-overlay]) > [class*=\"_sidebarCol\"]";
export declare const CENTER_COL = "div:has(> [data-shell-overlay]) > [class*=\"_centerCol\"]";
export declare const RIGHTBAR_COL = "div:has(> [data-shell-overlay]) > [data-rightbar-col]";
export declare function mobileQuery(prefs: Pick<Prefs, 'breakpoint'>): string;
/** The whole stylesheet for the current preferences. */
export declare function buildCss(prefs: Prefs): string;
