// The shipped lib/client.js running against the real rc.5 slot renderer
// (@deepseek-ai/dsh-client-ui-renderer) in jsdom: composer grouping, tray
// rendering with the original inject/locale faces, and the drawer controls.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { act, cordis, dom, loaded, loadBrowserModule, React, renderer } from './harness.mjs'

const h = React.createElement
const w = dom.window
const tick = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

function observable(initial) {
  let value = initial
  const listeners = new Set()
  return {
    getSnapshot: () => value,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    set: next => { value = next; for (const listener of [...listeners]) listener() },
  }
}

// --- a miniature rc.5 shell -------------------------------------------------
const ctx = new cordis.Context()
await ctx.plugin(renderer)

const panelInfo = observable({ activePanelId: null })
const layout = { toggles: 0, toggleSidebar() {
  this.toggles++
  const frame = document.querySelector('[data-shell-overlay]').parentElement
  if (frame.hasAttribute('data-sidebar-collapsed')) frame.removeAttribute('data-sidebar-collapsed')
  else frame.setAttribute('data-sidebar-collapsed', '')
}, panelInfo }
ctx.provide('layout'); ctx.set('layout', layout)

const dictionaries = {}
const localeRevision = observable({ revision: 0 })
const bind = ns => key => dictionaries[ns]?.[key] ?? `${ns}:${key}`
ctx.provide('locale'); ctx.set('locale', {
  register: (ns, lang, dict) => { if (lang === 'zh') dictionaries[ns] = dict; return () => {} },
  bind,
})
ctx.slots.installLocale({ ...localeRevision, bind })

let session = 's1'
const binding = id => ({ key: id, ctx, hooks: {}, keyedHooks: {}, props: { sessionId: id } })
const currentBinding = observable(binding(session))
ctx.slots.installScope('session', { current: currentBinding, bindingSource: () => currentBinding,
  renderArea: (value, { empty, children }) => value.key === undefined ? (empty?.() ?? null) : h(React.Fragment, null, children) })
ctx.slots.provideRoot({ hooks: { panelInfo } })

function Shell({ renderSlot }) {
  return h('div', { className: 'pI_x6G_frame', 'data-sidebar-collapsed': '' },
    h('div', { className: 'pI_x6G_sidebarCol' }, h('button', { className: 'hHd-Xa_newSession', id: 'new-session' }, 'new')),
    h('div', { className: 'pI_x6G_centerCol' },
      h('header', { 'data-window-drag': true }, h('div', { 'data-conversation-header-leading': '' }, renderSlot('conversation.header.leading', {}))),
      h('div', { id: 'left' }, renderSlot('conversation.input.left', {})),
      h('div', { id: 'right' }, renderSlot('conversation.input.right', {})),
      h('div', { id: 'settings' }, renderSlot('settings.section', {}))),
    h('div', { 'data-shell-overlay': true }, renderSlot('shell.overlay', {})))
}
ctx.slots.register({ name: 'root', children: {
  'conversation.input.left': { kind: 'list', scope: 'session' },
  'conversation.input.right': { kind: 'list', scope: 'session' },
  'conversation.header.leading': { kind: 'single', scope: 'root' },
  'shell.overlay': { kind: 'list', scope: 'root' },
  'settings.section': { kind: 'list', scope: 'root' },
} }, Shell)

// --- foreign plugins, registered from their own fibers -----------------------
function GooglePill({ t, face, sessionId }) {
  return h('button', { className: 'google-pill', 'data-session': sessionId }, `${t('label')}:${face.value}`)
}
function ImagePill({ scope }) { return h('button', { className: 'image-pill' }, scope) }
function Hidden() { return null }
const foreign = ctx.plugin({ name: 'foreign', inject: ['slots', 'locale'], apply(child) {
  child.effect(() => child.locale.register('googleNative', 'zh', { label: '原生' }))
  child.slots.inject('conversation.input.left', () => child.slots.register({
    name: 'conversation.input.left', id: 'google-native-options', order: 15, locale: 'googleNative',
    inject: sessionId => ({ face: { value: `face-${sessionId}` } }),
  }, GooglePill))
  child.slots.inject('conversation.input.right', () => child.slots.register({
    name: 'conversation.input.right', id: 'image-provider', order: 10, inject: () => ({ scope: 'img' }),
  }, ImagePill))
  child.slots.inject('conversation.input.left', () => child.slots.register({
    name: 'conversation.input.left', id: 'hidden-when-inapplicable', order: 20,
  }, Hidden))
} })
await foreign

