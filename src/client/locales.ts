export const NAMESPACE = 'dshAppearance'

export const zh: Record<string, string> = {
  nav: '外观优化',
  trayLabel: '插件工具',
  trayTitle: '插件工具',
  trayEmpty: '当前没有可用的插件按钮',
  openSidebar: '打开侧边栏',
  closeSidebar: '关闭侧边栏',
  settingsTitle: '外观优化',
  settingsIntro: '这些设置只保存在当前浏览器，手机和电脑可以分别设置。修改后立即生效。',
  groupComposer: '合并输入框中的插件按钮',
  groupComposerHint: '其他插件放在输入框工具栏里的按钮，统一收进一个“插件工具”按钮，点击后展开。',
  mobileDrawer: '移动端抽屉式侧边栏',
  mobileDrawerHint: '窄屏时完全隐藏左侧栏（插件、新会话、会话记录），改由左上角按钮打开；选择会话、点空白处或左滑即可关闭。宽度低于 768px 时沿用 DSH 自带的抽屉和按钮，本插件只补充切换会话后自动关闭和左滑关闭。',
  mobilePolish: '移动端外观适配',
  mobilePolishHint: '窄屏时收紧边距、适配全面屏底部安全区，输入框使用 16px 字号以免 iOS 聚焦时自动放大。',
  breakpoint: '移动端宽度上限',
  breakpointHint: '视口宽度不超过该值（像素）时按移动端处理。',
  reset: '恢复默认',
  current: '当前视口宽度：{width}px（{mode}）',
  modeMobile: '移动端',
  modeDesktop: '桌面端',
}

export const en: Record<string, string> = {
  nav: 'Appearance',
  trayLabel: 'Plugin tools',
  trayTitle: 'Plugin tools',
  trayEmpty: 'No plugin buttons available here',
  openSidebar: 'Open sidebar',
  closeSidebar: 'Close sidebar',
  settingsTitle: 'Appearance',
  settingsIntro: 'These settings are stored in this browser only, so a phone and a desktop can differ. Changes apply immediately.',
  groupComposer: 'Group plugin buttons in the composer',
  groupComposerHint: 'Buttons other plugins add to the composer toolbar are gathered behind one "Plugin tools" button.',
  mobileDrawer: 'Drawer sidebar on mobile',
  mobileDrawerHint: 'On narrow screens the left sidebar is hidden completely and opened from a top-left button; picking a session, tapping outside or swiping left closes it. Below 768px DSH\'s own drawer and button are used, and this plugin only adds closing on session switch and swipe.',
  mobilePolish: 'Mobile layout polish',
  mobilePolishHint: 'Tighter spacing, safe-area padding and a 16px input font so iOS does not zoom on focus.',
  breakpoint: 'Mobile width limit',
  breakpointHint: 'Viewports at or below this width (px) use the mobile layout.',
  reset: 'Reset to defaults',
  current: 'Current viewport: {width}px ({mode})',
  modeMobile: 'mobile',
  modeDesktop: 'desktop',
}

export type Translate = (key: string, params?: Record<string, unknown>) => string

/** Fallback translator used when the locale service is unavailable (tests). */
export function fallbackT(key: string, params?: Record<string, unknown>): string {
  const text = zh[key] ?? key
  return params ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? '')) : text
}
