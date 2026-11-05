import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { TRAY_SLOT } from './mirror.js'
import { DEFAULT_PREFS, MAX_BREAKPOINT, MIN_BREAKPOINT, type Prefs, type PrefsStore } from './prefs.js'
import { mobileQuery } from './styles.js'
import { fallbackT, type Translate } from './locales.js'

export function usePrefs(store: PrefsStore): Prefs {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

function format(t: Translate, key: string, params: Record<string, unknown>): string {
  return t(key).replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''))
}

const keepFocus = (event: { preventDefault(): void }) => event.preventDefault()

function TrayIcon() {
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="9" y="2" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="2" y="9" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M11.5 9v5M9 11.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
}

function MenuIcon() {
  return <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
    <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
}

/**
 * Count the rendered tray entries (entries may legitimately render nothing).
 * The rc.5 renderer wraps every slot outlet in a `display: contents`
 * `div[data-slot]`, so those wrappers are looked through, not counted.
 */
export function countItems(node: Element): number {
  let count = 0
  for (const child of Array.from(node.children)) {
    if (child.hasAttribute('data-slot')) count += countItems(child)
    else if (!(child as HTMLElement).hidden) count++
  }
  return count
}

export interface ComposerEntryFace {
  prefs: PrefsStore
  t?: Translate
  onSession?: (sessionId: string) => void
}

interface ComposerEntryProps extends ComposerEntryFace {
  sessionId: string
  renderSlot: (key: string, owner: object) => ReactNode
}

/**
 * The single composer entry this plugin owns. It always reports the current
 * Session (the drawer closes on navigation) and, when grouping is enabled,
 * renders the tray button whose panel hosts the mirrored plugin entries.
 */
export function ComposerEntry(props: ComposerEntryProps) {
  const prefs = usePrefs(props.prefs)
  const { onSession, sessionId } = props
  useEffect(() => { onSession?.(sessionId) }, [onSession, sessionId])
  if (!prefs.groupComposer) return null
  return <ComposerTray key={sessionId} renderSlot={props.renderSlot} t={props.t ?? fallbackT} breakpoint={prefs.breakpoint}/>
}

export function ComposerTray({ renderSlot, t, breakpoint }: {
  renderSlot: (key: string, owner: object) => ReactNode
  t: Translate
  breakpoint: number
}) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const items = useRef<HTMLDivElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    const node = items.current
    if (!node) return
    const update = () => setCount(countItems(node))
    update()
    const observer = new MutationObserver(update)
    observer.observe(node, { childList: true, attributes: true, subtree: true, attributeFilter: ['hidden'] })
    return () => observer.disconnect()
  }, [])
  useEffect(() => { if (count === 0) setOpen(false) }, [count])

  const place = useCallback(() => {
    const button = trigger.current, box = panel.current
    if (!button || !box || box.hidden) return
    const rect = button.getBoundingClientRect()
    const width = box.offsetWidth
    const viewport = document.documentElement.clientWidth || window.innerWidth
    const left = Math.max(8, Math.min(rect.left, viewport - 8 - width))
    box.style.left = `${Math.round(left)}px`
    box.style.bottom = `${Math.round(window.innerHeight - rect.top + 8)}px`
    box.style.maxHeight = `${Math.max(120, Math.min(420, Math.round(rect.top - 16)))}px`
  }, [])
  useLayoutEffect(() => { if (open) place() }, [open, count, place])

  useEffect(() => {
    if (!open) return
    const button = trigger.current
    const appRoot = button?.closest('body > *') ?? null
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target || panel.current?.contains(target) || button?.contains(target)) return
      // Popovers that plugins portal to <body> are not "outside" the tray.
      if (appRoot && !appRoot.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    const onReflow = () => place()
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [open, place])

  const label = t('trayLabel')
  return <>
    <button ref={trigger} type="button" className="dsha-tray-trigger" hidden={count === 0}
      aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
      data-breakpoint={breakpoint} onMouseDown={keepFocus} onClick={() => setOpen(value => !value)}>
      <TrayIcon/>
      <span className="dsha-tray-count">{count}</span>
    </button>
    {createPortal(<div ref={panel} id={id} role="dialog" aria-label={t('trayTitle')} className="dsha-tray-panel"
      hidden={!open} data-dsh-appearance-tray="">
      <p className="dsha-tray-title">{t('trayTitle')}</p>
      <div ref={items} className="dsha-tray-items">{renderSlot(TRAY_SLOT, {})}</div>
      {count === 0 && <p className="dsha-tray-empty">{t('trayEmpty')}</p>}
    </div>, document.body)}
  </>
}

export interface DrawerFace {
  prefs: PrefsStore
  toggle: () => void
  close: () => void
  t?: Translate
}

