// MV3 classic service worker (not a module).
importScripts('config.js', 'ExtPay.js');
const extpay = ExtPay(EXTPAY_ID);
extpay.startBackground();

// ---------- Storage helpers (no in-memory state; always re-read storage) ----------

async function getPro() {
  const r = await chrome.storage.local.get({ pro: false });
  return !!r.pro;
}

// Saved settings may be partial or missing; always returns an object.
async function getSaved() {
  const r = await chrome.storage.sync.get({ settings: {} });
  return r.settings || {};
}

async function getGlobal() {
  const r = await chrome.storage.local.get({ globalEnabled: false });
  return !!r.globalEnabled;
}

async function getTabsOn() {
  const r = await chrome.storage.session.get({ tabsOn: {} });
  return r.tabsOn || {};
}

async function setTabsOn(obj) {
  await chrome.storage.session.set({ tabsOn: obj });
}

// ---------- Pure helpers ----------

// Effective settings: pro users get saved overrides; free users get DEFAULTS only.
function effective(pro, saved) {
  const base = pro ? { ...DEFAULTS, ...saved } : { ...DEFAULTS };
  base.allTabs = !!(pro && saved && saved.allTabs);
  return base;
}

// Active state: in "all tabs" pro mode the global flag decides, otherwise per-tab flag.
function isActive(tabId, pro, eff, globalEnabled, tabsOn) {
  return (pro && eff.allTabs) ? !!globalEnabled : !!tabsOn[tabId];
}

function isHttp(url) {
  return /^https?:/i.test(url || '');
}

// ---------- Composite helpers ----------

async function computeState(tabId) {
  const pro = await getPro();
  const saved = await getSaved();
  const globalEnabled = await getGlobal();
  const tabsOn = await getTabsOn();
  const eff = effective(pro, saved);
  return {
    pro,
    settings: eff,
    active: isActive(tabId, pro, eff, globalEnabled, tabsOn)
  };
}

// Pushes badge + 'apply' message to every http(s) tab. Storage is read once.
async function broadcast() {
  const pro = await getPro();
  const saved = await getSaved();
  const globalEnabled = await getGlobal();
  const tabsOn = await getTabsOn();
  const eff = effective(pro, saved);
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id === undefined || !isHttp(tab.url)) continue;
    const active = isActive(tab.id, pro, eff, globalEnabled, tabsOn);
    chrome.action.setBadgeText({ tabId: tab.id, text: active ? 'ON' : '' }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#2563eb' }).catch(() => {});
    // Reaches all frames of the tab; tabs without a content script throw, which is swallowed.
    chrome.tabs.sendMessage(tab.id, { type: 'apply', active, settings: eff }).catch(() => {});
  }
}

async function doToggle(tabId) {
  const pro = await getPro();
  const saved = await getSaved();
  if (pro && saved.allTabs) {
    // All-tabs pro mode: flip the global flag.
    const g = await getGlobal();
    await chrome.storage.local.set({ globalEnabled: !g });
  } else {
    // Per-tab mode: flip this tab's flag.
    const tabsOn = await getTabsOn();
    if (tabsOn[tabId]) {
      delete tabsOn[tabId];
    } else {
      tabsOn[tabId] = true;
    }
    await setTabsOn(tabsOn);
  }
  await broadcast();
}

async function refreshLicense() {
  try {
    const user = await extpay.getUser();
    await chrome.storage.local.set({ pro: !!user.paid });
  } catch (e) {
    /* offline: keep cached value */
  }
  await broadcast();
  return (await getPro());
}

// chrome.alarms.create is idempotent for the same name.
function ensureAlarm() {
  chrome.alarms.create('license-refresh', { periodInMinutes: 720 });
}

// ---------- Listeners (all registered synchronously at top level) ----------

// 1. Messages from popup / content scripts.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg && msg.type) {
    case 'getState': {
      (async () => {
        if (sender.tab) {
          const s = await computeState(sender.tab.id);
          sendResponse({ active: s.active, settings: s.settings });
        } else {
          sendResponse({ active: false, settings: DEFAULTS });
        }
      })().catch((e) => console.error(e));
      return true;
    }
    case 'toggle': {
      (async () => {
        await doToggle(msg.tabId);
        sendResponse({ ok: true });
      })().catch((e) => console.error(e));
      return true;
    }
    case 'getPopupState': {
      (async () => {
        const s = await computeState(msg.tabId);
        sendResponse({
          active: s.active,
          pro: s.pro,
          settings: s.settings,
          allTabsMode: s.pro && s.settings.allTabs
        });
      })().catch((e) => console.error(e));
      return true;
    }
    case 'refreshLicense': {
      (async () => {
        const pro = await refreshLicense();
        sendResponse({ pro });
      })().catch((e) => console.error(e));
      return true;
    }
    default:
      // Unknown types (e.g. ExtPay's own messages) are left alone.
      return undefined;
  }
});

// 2. Settings / license / global flag changes -> re-broadcast.
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'sync' && changes.settings) ||
      (area === 'local' && (changes.pro || changes.globalEnabled))) {
    broadcast();
  }
});

// 3. Payment completed -> mark pro (storage change triggers broadcast).
extpay.onPaid.addListener(() => {
  chrome.storage.local.set({ pro: true });
});

// 4. Tab closed -> drop its per-tab flag.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const tabsOn = await getTabsOn();
  delete tabsOn[tabId];
  await setTabsOn(tabsOn);
});

// 5. Page finished loading -> refresh badge for that tab only.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !isHttp(tab.url)) return;
  const s = await computeState(tabId);
  chrome.action.setBadgeText({ tabId, text: s.active ? 'ON' : '' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' }).catch(() => {});
});

// 6. Periodic license refresh.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'license-refresh') {
    refreshLicense();
  }
});

// 7. Browser start.
chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  refreshLicense();
});

// 8. Install / update: schedule alarm, refresh license, inject content script into open tabs.
chrome.runtime.onInstalled.addListener(async () => {
  ensureAlarm();
  refreshLicense();
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id !== undefined && isHttp(tab.url)) {
      chrome.scripting
        .executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content.js'] })
        .catch(() => {});
    }
  }
});

// 9. Keyboard shortcut: toggle blur on the active tab (or open payment if not pro).
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-blur') return;
  const pro = await getPro();
  if (!pro) {
    extpay.openPaymentPage();
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab && isHttp(tab.url)) {
    await doToggle(tab.id);
  }
});

// Ensure the license refresh alarm exists on every worker start.
ensureAlarm();
