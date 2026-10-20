// Shared by background.js (importScripts) and popup.html (<script>). Plain globals, no modules.
// PLACEHOLDER: register this ID at extensionpay.com and change it here only.
const EXTPAY_ID = 'privacy-spotlight';
const DEFAULTS = { radius: 80, blur: 20, feather: 140, dim: 0, allTabs: false };
const LIMITS = {
  radius: { min: 40, max: 400, step: 5 },
  blur: { min: 2, max: 40, step: 1 },
  feather: { min: 0, max: 300, step: 5 },
  dim: { min: 0, max: 0.8, step: 0.05 }
};
