import { mobileQuery, SIDEBAR_COL } from './styles.js';
const SETTLE_MS = 350;
const SWIPE_PX = 56;
export function frameOf(doc) {
    return doc.querySelector('[data-shell-overlay]')?.parentElement ?? null;
}
export function createDrawerController({ doc, win, prefs, toggleSidebar, panelInfo }) {
    let settling = false;
    let settleTimer;
    let lastSession;
    const isMobile = () => {
        const current = prefs.getSnapshot();
        if (!current.mobileDrawer)
            return false;
        try {
            return win.matchMedia(mobileQuery(current)).matches;
        }
        catch {
            return win.innerWidth <= current.breakpoint;
        }
    };
    const isOpen = () => {
        const frame = frameOf(doc);
        return frame !== null && !frame.hasAttribute('data-sidebar-collapsed');
    };
    const toggle = () => {
        settling = true;
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => { settling = false; }, SETTLE_MS);
        toggleSidebar();
    };
    const close = () => {
        // Several navigation signals can arrive for one tap; toggling twice
        // before the frame re-renders would reopen the drawer.
        if (settling || !isMobile() || !isOpen())
            return;
        toggle();
    };
    const onSession = (sessionId) => {
        const changed = lastSession !== undefined && lastSession !== sessionId;
        lastSession = sessionId;
        if (changed)
            close();
    };
    const disposers = [];
    if (panelInfo) {
        let panel = panelInfo.getSnapshot().activePanelId;
        disposers.push(panelInfo.subscribe(() => {
            const next = panelInfo.getSnapshot().activePanelId;
            if (next === panel)
                return;
            panel = next;
            close();
        }));
    }
    const onClick = (event) => {
        const target = event.target;
        if (!target?.closest || !isMobile())
            return;
        // "New session" (and the brand that also starts one) may leave no Session
        // selected, so no Session report would follow; close explicitly.
        if (target.closest(`${SIDEBAR_COL} [class*="_newSession"], ${SIDEBAR_COL} [class*="_brand"]`))
            win.setTimeout(close, 0);
    };
    const onKeyDown = (event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || !isMobile() || !isOpen())
            return;
        if (doc.querySelector('[role="menu"], [role="dialog"]:not([data-dsh-appearance-tray])'))
            return;
        close();
    };
    let touch;
    const onTouchStart = (event) => {
        const target = event.target;
        touch = undefined;
        if (event.touches.length !== 1 || !isMobile() || !isOpen() || !target?.closest)
            return;
        if (!target.closest(`${SIDEBAR_COL}, [data-dsh-appearance-backdrop]`))
            return;
        touch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };
    const onTouchEnd = (event) => {
        const start = touch;
        touch = undefined;
        const end = event.changedTouches[0];
        if (!start || !end)
            return;
        const dx = end.clientX - start.x, dy = end.clientY - start.y;
        if (dx < -SWIPE_PX && Math.abs(dy) < Math.abs(dx) * 0.6)
            close();
    };
    doc.addEventListener('click', onClick);
    doc.addEventListener('keydown', onKeyDown);
    doc.addEventListener('touchstart', onTouchStart, { passive: true });
    doc.addEventListener('touchend', onTouchEnd, { passive: true });
    disposers.push(() => {
        doc.removeEventListener('click', onClick);
        doc.removeEventListener('keydown', onKeyDown);
        doc.removeEventListener('touchstart', onTouchStart);
        doc.removeEventListener('touchend', onTouchEnd);
        clearTimeout(settleTimer);
    });
    return {
        toggle, close, isOpen, isMobile, onSession,
        dispose: () => { for (const dispose of disposers.splice(0).reverse())
            dispose(); },
    };
}
