/**
 * Style-recalculation fix for the official Files sidebar.
 *
 * `@deepseek-ai/dsh-client-ui-sidebar-files` hides the siblings of a filling
 * navigator with `:has(> NAV) > :not(NAV)`. A `:has()` on the parent side of
 * a combinator, in front of a subject that matches almost every element,
 * makes Chromium restyle large parts of the page on every DOM insertion:
 * measured on 0.2.2-rc.1 with a streaming answer, each recalculation took
 * about 220 ms with the rule and about 28 ms without it.
 *
 * The same elements can be selected with `:has()` on the subject itself,
 * which does not have that cost:
 *
 *   :has(> A) > :not(B)   ≡   :not(B):has(~ A), A ~ :not(B), A:not(B)
 *
 * (a non-B child whose parent has an A child either precedes an A sibling,
 * follows one, or is that A child). Specificity is unchanged. The rewrite is
 * applied to the live rule, so declarations, media queries and order stay
 * the host's own.
 */
/** Stylesheets whose rules are rewritten, by the loader's `data-plugin`. */
export declare const PATCHED_PLUGINS: ReadonlySet<string>;
/**
 * Rewrite `:has(> A) > :not(B)` to its subject-side equivalent.
 * @returns the new selector, or `null` when the selector has another shape.
 */
export declare function rewriteParentHas(selectorText: string): string | null;
/**
 * Rewrite the matching rules of every targeted stylesheet in `doc`.
 * Already rewritten rules no longer match, so repeated calls are cheap.
 * @returns the number of rules rewritten by this call.
 */
export declare function patchDocument(doc: Document, undo: Array<() => void>): number;
/**
 * Keep the targeted stylesheets rewritten: now, and whenever the module
 * loader adds or replaces a stylesheet in `<head>` (first load, HMR).
 * @returns a disposer that restores the host's selectors.
 */
export declare function startHasPatch(doc: Document, win: Window & typeof globalThis): () => void;
