import type { Prefs } from './prefs.js'

/**
 * Structural hooks into the rc.5 shell. CSS-module class names carry a build
 * hash prefix (`pI_x6G_sidebarCol`), so we match on the stable local part and
 * on the data attributes the shell renders, never on the hash.
 */
export const FRAME = 'div:has(> [data-shell-overlay])'
export const SIDEBAR_COL = `${FRAME} > [class*="_sidebarCol"]`
export const CENTER_COL = `${FRAME} > [class*="_centerCol"]`
export const RIGHTBAR_COL = `${FRAME} > [data-rightbar-col]`
/**
 * 0.2.2+ ships its own drawer below 768px: the frame carries
 * `data-sidebar-drawer`, and the shell renders an opener in `shell.leading`
 * plus its own mask. While it is active this plugin's drawer stands down, so
 * every drawer rule is scoped to frames without that attribute.
 */
export const NATIVE_DRAWER = `${FRAME}[data-sidebar-drawer]`
const OWN = `${FRAME}:not([data-sidebar-drawer])`
const OWN_SIDEBAR = `${OWN} > [class*="_sidebarCol"]`
const OWN_OPEN = `${OWN}:not([data-sidebar-collapsed])`
const PLAIN_WEB = 'html:not([data-platform="darwin"]):not([data-windows-titlebar]):not(:has([data-sidebar-drawer]))'

export function mobileQuery(prefs: Pick<Prefs, 'breakpoint'>): string {
  return `(max-width: ${prefs.breakpoint}px)`
}

const trayCss = `
.dsha-tray-trigger{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;gap:4px;height:28px;min-width:28px;padding:0 9px 0 8px;border:none;border-radius:999px;corner-shape:round;background:var(--dsw-specific-selector,rgba(128,128,128,.12));color:var(--dsw-alias-label-primary,inherit);font:inherit;font-size:12px;line-height:1;cursor:pointer;transition:background-color .12s}
.dsha-tray-trigger:hover{background:var(--dsw-alias-interactive-bg-hover-solid,rgba(128,128,128,.2))}
.dsha-tray-trigger[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover-solid,rgba(128,128,128,.2));color:var(--dsw-alias-state-business-primary,inherit)}
.dsha-tray-trigger:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:1px}
.dsha-tray-trigger[hidden]{display:none}
.dsha-tray-trigger svg{flex:none}
.dsha-tray-count{min-width:14px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,inherit)}
.dsha-tray-trigger[aria-expanded="true"] .dsha-tray-count{color:inherit}
.dsha-tray-panel{position:fixed;z-index:1050;box-sizing:border-box;max-width:calc(100vw - 16px);max-height:min(60vh,420px);overflow:auto;padding:8px;border:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.25));border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-bg-module-platform,var(--dsw-specific-input-major,#fff));color:var(--dsw-alias-label-primary,#202126);box-shadow:var(--dsw-elevation-prominent,0 8px 32px rgba(0,0,0,.16));font-size:13px;transform-origin:bottom left;animation:dsha-pop .14s var(--ds-ease-in-out,ease-out)}
.dsha-tray-panel[hidden]{display:none}
.dsha-tray-title{margin:0 2px 6px;color:var(--dsw-alias-label-caption,#72757c);font-size:12px;line-height:18px;user-select:none}
.dsha-tray-items{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
.dsha-tray-empty{margin:0;padding:2px;color:var(--dsw-alias-label-caption,#72757c);font-size:12px}
@keyframes dsha-pop{from{opacity:0;transform:translateY(4px) scale(.98)}}
@media (prefers-reduced-motion:reduce){.dsha-tray-panel{animation:none}}
`

