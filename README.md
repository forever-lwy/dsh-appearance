# DSH Appearance（外观优化）

适用于 **DeepSeek Harness**（当前在 `0.2.2-rc.3` 上构建测试，不按 dsh 版本拦截加载） 的纯前端外观插件。Host 端为空插件，仅用于加载浏览器模块；不需要运行时依赖，不读写服务器数据。

## 功能

### 1. 合并输入框中的插件按钮

其他插件放进输入框工具栏（官方插槽 `conversation.input.left` / `conversation.input.right`）的按钮，例如 dsh-google-native、dsh-claude-native 的“原生能力”、dsh-image-gen 的“生图”，统一收进一个 **插件工具** 按钮。按钮上显示当前可用的插件数量，点击后在按钮上方弹出面板。

- 面板中的按钮是原插件的组件本身，由官方渲染器按原插件的 `inject`、`locale`、`store` 生成属性，行为与原来一致。原插件自己弹出的菜单（挂到 `<body>` 上）点击时不会关闭面板。
- 实现方式是 rc.5 列表插槽的“同 id 遮蔽”：在原条目的 id 上注册一个更低优先级、不渲染内容的遮蔽项，再把原组件注册进本插件声明的子插槽 `dsh-appearance.tray`。不修改原插件或官方代码，关闭此功能、卸载本插件或原插件卸载时，按钮自动回到原位置。
- 声明了子插槽的条目无法重复声明，这类条目保留在原位置。
- 某个插件当前没有显示内容（例如当前模型不适用）时不计数；没有可用按钮时“插件工具”按钮自动隐藏。

### 2. 移动端抽屉式侧边栏

视口宽度不超过断点（默认 768px）时：

> DSH 0.2.2 起，宽度低于 768px 时官方自带抽屉式侧边栏（框架带 `data-sidebar-drawer`，左上角有官方打开按钮和遮罩）。此时本插件不再显示自己的菜单按钮和遮罩、不覆盖侧边栏样式，也不重复处理 Esc 与面板切换，只补充官方没有的“切换会话 / 点新会话后自动关闭”和“向左滑动关闭”。下面描述的完整抽屉只在官方抽屉未启用时生效（例如把断点调到 768px 以上后的 768px–断点区间）。

- 左侧栏（品牌、新会话、插件等面板入口、会话记录、设置）**完全收起**，不再保留 56px 图标栏，对话区域占满宽度。
- 对话页标题栏左上角出现菜单按钮（官方插槽 `conversation.header.leading`）；插件页等全局面板左上角出现悬浮菜单按钮。
- 打开后侧边栏以抽屉形式覆盖在内容上方，带遮罩。点击遮罩、按 Esc、向左滑动、选择会话、点“新会话”或打开插件等面板后自动关闭。
- 打开和关闭仍通过官方 `ctx.layout.toggleSidebar()` 切换布局自身的窄屏展开状态，不另存状态。

超过断点但窄于 1024px（平板）时保持官方行为：自动收起为图标栏。

### 3. 移动端外观适配

窄屏时：收紧标题栏和输入框边距；适配全面屏底部安全区；输入框使用 16px 字号，避免 iOS Safari 聚焦时自动放大页面；按钮取消点击高亮与双击缩放延迟；“插件工具”面板改为左右撑满的底部面板。

DSH rc.2 起已修复文件侧栏的全局 `:has()` 性能问题，0.1.5 删除运行时样式表改写和对应监听。输入框按钮收纳、移动端手势和外观设置继续保留。

## 设置

在 **设置 → 外观优化** 中可分别开关前三项，并调整移动端宽度上限（480–1023px）。设置保存在当前浏览器的 localStorage 中（键 `dsh-appearance:prefs:v1`），手机和电脑可分别设置，修改后立即生效；隐私模式或禁用站点存储时仅在本次页面内生效。

## 安装

在 DSH「插件 → 添加插件」输入下面的来源，确认安装并启用：

```text
github:forever-lwy/dsh-appearance
```

仓库默认分支是 `release`，其中每个提交都是某次发版的源码加上构建好的 `lib/`，并去掉了 `prepare`，所以安装时不装 devDependencies、不构建。dshmarket 按默认分支上 `package.json` 的版本号判断是否有更新，点击更新时安装 `release` 的最新提交。不要安装 `master`：它只有源码，安装时会靠 `prepare` 拉全部 devDependencies 现场构建。

包名自 0.1.2 起为 `@forever-lwy/dsh-appearance`，以免与 npm 和插件市场目录里的同名插件混淆。从旧的 `dsh-appearance` 版本包迁移时，先卸载旧的 `dsh-appearance`，再安装上面的来源；两者注册同一宿主行，不能同时安装。宿主行 id 和设置命名空间不变。

是否需要重启以安装界面提示为准。不要用 `link:`、目录依赖或模块路径把源码目录接入常用 profile。

## 兼容性说明

- 依赖 rc.5 外壳的结构：`[data-shell-overlay]` 所在的 AppFrame、`data-sidebar-collapsed` 属性，以及 CSS Module 类名的局部部分（`_sidebarCol`、`_centerCol`、`_newSession`、`_brand`）。样式只匹配类名中稳定的局部名，不依赖构建哈希前缀。DSH 升级后先运行 `npm test`：其中的检查会读取已安装的官方包，确认这些结构仍然存在。
- 使用 CSS `:has()`，需要 Safari 15.4+、Chrome 105+、Firefox 121+。
- 只针对普通 Web 页面设计；macOS / Windows 桌面客户端的窗口栏布局未作适配。

## 开发

```sh
npm install
npm run build   # tsc + esbuild，生成 lib/index.js 与浏览器模块 lib/client.js
npm run check
npm test        # 单元测试 + 在 jsdom 中用官方 rc.5 渲染器加载 lib/client.js 的集成测试
```

`test/integration.test.mjs` 在真实 Cordis Context 中运行官方 `@deepseek-ai/dsh-client-ui-renderer`，模拟输入框、标题栏、遮罩层和设置页插槽，验证按钮合并、原插件属性、会话切换、抽屉关闭和卸载还原。实际页面中的视觉效果需安装后在浏览器中确认。

发版：在 `master` 上开发和推送不会触发任何构建。改完后递增 `package.json` 版本并提交，打同名标签并推送，例如 `git tag v0.1.2 && git push origin master v0.1.2`。GitHub Actions（`.github/workflows/release.yml`）只在 `v*` 标签推送时运行：检查标签与版本一致，按 lockfile `npm ci`，由 `scripts/release.mjs` 构建、测试，在 `release` 分支上追加一个发布提交（源码加 `lib/`，去掉 `prepare`；父提交是上一个发布提交和该标签的源码提交）并推送。`release` 已有同一或更高版本时会拒绝发版。`npm run release` 可在本地对已打标签的提交生成同样的发布提交（不推送）。
