import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'
import { foreignWinners, SHADOW_OFFSET, startMirror, TRAY_SLOT } from '../lib/client/mirror.js'
import { buildCss, CENTER_COL, FRAME, RIGHTBAR_COL, SIDEBAR_COL } from '../lib/client/styles.js'
import { DEFAULT_PREFS, normalizePrefs, createPrefsStore, STORAGE_KEY } from '../lib/client/prefs.js'

const require = createRequire(import.meta.url)
const project = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

// --- manifest & bundle patch -------------------------------------------------
test('manifest declares the bundle patch, both entries and no dsh version gate', () => {
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(manifest.engines.dsh, '*', 'never gate on the dsh version')
  assert.equal(manifest.main, 'lib/index.js')
  assert.equal(manifest.exports['./client'], './lib/client.js')
  assert.equal(manifest.dsh.client.platform, 'web')
  for (const name of manifest.dsh.client.inject) assert.match(name, /^@deepseek-ai\/dsh-client-/)
  assert.ok(manifest.files.includes('lib') && manifest.files.includes('cordis.patch.yml'))
  assert.equal(manifest.dependencies, undefined, 'no runtime dependencies to install')
})

test('the patch adds exactly one root row and changes no official row', () => {
  const layers = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'].flatMap(name => {
    const path = require.resolve(name + '/package.json')
    const pkg = JSON.parse(readFileSync(path, 'utf8'))
    assert.equal(pkg.version, '0.2.2-rc.1')
    return [].concat(pkg.dsh.bundle.patch).map(patch => loadOverlayPatches('appearance-test', resolve(dirname(path), patch)))
  })
  const before = composeEntries(layers)
  const warnings = []
  const after = composeEntries([...layers, loadOverlayPatches('appearance-test', resolve(project, 'cordis.patch.yml'))], message => warnings.push(message))
  assert.deepEqual(warnings, [])
  const added = after.filter(row => !before.some(other => other.id === row.id))
  assert.deepEqual(added.map(row => [row.id, row.name]), [['appearance', '@forever-lwy/dsh-appearance']])
  for (const row of before) assert.deepEqual(after.find(other => other.id === row.id), row)
})

test('the host entry loads and does nothing', async () => {
  const host = await import('../lib/index.js')
  assert.equal(host.name, 'dsh-appearance')
  assert.equal(host.apply({}), undefined)
})