// --- the plugin under test -------------------------------------------------
loadBrowserModule(fileURLToPath(new URL('../lib/client.js', import.meta.url)))
const appearance = loaded['dsh-appearance']
assert.deepEqual(appearance.inject, ['slots', 'layout', 'locale'])
const fiber = ctx.plugin(appearance)
await fiber

const container = document.getElementById('app')
let unmount
await act(async () => { unmount = ctx.uiRenderer.mount(container) })
await tick(); await tick()

const left = () => document.getElementById('left')
const right = () => document.getElementById('right')
const panel = () => document.querySelector('.dsha-tray-panel')
const trigger = () => left().querySelector('.dsha-tray-trigger')

test('foreign composer buttons leave the row and render inside one tray', async () => {
  assert.equal(left().querySelector('.google-pill'), null, 'left-row plugin button hidden')
  assert.equal(right().querySelector('.image-pill'), null, 'right-row plugin button hidden')
  assert.ok(trigger(), 'one tray button in the row')
  assert.equal(left().querySelectorAll('button').length, 1)
  const items = panel().querySelector('.dsha-tray-items')
  assert.deepEqual([...items.querySelectorAll('button')].map(node => node.className), ['google-pill', 'image-pill'], 'left entries first, then right')
  assert.equal(trigger().querySelector('.dsha-tray-count').textContent, '2', 'entries rendering nothing are not counted')
  assert.equal(panel().hidden, true)
})

test('mirrored entries keep their own inject face, locale and Session props', () => {
  const pill = panel().querySelector('.google-pill')
  assert.equal(pill.textContent, '原生:face-s1')
  assert.equal(pill.dataset.session, 's1')
  assert.equal(panel().querySelector('.image-pill').textContent, 'img')
})

test('the tray opens, ignores clicks in portals and closes outside or on Escape', async () => {
  await act(async () => trigger().dispatchEvent(new w.MouseEvent('click', { bubbles: true })))
  assert.equal(panel().hidden, false)
  assert.equal(trigger().getAttribute('aria-expanded'), 'true')
  // A plugin's own popover portalled to <body> is not "outside".
  const popover = document.createElement('div'); document.body.append(popover)
  await act(async () => popover.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true })))
  assert.equal(panel().hidden, false)
  await act(async () => panel().querySelector('.google-pill').dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true })))
  assert.equal(panel().hidden, false)
  await act(async () => document.getElementById('settings').dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true })))
  assert.equal(panel().hidden, true, 'pointerdown elsewhere in the app closes it')
  await act(async () => trigger().dispatchEvent(new w.MouseEvent('click', { bubbles: true })))
  await act(async () => document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(panel().hidden, true)
  popover.remove()
})

test('a foreign plugin unloading takes its tray item with it', async () => {
  const late = ctx.plugin({ name: 'late', inject: ['slots'], apply(child) {
    child.slots.inject('conversation.input.right', () => child.slots.register({ name: 'conversation.input.right', id: 'late' },
      () => h('button', { className: 'late-pill' }, 'late')))
  } })
  await late; await tick(); await tick()
  assert.ok(panel().querySelector('.late-pill'), 'late registrations are mirrored too')
  assert.equal(right().querySelector('.late-pill'), null)
  await late.dispose(); await tick(); await tick()
  assert.equal(panel().querySelector('.late-pill'), null)
  assert.equal(trigger().querySelector('.dsha-tray-count').textContent, '2')
})

test('turning grouping off restores the original buttons in place', async () => {
  await act(async () => { localStorage.setItem('dsh-appearance:prefs:v1', JSON.stringify({ groupComposer: false })); w.dispatchEvent(new w.StorageEvent('storage', { key: 'dsh-appearance:prefs:v1' })) })
  await tick(); await tick()
  assert.ok(left().querySelector('.google-pill'), 'left button back in the row')
  assert.ok(right().querySelector('.image-pill'), 'right button back in the row')
  assert.equal(trigger(), null)
  await act(async () => { localStorage.removeItem('dsh-appearance:prefs:v1'); w.dispatchEvent(new w.StorageEvent('storage', { key: 'dsh-appearance:prefs:v1' })) })
  await tick(); await tick()
  assert.equal(left().querySelector('.google-pill'), null)
  assert.ok(panel().querySelector('.google-pill'))
})

