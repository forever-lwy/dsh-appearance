import type { Context } from '@deepseek-ai/cordis';
import { AppearanceSettings, ComposerEntry, DrawerOverlay, HeaderMenuButton } from './components.js';
export declare const name = "dsh-appearance-client";
export declare const inject: string[];
/** Null-rendering shadow that hides a mirrored entry from the composer row. */
export declare function TrayShadow(): null;
export declare function apply(ctx: Context): void;
export { AppearanceSettings, ComposerEntry, DrawerOverlay, HeaderMenuButton };
