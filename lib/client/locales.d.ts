export declare const NAMESPACE = "dshAppearance";
export declare const zh: Record<string, string>;
export declare const en: Record<string, string>;
export type Translate = (key: string, params?: Record<string, unknown>) => string;
/** Fallback translator used when the locale service is unavailable (tests). */
export declare function fallbackT(key: string, params?: Record<string, unknown>): string;
