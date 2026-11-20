import { t, language, localizeDocument } from './i18n.js';
import { normalizeSettings, eligible, domainGroups } from './core.js';
import { icon, mountIcons, animateIn, setStatus } from './ui.js';
localizeDocument();
mountIcons();
const button = document.querySelector('#group');
const ungroupButton = document.querySelector('#ungroup');
const status = document.querySelector('#status');
const currentWindow = await chrome.windows.getCurrent();
let busy = false;
let available = 0;
function setBusy(value) {
  busy = value;
  button.disabled = busy || available === 0;
  ungroupButton.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}
async function refreshTabs() {
  const tabs = await chrome.tabs.query({ windowId: currentWindow.id });
  const candidates = tabs.filter(eligible);
  available = candidates.length;
  document.querySelector('#count').textContent = available;
  document.querySelector('#group-count').textContent = new Set(tabs.filter(tab => tab.groupId !== -1).map(tab => tab.groupId)).size;
  document.querySelector('#pinned-count').textContent = tabs.filter(tab => tab.pinned).length;
  const groups = domainGroups(candidates).sort((a, b) => b.tabs.length - a.tabs.length);
  document.querySelector('#domain-count').textContent = groups.length ? t('domainsCount', { count: groups.length }) : '';
  const list = document.querySelector('#domains');
  list.replaceChildren();
  if (!groups.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = icon('check');
    empty.append(t('empty'));
    list.append(empty);
  }
  for (const group of groups) {
    const row = document.createElement('div');
    row.className = 'domain-row';
    const glyph = document.createElement('span');
    glyph.className = 'domain-icon'; glyph.innerHTML = icon('tabs');
    const name = document.createElement('span');
    name.className = 'domain-name'; name.textContent = group.domain; name.title = group.domain;
    const count = document.createElement('span');
    count.className = 'domain-tabs';
    const ticks = document.createElement('span'); ticks.className = 'tab-ticks'; ticks.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < Math.min(group.tabs.length, 5); i++) ticks.append(document.createElement('i'));
    count.append(ticks, String(group.tabs.length));
    count.setAttribute('aria-label', t('tabsCount', { count: group.tabs.length }));
    row.append(glyph, name, count); list.append(row);
  }
  setBusy(busy);
}
function renderSettings(saved) {
  const settings = normalizeSettings(saved);
  const configured = Boolean(settings.model && settings.apiKey);
  document.querySelector('#provider-name').textContent = configured ? t(settings.provider === 'anthropic' ? 'anthropicCompatible' : 'openaiCompatible') : t('unconfigured');
  document.querySelector('#provider-link').dataset.configured = String(configured);
  document.querySelector('#schedule-label').textContent = settings.automatic ? t('everySeconds', { count: settings.intervalSeconds }) : t('manual');
}
for (const id of ['settings', 'provider-link', 'schedule-link']) document.getElementById(id).onclick = () => chrome.runtime.openOptionsPage();
function render(value) {
  if (!value || value.locale !== language()) return;
  const active = value.running && Date.now() - (value.updated || value.started) < 240000;
  setBusy(active);
  setStatus(status, value.error || value.message || '', active ? 'busy' : value.error ? 'error' : 'success');
}
const stored = await chrome.storage.local.get(['status', 'settings']);
await refreshTabs();
renderSettings(stored.settings);
render(stored.status);
animateIn('.view-title, .tab-stats, .domain-section, .popup-actions');
chrome.storage.onChanged.addListener(changes => {
  if (changes.status) { render(changes.status.newValue); if (!changes.status.newValue?.running) refreshTabs(); }
  if (changes.settings) renderSettings(changes.settings.newValue);
});
async function perform(type) {
  setBusy(true);
  setStatus(status, type === 'ungroupAll' ? t('ungrouping') : t('organizing'), 'busy');
  try {
    const response = await chrome.runtime.sendMessage({ type, windowId: currentWindow.id });
    if (!response) throw new Error(t('backgroundUnavailable'));
    if (response.error) throw new Error(response.error);
    render(response.result);
    await refreshTabs();
  } catch (error) {
    setStatus(status, /Receiving end does not exist|Could not establish connection/.test(error.message) ? t('backgroundUnavailable') : error.message, 'error');
  } finally { setBusy(false); }
}
button.onclick = () => perform('group');
ungroupButton.onclick = () => perform('ungroupAll');
