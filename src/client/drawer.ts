/**
 * Mobile drawer behaviour. The open/closed state stays the layout's own
 * (`narrowExpanded`, toggled through `ctx.layout.toggleSidebar()`); this
 * controller only reads it from the frame's `data-sidebar-collapsed`
 * attribute and asks the layout to close when the person navigates.
 *
 * Since 0.2.2 the shell has its own drawer below 768px (`data-sidebar-drawer`
 * on the frame) with an opener, a mask, Escape handling and closing on panel
 * selection. While it is active this controller only adds what the shell
 * lacks: closing on Session switch / New Session and the left swipe.
 */
import type { PrefsStore } from './prefs.js'
import { mobileQuery, SIDEBAR_COL } from './styles.js'

export interface DrawerController {
  toggle(): void
  /** Close the drawer if it is open on a mobile viewport. */
  close(): void
  isOpen(): boolean
  isMobile(): boolean
  /** The shell's own drawer is active. */
  isNative(): boolean
  /** Report the Session the composer currently shows. */
  onSession(sessionId: string): void
  dispose(): void
}

interface PanelSource {
  getSnapshot(): { activePanelId: unknown }
  subscribe(listener: () => void): () => void
}

export interface DrawerDeps {
  doc: Document
  win: Window
  prefs: PrefsStore
  toggleSidebar: () => void
  panelInfo?: PanelSource
}

const SETTLE_MS = 350
const SWIPE_PX = 56

export function frameOf(doc: Document): HTMLElement | null {
  return doc.querySelector('[data-shell-overlay]')?.parentElement ?? null
}

export function createDrawerController({ doc, win, prefs, toggleSidebar, panelInfo }: DrawerDeps): DrawerController {
  let settling = false
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  let lastSession: string | undefined
  const isNative = () => frameOf(doc)?.hasAttribute('data-sidebar-drawer') === true
  const isMobile = () => {
    const current = prefs.getSnapshot()
    if (!current.mobileDrawer) return false
    if (isNative()) return true
    try { return win.matchMedia(mobileQuery(current)).matches } catch { return win.innerWidth <= current.breakpoint }
  }
  const isOpen = () => {
    const frame = frameOf(doc)
    return frame !== null && !frame.hasAttribute('data-sidebar-collapsed')
  }
  const toggle = () => {
    settling = true
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => { settling = false }, SETTLE_MS)
    toggleSidebar()
  }
  const close = () => {
    // Several navigation signals can arrive for one tap; toggling twice
    // before the frame re-renders would reopen the drawer.
    if (settling || !isMobile() || !isOpen()) return
    toggle()
  }
  const onSession = (sessionId: string) => {
    const changed = lastSession !== undefined && lastSession !== sessionId
    lastSession = sessionId
    if (changed) close()
  }

  const disposers: Array<() => void> = []
  if (panelInfo) {
    let panel = panelInfo.getSnapshot().activePanelId
    disposers.push(panelInfo.subscribe(() => {
      const next = panelInfo.getSnapshot().activePanelId
      if (next === panel) return
      panel = next
      // The shell's selectPanel already closes its drawer; a second toggle
      // before the frame re-renders would reopen it.
      if (!isNative()) close()
    }))
  }
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null
    if (!target?.closest || !isMobile()) return
    // "New session" (and the brand that also starts one) may leave no Session
    // selected, so no Session report would follow; close explicitly.
    if (target.closest(`${SIDEBAR_COL} [class*="_newSession"], ${SIDEBAR_COL} [class*="_brand"]`)) win.setTimeout(close, 0)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented || isNative() || !isMobile() || !isOpen()) return
    if (doc.querySelector('[role="menu"], [role="dialog"]:not([data-dsh-appearance-tray])')) return
    close()
  }
  let touch: { x: number; y: number } | undefined
  const onTouchStart = (event: TouchEvent) => {
    const target = event.target as Element | null
    touch = undefined
    if (event.touches.length !== 1 || !isMobile() || !isOpen() || !target?.closest) return
    if (!target.closest(`${SIDEBAR_COL}, [data-dsh-appearance-backdrop], [data-sidebar-mask]`)) return
    touch = { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }
  const onTouchEnd = (event: TouchEvent) => {
    const start = touch
    touch = undefined
    const end = event.changedTouches[0]
    if (!start || !end) return
    const dx = end.clientX - start.x, dy = end.clientY - start.y
    if (dx < -SWIPE_PX && Math.abs(dy) < Math.abs(dx) * 0.6) close()
  }
  doc.addEventListener('click', onClick)
  doc.addEventListener('keydown', onKeyDown)
  doc.addEventListener('touchstart', onTouchStart, { passive: true })
  doc.addEventListener('touchend', onTouchEnd, { passive: true })
  disposers.push(() => {
    doc.removeEventListener('click', onClick)
    doc.removeEventListener('keydown', onKeyDown)
    doc.removeEventListener('touchstart', onTouchStart)
    doc.removeEventListener('touchend', onTouchEnd)
    clearTimeout(settleTimer)
  })
  return {
    toggle, close, isOpen, isMobile, isNative, onSession,
    dispose: () => { for (const dispose of disposers.splice(0).reverse()) dispose() },
  }
}
