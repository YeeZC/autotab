import { t, localizeDocument } from './i18n.js';
import { defaults, normalizeSettings, validateSettings } from './core.js';
import { mountIcons, animateIn, setStatus } from './ui.js';
localizeDocument();
mountIcons();
const fields = Object.keys(defaults);
const form = document.querySelector('#form');
const status = document.querySelector('#status');
const provider = document.querySelector('#provider');
const saved = normalizeSettings((await chrome.storage.local.get('settings')).settings);
for (const key of fields) {
  const element = document.getElementById(key);
  if (element.type === 'checkbox') element.checked = saved[key] ?? defaults[key];
  else element.value = saved[key] ?? defaults[key];
}
function visibility() {
  document.querySelector(`input[name="providerChoice"][value="${provider.value}"]`).checked = true;
}
function scheduleState() {
  const automatic = document.querySelector('#automatic').checked;
  document.querySelector('#intervalSeconds').disabled = !automatic;
  document.querySelector('.interval-row').dataset.disabled = String(!automatic);
}
for (const radio of document.querySelectorAll('[name="providerChoice"]')) radio.onchange = () => {
  provider.value = radio.value;
  document.querySelector('#apiKey').value = '';
  document.querySelector('#model').value = '';
  if (radio.value === 'anthropic') document.querySelector('#baseUrl').value = 'https://api.anthropic.com/v1';
  if (radio.value === 'openai') document.querySelector('#baseUrl').value = defaults.baseUrl;
  visibility();
  animateIn('.connection-fields .field');
};
document.querySelector('#automatic').onchange = scheduleState;
visibility(); scheduleState();
document.querySelector('#toggle-key').onclick = () => {
  const input = document.querySelector('#apiKey');
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  document.querySelector('#toggle-key').setAttribute('aria-label', visible ? t('hideKey') : t('showKey'));
  document.querySelector('#toggle-key').setAttribute('aria-pressed', String(visible));
};
form.addEventListener('input', () => setStatus(status, t('unsaved')));
for (const link of document.querySelectorAll('.settings-nav nav a')) link.onclick = () => {
  document.querySelectorAll('.settings-nav nav a').forEach(item => item.removeAttribute('aria-current'));
  link.setAttribute('aria-current', 'true');
};
document.querySelector('.settings-nav nav a').setAttribute('aria-current', 'true');
animateIn('.settings-nav, .settings-section, .save-bar');
form.onsubmit = async event => {
  event.preventDefault();
  const save = document.querySelector('#save');
  try {
    const settings = validateSettings(Object.fromEntries(fields.map(key => {
      const element = document.getElementById(key);
      return [key, element.type === 'checkbox' ? element.checked : element.value.trim()];
    })));
    {
      const granted = await chrome.permissions.request({ origins: [new URL(settings.baseUrl).origin + '/*'] });
      if (!granted) throw new Error(t('permissionDenied'));
    }
    save.disabled = true;
    await chrome.storage.local.set({ settings });
    setStatus(status, t('saved'), 'success');
  } catch (error) { setStatus(status, error.message, 'error'); }
  finally { save.disabled = false; }
};
