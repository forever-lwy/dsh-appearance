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
export const PATCHED_PLUGINS: ReadonlySet<string> = new Set(['@deepseek-ai/dsh-client-ui-sidebar-files'])

const NESTED = /\([^()]*\)/g

/** Index of the parenthesis closing the one at `open`, or -1. */
function closing(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')' && --depth === 0) return i
  }
  return -1
}

/** A single compound selector: no combinator and no list outside parentheses. */
function isCompound(selector: string): boolean {
  let flat = selector
  for (let previous = ''; previous !== flat;) { previous = flat; flat = flat.replace(NESTED, '') }
  return flat !== '' && !/[\s>~+,]/.test(flat)
}

/**
 * Rewrite `:has(> A) > :not(B)` to its subject-side equivalent.
 * @returns the new selector, or `null` when the selector has another shape.
 */
export function rewriteParentHas(selectorText: string): string | null {
  const text = selectorText.trim()
  if (!text.startsWith(':has(')) return null
  const end = closing(text, 4)
  if (end < 0) return null
  const argument = text.slice(5, end).trim()
  if (!argument.startsWith('>')) return null
  const child = argument.slice(1).trim()
  if (!isCompound(child)) return null
  const rest = /^\s*>\s*:not\(([^()]+)\)$/.exec(text.slice(end + 1))
  if (!rest) return null
  const excluded = rest[1].trim()
  if (!isCompound(excluded)) return null
  return `:not(${excluded}):has(~ ${child}), ${child} ~ :not(${excluded}), ${child}:not(${excluded})`
}

interface RuleLike { selectorText?: string; cssRules?: ArrayLike<RuleLike> }

function patchRules(rules: ArrayLike<RuleLike>, undo: Array<() => void>): void {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]
    const original = rule.selectorText
    if (typeof original === 'string') {
      const next = rewriteParentHas(original)
      if (next !== null) {
        rule.selectorText = next
        // An engine that rejects the new selector keeps the old one.
        if (rule.selectorText !== original) undo.push(() => { rule.selectorText = original })
      }
    }
    // Grouping rules (@media) and nested style rules.
    if (rule.cssRules && rule.cssRules.length > 0) patchRules(rule.cssRules, undo)
  }
}

/**
 * Rewrite the matching rules of every targeted stylesheet in `doc`.
 * Already rewritten rules no longer match, so repeated calls are cheap.
 * @returns the number of rules rewritten by this call.
 */
export function patchDocument(doc: Document, undo: Array<() => void>): number {
  const before = undo.length
  // The module loader tags every stylesheet it injects with `data-plugin`.
  for (const owner of Array.from(doc.querySelectorAll('style[data-plugin], link[data-plugin]'))) {
    if (!PATCHED_PLUGINS.has(owner.getAttribute('data-plugin') ?? '')) continue
    try {
      const sheet = (owner as HTMLStyleElement | HTMLLinkElement).sheet
      if (sheet) patchRules(sheet.cssRules as unknown as ArrayLike<RuleLike>, undo)
    } catch { /* unreadable sheet: leave it */ }
  }
  return undo.length - before
}

/**
 * Keep the targeted stylesheets rewritten: now, and whenever the module
 * loader adds or replaces a stylesheet in `<head>` (first load, HMR).
 * @returns a disposer that restores the host's selectors.
 */
export function startHasPatch(doc: Document, win: Window & typeof globalThis): () => void {
  const undo: Array<() => void> = []
  let queued = false
  const run = () => { queued = false; patchDocument(doc, undo) }
  const schedule = () => {
    if (queued) return
    queued = true
    queueMicrotask(run)
  }
  run()
  // `<head>` only changes when stylesheets come and go, so this stays idle
  // while the conversation renders.
  const observer = new win.MutationObserver(schedule)
  observer.observe(doc.head, { childList: true, subtree: true })
  return () => {
    observer.disconnect()
    for (const restore of undo.splice(0).reverse()) { try { restore() } catch { /* sheet already gone */ } }
  }
}