test('the browser bundle only requires modules the DSH loader provides', () => {
  const text = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.ok(text.startsWith('window.__ModuleLoader__.load({id:"@forever-lwy/dsh-appearance"'))
  const required = new Set([...text.matchAll(/require\("([^"]+)"\)/g)].map(match => match[1]))
  for (const name of required) assert.ok(['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/cordis'].includes(name), name)
})

// --- mirror against the real rc.5 SlotCore ----------------------------------
function shell() {
  const core = new SlotCore()
  core.register({ name: 'root', children: {
    'conversation.input.left': { kind: 'list', scope: 'session' },
    'conversation.input.right': { kind: 'list', scope: 'session' },
  } }, () => null)
  return core
}
const Own = () => null
const Shadow = () => null
const winnerOf = (core, key, id) => core.entriesOfSlot(key).find(entry => entry.options.id === id)?.component

test('foreign winners skip own components and shadows and follow priority', () => {
  const a = () => null, b = () => null
  const entries = [
    { component: Own, options: { id: 'own' } },
    { component: a, options: { id: 'x' } },
    { component: b, options: { id: 'x', priority: -5 } },
    { component: Shadow, options: { id: 'x', priority: -2000 } },
  ]
  const winners = foreignWinners(entries, new Set([Own]), Shadow)
  assert.deepEqual([...winners.keys()], ['x'])
  assert.equal(winners.get('x').component, b)
})

test('mirror shadows foreign entries, copies their faces into the tray and cleans up', async () => {
  const core = shell()
  const disposeTray = core.register({ name: 'conversation.input.left', id: 'tray', children: { [TRAY_SLOT]: { kind: 'list', scope: 'session' } } }, Own)
  const Pill = () => null, Right = () => null, Parent = () => null
  const inject = () => ({ value: 1 })
  core.register({ name: 'conversation.input.left', id: 'pill', order: 15, locale: 'googleNative', inject }, Pill)
  core.register({ name: 'conversation.input.right', id: 'img', order: 10 }, Right)
  core.register({ name: 'conversation.input.left', id: 'parent', children: { 'x.child': { kind: 'list', scope: 'session' } } }, Parent)
  const changes = []
  const stop = startMirror(core, { own: new Set([Own]), shadow: Shadow, onChange: ids => changes.push(ids) })

  assert.equal(winnerOf(core, 'conversation.input.left', 'pill'), Shadow)
  assert.equal(winnerOf(core, 'conversation.input.right', 'img'), Shadow)
  assert.equal(winnerOf(core, 'conversation.input.left', 'parent'), Parent, 'entries declaring children stay in place')
  assert.equal(winnerOf(core, 'conversation.input.left', 'tray'), Own)
  const shadowEntry = core.entries('conversation.input.left').find(entry => entry.component === Shadow)
  assert.equal(shadowEntry.options.priority, -SHADOW_OFFSET)
  const tray = core.entriesOfSlot(TRAY_SLOT)
  assert.deepEqual(tray.map(entry => [entry.options.id, entry.component]), [['left:pill', Pill], ['right:img', Right]])
  assert.equal(tray[0].inject, inject)
  assert.equal(tray[0].locale, 'googleNative')
  assert.ok(tray[0].options.order < tray[1].options.order, 'left before right')

  await flush()
  assert.deepEqual(changes.at(-1), ['conversation.input.left#pill', 'conversation.input.right#img'], 'own registrations do not churn')
  const count = changes.length
  await flush()
  assert.equal(changes.length, count, 'reconcile settles')

  stop()
  assert.equal(winnerOf(core, 'conversation.input.left', 'pill'), Pill)
  assert.equal(winnerOf(core, 'conversation.input.right', 'img'), Right)
  assert.deepEqual(core.entriesOfSlot(TRAY_SLOT), [])
  disposeTray()
})

test('mirror follows registrations, unloads and another plugin\'s shadow', async () => {
  const core = shell()
  core.register({ name: 'conversation.input.left', id: 'tray', children: { [TRAY_SLOT]: { kind: 'list', scope: 'session' } } }, Own)
  const Original = () => null, Replacement = () => null
  core.register({ name: 'conversation.input.left', id: 'x' }, Original)
  const stop = startMirror(core, { own: new Set([Own]), shadow: Shadow })
  assert.equal(core.entriesOfSlot(TRAY_SLOT)[0].component, Original)

  // Another plugin shadows the official entry: the tray shows what would render.
  const disposeReplacement = core.register({ name: 'conversation.input.left', id: 'x', priority: -10 }, Replacement)
  await flush()
  assert.equal(core.entriesOfSlot(TRAY_SLOT)[0].component, Replacement)
  assert.equal(winnerOf(core, 'conversation.input.left', 'x'), Shadow)
  disposeReplacement()
  await flush()
  assert.equal(core.entriesOfSlot(TRAY_SLOT)[0].component, Original)

  const Late = () => null
  const disposeLate = core.register({ name: 'conversation.input.right', id: 'late' }, Late)
  await flush()
  assert.ok(core.entriesOfSlot(TRAY_SLOT).some(entry => entry.component === Late))
  disposeLate()
  await flush()
  assert.ok(!core.entriesOfSlot(TRAY_SLOT).some(entry => entry.component === Late))
  assert.ok(!core.entries('conversation.input.right').some(entry => entry.options.id === 'late'), 'its shadow is gone too')
  stop()
})

test('the tray collapsing with the composer leaves no stale state behind', async () => {
  const core = shell()
  const disposeTray = core.register({ name: 'conversation.input.left', id: 'tray', children: { [TRAY_SLOT]: { kind: 'list', scope: 'session' } } }, Own)
  const Pill = () => null
  core.register({ name: 'conversation.input.left', id: 'pill' }, Pill)
  const stop = startMirror(core, { own: new Set([Own]), shadow: Shadow })
  disposeTray() // collapses the tray slot and its mirrored entries
  stop()        // must not throw on already-collapsed registrations
  assert.equal(winnerOf(core, 'conversation.input.left', 'pill'), Pill)
})

// --- styles against the real rc.5 layout class names --------------------------
function realClass(pkg, local) {
  const text = readFileSync(require.resolve(`@deepseek-ai/${pkg}/package.json`).replace(/package\.json$/, 'lib/client.js'), 'utf8')
  const match = text.match(new RegExp(`"${local}": "([^"]+)"`))
  assert.ok(match, `${pkg} still exports CSS module class ${local}`)
  return match[1]
}

test('structural selectors match the real rc.5 AppFrame and sidebar markup', () => {
  const dom = new JSDOM('<!doctype html><body></body>')
  const doc = dom.window.document
  const frame = doc.createElement('div'); frame.className = realClass('dsh-client-ui-layout', 'frame'); frame.setAttribute('data-sidebar-collapsed', 'true')
  const sidebar = doc.createElement('div'); sidebar.className = realClass('dsh-client-ui-layout', 'sidebarCol')
  const center = doc.createElement('div'); center.className = realClass('dsh-client-ui-layout', 'centerCol')
  const rightbar = doc.createElement('div'); rightbar.className = realClass('dsh-client-ui-layout', 'rightbarCol'); rightbar.setAttribute('data-rightbar-col', 'true')
  const overlay = doc.createElement('div'); overlay.className = realClass('dsh-client-ui-layout', 'overlayLayer'); overlay.setAttribute('data-shell-overlay', 'true')
  const inner = doc.createElement('div'); inner.className = realClass('dsh-client-ui-sidebar', 'root')
  sidebar.append(inner)
  frame.append(sidebar, center, rightbar, overlay)
  doc.body.append(frame)
  assert.equal(doc.querySelector(FRAME), frame)
  assert.equal(doc.querySelector(SIDEBAR_COL), sidebar)
  assert.equal(doc.querySelector(CENTER_COL), center)
  assert.equal(doc.querySelector(RIGHTBAR_COL), rightbar)
  assert.equal(doc.querySelectorAll(`${FRAME} > [class*="_sidebarCol"]`).length, 1, 'the sidebar root is not mistaken for the column')
  assert.match(realClass('dsh-client-ui-sidebar', 'newSession'), /_newSession$/)
  assert.match(realClass('dsh-client-ui-sidebar', 'brand'), /_brand$/)
})

test('the layout still renders the attributes the drawer reads', () => {
  const text = readFileSync(require.resolve('@deepseek-ai/dsh-client-ui-layout/package.json').replace(/package\.json$/, 'lib/client.js'), 'utf8')
  for (const needle of ['"data-sidebar-collapsed": sidebarCollapsed', '"data-shell-overlay": true', '"data-rightbar-col": true', 'collapsedWidth = 56', 'SIDEBAR_AUTO_COLLAPSE = 1024'])
    assert.ok(text.includes(needle), needle)
  const conversation = readFileSync(require.resolve('@deepseek-ai/dsh-client-ui-conversation/package.json').replace(/package\.json$/, 'lib/client.js'), 'utf8')
  assert.ok(conversation.includes('renderSlot("conversation.header.leading", {})'))
  assert.ok(conversation.includes('renderSlot("conversation.input.left", {})') && conversation.includes('renderSlot("conversation.input.right", {})'))
})

test('stylesheet follows preferences and breakpoint', () => {
  const all = buildCss(DEFAULT_PREFS)
  assert.ok(all.includes('@media (max-width: 768px)'))
  assert.ok(all.includes('.dsha-tray-panel') && all.includes('.dsha-backdrop') && all.includes('safe-area-inset-bottom'))
  const none = buildCss({ ...DEFAULT_PREFS, groupComposer: false, mobileDrawer: false, mobilePolish: false })
  assert.ok(!none.includes('.dsha-tray-panel') && !none.includes('_sidebarCol') && !none.includes('@media (max-width'))
  assert.ok(buildCss({ ...DEFAULT_PREFS, breakpoint: 600 }).includes('@media (max-width: 600px)'))
  // Every rule block is balanced (catches template mistakes).
  const opens = (all.match(/{/g) ?? []).length, closes = (all.match(/}/g) ?? []).length
  assert.equal(opens, closes)
})

test('preferences normalize, persist and survive a throwing storage', () => {
  assert.deepEqual(normalizePrefs({ breakpoint: 99999, groupComposer: 'yes' }), { ...DEFAULT_PREFS, breakpoint: 1023 })
  assert.equal(normalizePrefs({ breakpoint: 10 }).breakpoint, 480)
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
  const store = createPrefsStore(dom.window)
  let notified = 0
  store.subscribe(() => notified++)
  store.update({ mobileDrawer: false })
  assert.equal(JSON.parse(dom.window.localStorage.getItem(STORAGE_KEY)).mobileDrawer, false)
  assert.equal(notified, 1)
  store.update({ mobileDrawer: false })
  assert.equal(notified, 1, 'no-op updates do not notify')
  store.reset()
  assert.equal(dom.window.localStorage.getItem(STORAGE_KEY), null)
  const broken = { addEventListener() {}, removeEventListener() {}, get localStorage() { throw new Error('blocked') } }
  const fallback = createPrefsStore(broken)
  fallback.update({ breakpoint: 700 })
  assert.equal(fallback.getSnapshot().breakpoint, 700, 'kept in memory')
})