const drawerCss = (query: string) => `
.dsha-mobile-only{display:none!important}
@media ${query}{
  .dsha-mobile-only{display:inline-flex!important}
  ${OWN_SIDEBAR}{position:absolute;z-index:30;top:0;bottom:0;left:0;width:min(300px,86vw)!important;max-width:86vw;border-right:none;border-radius:0 16px 16px 0;overflow:hidden;transform:translateX(-104%);visibility:hidden;box-shadow:none;transition:transform .24s var(--ds-ease-in-out,ease),visibility 0s linear .24s,box-shadow .24s}
  ${OWN_SIDEBAR} > :not([data-slot]),${OWN_SIDEBAR} > [data-slot] > *{width:100%!important;max-width:100%}
  ${OWN_OPEN} > [class*="_sidebarCol"]{transform:none;visibility:visible;box-shadow:0 0 0 .5px var(--dsw-alias-border-l3,rgba(128,128,128,.25)),8px 0 40px rgba(0,0,0,.22);transition:transform .24s var(--ds-ease-in-out,ease),visibility 0s,box-shadow .24s}
  ${OWN} > [class*="_centerCol"]{grid-column:1 / 3;grid-row:1}
  ${OWN} > [data-rightbar-col]{grid-column:3;grid-row:1}
  .dsha-backdrop{display:none}
  ${OWN_OPEN} .dsha-backdrop{display:block;position:absolute;inset:0;z-index:1;background:rgba(10,12,20,.38);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);animation:dsha-fade .2s ease-out;touch-action:none}
  ${OWN_OPEN} .dsha-panel-menu{visibility:hidden}
  ${PLAIN_WEB}{--dsh-frame-top-clearance:52px}
}
@keyframes dsha-fade{from{opacity:0}}
${NATIVE_DRAWER} .dsha-menu-button,${NATIVE_DRAWER} .dsha-backdrop{display:none!important}
@media (prefers-reduced-motion:reduce){${OWN_SIDEBAR},.dsha-backdrop{transition:none!important;animation:none!important}}
.dsha-menu-button{align-items:center;justify-content:center;flex:none;width:34px;height:34px;margin-left:-6px;padding:0;border:none;border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary,inherit);cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.dsha-menu-button:hover,.dsha-menu-button:active{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}
.dsha-menu-button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:1px}
.dsha-panel-menu{position:absolute;top:8px;left:8px;z-index:2;margin:0;background:var(--dsw-alias-bg-base,#fff);box-shadow:0 0 0 .5px var(--dsw-alias-border-l2,rgba(128,128,128,.25)),0 2px 10px rgba(0,0,0,.08)}
`

const polishCss = (query: string) => `
@media ${query}{
  ${FRAME}{box-sizing:border-box;padding-bottom:env(safe-area-inset-bottom,0px)}
  ${CENTER_COL} [class*="_body"]{--dsh-composer-side-clearance:8px}
  ${CENTER_COL} header[data-window-drag]{padding-right:12px}
  ${OWN} > [class*="_centerCol"] header[data-window-drag]{padding-left:12px}
  ${CENTER_COL} [contenteditable="true"]{font-size:16px}
  ${FRAME} button,${FRAME} [role="button"]{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
  .dsha-tray-panel{left:8px!important;right:8px!important;width:auto!important;max-width:none;border-radius:14px}
  .dsha-tray-items{gap:8px}
}
`

const settingsCss = `
.dsha-settings{display:flex;flex-direction:column;gap:14px;max-width:640px;color:var(--dsw-alias-label-primary,inherit)}
.dsha-settings h2{margin:0;font-size:16px;font-weight:600}
.dsha-settings-intro,.dsha-settings-status{margin:0;color:var(--dsw-alias-label-secondary,#5d6068);font-size:13px;line-height:1.6}
.dsha-setting{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.25));border-radius:var(--dsw-radius-md,12px);cursor:pointer}
.dsha-setting input[type=checkbox]{flex:none;width:16px;height:16px;margin:2px 0 0;accent-color:var(--dsw-alias-state-business-primary,#4d6bfe)}
.dsha-setting-title{display:block;font-size:14px;font-weight:500}
.dsha-setting-hint{display:block;margin-top:3px;color:var(--dsw-alias-label-caption,#72757c);font-size:12px;line-height:1.55}
.dsha-setting-number{cursor:default;justify-content:space-between;align-items:center}
.dsha-setting-number input{flex:none;box-sizing:border-box;width:96px;height:32px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l3,rgba(128,128,128,.35));border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-specific-input-major,transparent);color:inherit;font:inherit;font-size:14px}
.dsha-settings-reset{align-self:flex-start;height:30px;padding:0 14px;border:.5px solid var(--dsw-alias-border-l3,rgba(128,128,128,.35));border-radius:999px;background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer}
.dsha-settings-reset:disabled{opacity:.45;cursor:default}
`

/** The whole stylesheet for the current preferences. */
export function buildCss(prefs: Prefs): string {
  const query = mobileQuery(prefs)
  return [
    settingsCss,
    prefs.groupComposer ? trayCss : '',
    prefs.mobileDrawer ? drawerCss(query) : '',
    prefs.mobilePolish ? polishCss(query) : '',
  ].join('\n')
}
