(function () {
  // Guard against double injection
  if (window.__psLoaded) return;
  window.__psLoaded = true;
  const isTop = window === window.top;

  // ---- State ----
  let active = false;
  let settings = { radius: 80, blur: 20, feather: 140, dim: 0 };
  let host = null, overlay = null;
  let px = -9999, py = -9999, raf = 0;

  // ---- Messaging ----
  // Fetch initial state from the background script
  try {
    chrome.runtime.sendMessage({ type: 'getState' }, (resp) => {
      if (chrome.runtime.lastError || !resp) return;
      apply(resp.active, resp.settings);
    });
  } catch (e) {}

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'apply') apply(msg.active, msg.settings);
  });

  function apply(a, s) {
    active = !!a;
    if (s) settings = s;
    if (isTop) {
      if (active) {
        ensureOverlay();
        updateVars();
      } else {
        removeOverlay();
      }
    }
    if (!active) { px = -9999; py = -9999; }
  }

  // ---- Top-frame overlay ----
  const OVERLAY_CSS = '#o{position:fixed;inset:0;pointer-events:none;--x:-9999px;--y:-9999px;--r:80px;--blur:20px;--feather:140px;--dim:0;-webkit-backdrop-filter:blur(var(--blur));backdrop-filter:blur(var(--blur));background:rgba(0,0,0,var(--dim));-webkit-mask-image:radial-gradient(circle at var(--x) var(--y),transparent var(--r),#000 calc(var(--r) + var(--feather)));mask-image:radial-gradient(circle at var(--x) var(--y),transparent var(--r),#000 calc(var(--r) + var(--feather)));}';

  function ensureOverlay() {
    if (!host) {
      host = document.createElement('ps-spotlight');
      host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block;';
      const root = host.attachShadow({ mode: 'closed' });
      root.innerHTML = '<style>' + OVERLAY_CSS + '</style><div id="o"></div>';
      overlay = root.querySelector('#o');
    }
    if (!host.isConnected) (document.documentElement || document).appendChild(host);
  }

  function removeOverlay() {
    if (host && host.isConnected) host.remove();
  }

  function updateVars() {
    if (!overlay) return;
    const st = overlay.style;
    st.setProperty('--r', settings.radius + 'px');
    st.setProperty('--blur', settings.blur + 'px');
    st.setProperty('--feather', settings.feather + 'px');
    st.setProperty('--dim', String(settings.dim));
    st.setProperty('--x', px + 'px');
    st.setProperty('--y', py + 'px');
  }

  // Keep the overlay host attached if the page replaces its DOM (top frame only)
  if (isTop) {
    const reattach = () => {
      if (active && host && !host.isConnected) (document.documentElement || document).appendChild(host);
    };
    new MutationObserver(reattach).observe(document, { childList: true });
    try {
      if (document.documentElement) {
        new MutationObserver(reattach).observe(document.documentElement, { childList: true });
      }
    } catch (e) {}
  }

  // ---- Cursor tracking (all frames; acts only when active) ----
  function setPos(x, y) {
    px = x; py = y;
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; updateVars(); });
  }

  window.addEventListener('mousemove', (e) => {
    if (!active) return;
    if (isTop) setPos(e.clientX, e.clientY);
    else window.parent.postMessage({ __ps: 1, x: e.clientX, y: e.clientY }, '*');
  }, { capture: true, passive: true });

  document.addEventListener('mouseleave', () => {
    if (!active) return;
    if (isTop) setPos(-9999, -9999);
    else window.parent.postMessage({ __ps: 1, leave: true }, '*');
  }, true);

  // Fallback for browsers/pages where document mouseleave is not delivered: mouseout with no relatedTarget = left the window
  window.addEventListener('mouseout', (e) => {
    if (!active || e.relatedTarget) return;
    if (isTop) setPos(-9999, -9999);
    else window.parent.postMessage({ __ps: 1, leave: true }, '*');
  }, true);

  // ---- Iframe relay: child frames report cursor, parent translates to its own coords ----
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.__ps !== 1) return;

    // Find the iframe element whose window sent this message
    let frameEl = null;
    for (const f of document.querySelectorAll('iframe,frame')) {
      if (f.contentWindow === e.source) { frameEl = f; break; }
    }
    if (!frameEl) return;

    if (d.leave) {
      if (isTop) { if (active) setPos(-9999, -9999); }
      else window.parent.postMessage({ __ps: 1, leave: true }, '*');
      return;
    }

    const r = frameEl.getBoundingClientRect();
    const x = d.x + r.left + frameEl.clientLeft;
    const y = d.y + r.top + frameEl.clientTop;
    if (isTop) { if (active) setPos(x, y); }
    else window.parent.postMessage({ __ps: 1, x, y }, '*');
  });
})();