test('the header and overlay controls toggle the layout sidebar', async () => {
  const menu = document.querySelector('[data-dsh-appearance-menu="header"]')
  assert.ok(menu, 'top-left button in conversation.header.leading')
  assert.ok(menu.classList.contains('dsha-mobile-only'), 'CSS limits it to mobile')
  assert.ok(document.querySelector('[data-dsh-appearance-backdrop]'))
  assert.equal(document.querySelector('[data-dsh-appearance-menu="panel"]'), null, 'no floating button on the Conversation view')
  const before = layout.toggles
  await act(async () => menu.dispatchEvent(new w.MouseEvent('click', { bubbles: true })))
  assert.equal(layout.toggles, before + 1)
  await act(async () => panelInfo.set({ activePanelId: 'plugins' }))
  await tick()
  assert.ok(document.querySelector('[data-dsh-appearance-menu="panel"]'), 'floating button on global panels')
  await act(async () => panelInfo.set({ activePanelId: null }))
})

test('on mobile, navigation, backdrop taps and New Session close the drawer', async () => {
  w.matchMedia = query => ({ matches: query === '(max-width: 768px)', media: query, addEventListener() {}, removeEventListener() {} })
  const frame = document.querySelector('[data-shell-overlay]').parentElement
  const open = async () => { if (frame.hasAttribute('data-sidebar-collapsed')) layout.toggleSidebar(); await new Promise(r => setTimeout(r, 400)) }
  const isOpen = () => !frame.hasAttribute('data-sidebar-collapsed')

  await open()
  await act(async () => panelInfo.set({ activePanelId: 'plugins' }))
  assert.equal(isOpen(), false, 'selecting a global panel closes it')
  await act(async () => panelInfo.set({ activePanelId: null }))

  await open()
  await act(async () => document.querySelector('[data-dsh-appearance-backdrop]').dispatchEvent(new w.MouseEvent('click', { bubbles: true })))
  assert.equal(isOpen(), false, 'backdrop tap closes it')

  await open()
  await act(async () => { document.getElementById('new-session').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await new Promise(r => setTimeout(r, 5)) })
  assert.equal(isOpen(), false, 'New Session closes it')

  await open()
  await act(async () => { currentBinding.set(binding('s2')) })
  await tick()
  assert.equal(isOpen(), false, 'switching Session closes it')
  assert.equal(panel().querySelector('.google-pill').textContent, '原生:face-s2', 'tray follows the new Session')

  await open()
  await act(async () => document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(isOpen(), false, 'Escape closes it')
})

test('settings section renders and writes per-device preferences', async () => {
  const settings = document.querySelector('[data-dsh-appearance-settings]')
  assert.ok(settings)
  const boxes = settings.querySelectorAll('input[type=checkbox]')
  assert.equal(boxes.length, 3)
  await act(async () => boxes[2].click())
  assert.equal(JSON.parse(localStorage.getItem('dsh-appearance:prefs:v1')).mobilePolish, false)
  const style = document.querySelector('style[data-plugin="dsh-appearance"]').textContent
  assert.ok(!style.includes('safe-area-inset-bottom'), 'polish CSS removed')
  await act(async () => settings.querySelector('.dsha-settings-reset').click())
  assert.equal(localStorage.getItem('dsh-appearance:prefs:v1'), null)
})

test('unloading the plugin restores every original entry and removes its DOM', async () => {
  await fiber.dispose(); await tick(); await tick()
  assert.ok(left().querySelector('.google-pill'))
  assert.ok(right().querySelector('.image-pill'))
  assert.equal(document.querySelector('.dsha-tray-trigger, .dsha-tray-panel, [data-dsh-appearance-menu], [data-dsh-appearance-backdrop]'), null)
  assert.equal(document.querySelector('style[data-plugin="dsh-appearance"]'), null)
  await act(async () => unmount())
})