/** Header leading seat: the top-left button on the Conversation view. */
export function HeaderMenuButton(props: DrawerFace) {
  const prefs = usePrefs(props.prefs)
  if (!prefs.mobileDrawer) return null
  const t = props.t ?? fallbackT
  return <button type="button" className="dsha-menu-button dsha-mobile-only" aria-label={t('openSidebar')} title={t('openSidebar')}
    data-dsh-appearance-menu="header" onClick={props.toggle}><MenuIcon/></button>
}

/**
 * Shell overlay: the drawer backdrop and, on global panels (Plugins and
 * other full-page panels without the Conversation header), a floating
 * top-left button. CSS shows both only on mobile.
 */
export function DrawerOverlay(props: DrawerFace & { usePanelInfo?: (selector: (info: { activePanelId: unknown }) => unknown) => unknown }) {
  const prefs = usePrefs(props.prefs)
  const panelActive = props.usePanelInfo ? props.usePanelInfo(info => info.activePanelId !== null) === true : false
  if (!prefs.mobileDrawer) return null
  const t = props.t ?? fallbackT
  return <>
    <div className="dsha-backdrop" aria-hidden="true" data-dsh-appearance-backdrop="" onClick={props.close}/>
    {panelActive && <button type="button" className="dsha-menu-button dsha-mobile-only dsha-panel-menu" aria-label={t('openSidebar')}
      title={t('openSidebar')} data-dsh-appearance-menu="panel" onClick={props.toggle}><MenuIcon/></button>}
  </>
}

function useViewportWidth(): number {
  const subscribe = useCallback((listener: () => void) => {
    window.addEventListener('resize', listener)
    return () => window.removeEventListener('resize', listener)
  }, [])
  return useSyncExternalStore(subscribe, () => window.innerWidth, () => 0)
}

function Toggle({ checked, onChange, title, hint }: { checked: boolean; onChange: (value: boolean) => void; title: string; hint: string }) {
  return <label className="dsha-setting">
    <input type="checkbox" checked={checked} onChange={event => onChange(event.currentTarget.checked)}/>
    <span><span className="dsha-setting-title">{title}</span><span className="dsha-setting-hint">{hint}</span></span>
  </label>
}

export function AppearanceSettings(props: { prefs: PrefsStore; t?: Translate }) {
  const prefs = usePrefs(props.prefs)
  const t = props.t ?? fallbackT
  const width = useViewportWidth()
  const mobile = typeof window.matchMedia === 'function' ? window.matchMedia(mobileQuery(prefs)).matches : width <= prefs.breakpoint
  const [draft, setDraft] = useState(String(prefs.breakpoint))
  useEffect(() => { setDraft(String(prefs.breakpoint)) }, [prefs.breakpoint])
  const commit = () => {
    const value = Number(draft)
    if (Number.isFinite(value)) props.prefs.update({ breakpoint: value })
    else setDraft(String(prefs.breakpoint))
  }
  const update = (patch: Partial<Prefs>) => props.prefs.update(patch)
  return <div className="dsha-settings" data-dsh-appearance-settings="">
    <h2>{t('settingsTitle')}</h2>
    <p className="dsha-settings-intro">{t('settingsIntro')}</p>
    <Toggle checked={prefs.groupComposer} onChange={value => update({ groupComposer: value })} title={t('groupComposer')} hint={t('groupComposerHint')}/>
    <Toggle checked={prefs.mobileDrawer} onChange={value => update({ mobileDrawer: value })} title={t('mobileDrawer')} hint={t('mobileDrawerHint')}/>
    <Toggle checked={prefs.mobilePolish} onChange={value => update({ mobilePolish: value })} title={t('mobilePolish')} hint={t('mobilePolishHint')}/>
    <label className="dsha-setting dsha-setting-number">
      <span><span className="dsha-setting-title">{t('breakpoint')}</span><span className="dsha-setting-hint">{t('breakpointHint')}</span></span>
      <input type="number" inputMode="numeric" min={MIN_BREAKPOINT} max={MAX_BREAKPOINT} step={1} value={draft}
        onChange={event => setDraft(event.currentTarget.value)} onBlur={commit}
        onKeyDown={event => { if (event.key === 'Enter') commit() }}/>
    </label>
    <p className="dsha-settings-status">{format(t, 'current', { width, mode: t(mobile ? 'modeMobile' : 'modeDesktop') })}</p>
    <button type="button" className="dsha-settings-reset" onClick={() => props.prefs.reset()}
      disabled={JSON.stringify(prefs) === JSON.stringify(DEFAULT_PREFS)}>{t('reset')}</button>
  </div>
}
