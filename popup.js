// Popup logic. Globals from config.js: EXTPAY_ID, DEFAULTS, LIMITS. ExtPay from ExtPay.js.
const extpay = ExtPay(EXTPAY_ID);

const $ = id => document.getElementById(id);
const SLIDER_KEYS = ['radius', 'blur', 'feather', 'dim'];

// Value label formatting per slider.
const FORMAT = {
  radius: v => `${v}px`,
  blur: v => `${v}px`,
  feather: v => `${v}px`,
  dim: v => `${Math.round(v * 100)}%`
};

let state = null;      // last getPopupState result
let supported = false; // is the active tab an http(s) page
let tabId;             // active tab id
const timers = {};     // per-key debounce timers

// Ask the background for current state and update the UI (never touches slider values).
async function refreshState() {
  state = await chrome.runtime.sendMessage({ type: 'getPopupState', tabId });

  $('pill').textContent = state.pro ? 'Pro' : 'Free';
  $('pill').classList.toggle('pro', !!state.pro);

  $('mainSwitch').checked = !!state.active;
  $('mainLabel').textContent = state.allTabsMode ? 'Blur all tabs' : 'Blur this tab';

  // Unsupported pages (chrome://, web store, etc.) cannot be blurred.
  $('mainSwitch').disabled = !supported;
  $('unsupported').hidden = supported;

  // Pro-only rows show a lock when the user is on Free.
  document.querySelectorAll('.row[data-pro]').forEach(row => {
    row.classList.toggle('locked', !state.pro);
  });

  $('allTabs').checked = !!state.settings.allTabs;

  $('upgradeLink').textContent = state.pro ? 'Manage subscription' : 'Upgrade to Pro';
  $('hint').textContent = state.pro ? 'Shortcut: Alt+Shift+B' : 'Shortcut (Pro): Alt+Shift+B';
}

// Merge one value into the saved settings and write them to sync storage.
async function saveSetting(key, value) {
  const { settings: saved } = await chrome.storage.sync.get('settings');
  await chrome.storage.sync.set({
    settings: { ...DEFAULTS, ...(saved || {}), [key]: value }
  });
}

// Write a slider value 150ms after the last input event.
function scheduleSave(key, value) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => saveSetting(key, value), 150);
}

async function init() {
  // 1. Apply slider limits from config.js.
  SLIDER_KEYS.forEach(key => {
    const el = $(key);
    el.min = LIMITS[key].min;
    el.max = LIMITS[key].max;
    el.step = LIMITS[key].step;
  });

  // 2. Find the active tab.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  supported = /^https?:/i.test((tab && tab.url) || '');
  tabId = tab && tab.id;

  // 3. Load state.
  await refreshState();

  // 4. Slider values: first load only.
  SLIDER_KEYS.forEach(key => {
    const el = $(key);
    el.value = state.settings[key];
    $(key + '-val').textContent = FORMAT[key](Number(el.value));
  });

  // 5. Refresh license in background; ignore failures.
  chrome.runtime.sendMessage({ type: 'refreshLicense' })
    .then(() => refreshState())
    .catch(() => {});
}

// Main switch: toggle blurring on the active tab.
$('mainSwitch').addEventListener('change', async () => {
  await chrome.runtime.sendMessage({ type: 'toggle', tabId });
  await refreshState();
});

// Sliders: update label immediately, save (Pro only) after debounce.
SLIDER_KEYS.forEach(key => {
  $(key).addEventListener('input', () => {
    const value = Number($(key).value);
    $(key + '-val').textContent = FORMAT[key](value);
    if (state && state.pro) scheduleSave(key, value);
  });
});

// All tabs toggle: Pro only. Free users get the checkbox reverted.
$('allTabs').addEventListener('change', async () => {
  if (!state || !state.pro) {
    $('allTabs').checked = false;
    return;
  }
  await saveSetting('allTabs', $('allTabs').checked);
  await refreshState();
});

// Locked rows open the payment page instead of changing the control.
// Capture phase so this runs before inner controls get the click.
document.querySelectorAll('.row[data-pro]').forEach(row => {
  row.addEventListener('click', e => {
    if (row.classList.contains('locked')) {
      e.preventDefault();
      e.stopPropagation();
      extpay.openPaymentPage();
    }
  }, true);
});

$('upgradeLink').addEventListener('click', e => {
  e.preventDefault();
  extpay.openPaymentPage();
});

$('restoreLink').addEventListener('click', e => {
  e.preventDefault();
  extpay.openLoginPage();
});

// Re-render when settings or license state change in storage.
try {
  chrome.storage.onChanged.addListener(() => {
    refreshState().catch(() => {});
  });
} catch (err) {
  // Listener registration must never break the popup.
}

document.addEventListener('DOMContentLoaded', init);
