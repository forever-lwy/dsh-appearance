import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { AppearanceSettings, ComposerEntry, DrawerOverlay, HeaderMenuButton, type ComposerEntryFace, type DrawerFace } from './components.js'
import { createDrawerController } from './drawer.js'
import { startHasPatch } from './has-patch.js'
import { en, NAMESPACE, zh, type Translate } from './locales.js'
import { startMirror, TRAY_SLOT, type SlotsLike } from './mirror.js'
import { createPrefsStore } from './prefs.js'
import { buildCss } from './styles.js'

export const name = 'dsh-appearance-client'
export const inject = ['slots', 'layout', 'locale']

/** Null-rendering shadow that hides a mirrored entry from the composer row. */
export function TrayShadow(): null { return null }

export function apply(ctx: Context): void {
  const slots = ctx.slots as any
  const prefs = createPrefsStore(window)
  ctx.effect(() => () => prefs.dispose(), 'appearance: preferences')
  ctx.effect(() => ctx.locale.register(NAMESPACE, 'zh', zh), 'appearance: Chinese')
  ctx.effect(() => ctx.locale.register(NAMESPACE, 'en', en), 'appearance: English')
  const bound = ctx.locale.bind(NAMESPACE)
  const t: Translate = (key, params) => (bound as (key: string, params?: Record<string, unknown>) => string)(key, params)

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-appearance'
    const render = () => { style.textContent = buildCss(prefs.getSnapshot()) }
    render()
    document.head.appendChild(style)
    const stop = prefs.subscribe(render)
    return () => { stop(); style.remove() }
  }, 'appearance: styles')

  ctx.effect(() => startHasPatch(document, window), 'appearance: official :has() rewrite')

  const drawer = createDrawerController({
    doc: document, win: window, prefs,
    toggleSidebar: () => ctx.layout.toggleSidebar(),
    panelInfo: ctx.layout.panelInfo as any,
  })
  ctx.effect(() => () => drawer.dispose(), 'appearance: drawer controller')

  const composerFace: ComposerEntryFace = { prefs, t, onSession: sessionId => drawer.onSession(sessionId) }
  const drawerFace: DrawerFace = { prefs, t, toggle: () => drawer.toggle(), close: () => drawer.close() }

  // 1. The composer entry: the tray button, which declares the tray list.
  slots.inject('conversation.input.left', () => slots.register({
    name: 'conversation.input.left', id: 'dsh-appearance-tray', order: -1000,
    children: { [TRAY_SLOT]: { kind: 'list', scope: 'session' } },
    inject: () => composerFace,
  }, ComposerEntry))

  // 2. While the tray exists and grouping is on, mirror foreign entries into it.
  slots.inject(TRAY_SLOT, () => {
    let stop: (() => void) | undefined
    let disposed = false
    const sync = () => {
      if (disposed) return
      const wanted = prefs.getSnapshot().groupComposer
      if (wanted && !stop) {
        stop = startMirror(slots as SlotsLike, {
          own: new Set([ComposerEntry]), shadow: TrayShadow,
          onError: (error, key, id) => console.warn(`[dsh-appearance] kept ${key}#${id} in the composer row`, error),
        })
      } else if (!wanted && stop) { stop(); stop = undefined }
    }
    // The tray is declared inside the registering call; start right after it.
    queueMicrotask(sync)
    const unsubscribe = prefs.subscribe(sync)
    return () => { disposed = true; unsubscribe(); stop?.(); stop = undefined }
  })

  // 3. The top-left button in the Conversation header (mobile only, via CSS).
  slots.inject('conversation.header.leading', () => slots.register({
    name: 'conversation.header.leading', priority: 50, inject: () => drawerFace,
  }, HeaderMenuButton))

  // 4. Backdrop + floating button for global panels.
  slots.inject('shell.overlay', () => slots.register({
    name: 'shell.overlay', id: 'dsh-appearance-drawer', order: 1000, inject: () => drawerFace,
  }, DrawerOverlay))

  // 5. Settings page.
  const settingsFace = { prefs, t }
  slots.inject('settings.section', () => slots.register({
    name: 'settings.section', id: 'dsh-appearance', order: 70, label: () => t('nav'), inject: () => settingsFace,
  }, AppearanceSettings))
}

export { AppearanceSettings, ComposerEntry, DrawerOverlay, HeaderMenuButton }
