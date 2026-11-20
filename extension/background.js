import { t, language } from './i18n.js';
import { normalizeSettings, validateSettings, eligible, domainGroups, chunks, concurrentMap, makeTask, parseTask, mergeTasks, mergePlan, requestApi } from './core.js';
const alarmName = 'autotab-group';
let running = false;
// Service worker module evaluation must stay synchronous in Chrome.
const storageReady = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
storageReady.catch(error => console.error('AutoTab storage initialization failed:', error.message));

async function configureAlarm() {
  const { settings: saved } = await chrome.storage.local.get('settings');
  const settings = normalizeSettings(saved);
  if (saved && (saved.provider === 'codex' || Object.hasOwn(saved, 'interval'))) await chrome.storage.local.set({ settings });
  await chrome.alarms.clear(alarmName);
  if (settings?.automatic) await chrome.alarms.create(alarmName, { periodInMinutes: Math.min(1440, Math.max(0.5, Number(settings.intervalSeconds) / 60 || 0.5)) });
}
chrome.runtime.onInstalled.addListener(configureAlarm);
chrome.runtime.onStartup.addListener(configureAlarm);
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.settings) configureAlarm(); });

export async function groupTabs(windowId) {
  if (running) throw new Error(t('busy'));
  running = true;
  let groupCount = 0;
  let tabCount = 0;
  let eligibleCount = 0;
  let requestCount = 0;
  const started = Date.now();
  const progress = message => chrome.storage.local.set({ status: { running: true, locale: language(), started, updated: Date.now(), message } });
  try {
    await storageReady;
    await progress(t('localGrouping'));
    const windows = windowId === undefined ? await chrome.windows.getAll({ windowTypes: ['normal'] }) : [await chrome.windows.get(windowId)];
    const plans = [];
    // Finish local grouping first, so API errors never prevent the initial organization.
    for (const window of windows) {
      if (window.incognito || window.type !== 'normal') continue;
      const candidates = (await chrome.tabs.query({ windowId: window.id })).filter(eligible);
      eligibleCount += candidates.length;
      const groups = [];
      for (const group of domainGroups(candidates)) {
        const live = await chrome.tabs.query({ windowId: window.id });
        group.tabs = group.tabs.filter(original => live.some(tab => tab.id === original.id && eligible(tab) && tab.url === original.url));
        if (!group.tabs.length) continue;
        group.chromeId = await chrome.tabs.group({ tabIds: group.tabs.map(tab => tab.id), createProperties: { windowId: window.id } });
        await chrome.tabGroups.update(group.chromeId, { title: group.domain, color: group.color });
        groups.push(group);
        groupCount++;
        tabCount += group.tabs.length;
      }
      if (groups.length) plans.push({ windowId: window.id, groups });
    }
    if (plans.length) {
      const { settings: saved } = await chrome.storage.local.get('settings');
      const settings = validateSettings(normalizeSettings(saved));
      {
        const origin = new URL(settings.baseUrl).origin + '/*';
        if (!await chrome.permissions.contains({ origins: [origin] })) throw new Error(t('authorizeApi'));
      }
      async function request(task) {
        requestCount++;
        await progress(t('requestProgress', { stage: t(task.stage === 'name' ? 'naming' : 'analyzing'), count: requestCount }));
        return requestApi(settings, task);
      }
      async function liveIds(group, id) {
        const live = await chrome.tabs.query({ windowId: id });
        return group.tabs.filter(original => live.some(tab => tab.id === original.id && !tab.pinned && !tab.incognito && tab.groupId === group.chromeId && tab.url === original.url)).map(tab => tab.id);
      }
      // A single pool spans windows and keeps the global concurrency at three.
      const naming = plans.flatMap(plan => chunks(plan.groups, 4).map(groups => ({ plan, groups })));
      await concurrentMap(naming, 3, async ({ plan, groups }) => {
        const names = await request(makeTask('name', groups, settings.instructions));
        for (const name of names) {
          const group = groups.find(group => group.id === name.groupIds[0]);
          if (!(await liveIds(group, plan.windowId)).length) continue;
          await chrome.tabGroups.update(group.chromeId, { title: name.title, color: name.color });
          Object.assign(group, { title: name.title, summary: name.summary, color: name.color });
        }
      });
      const comparisons = plans.flatMap(plan => mergeTasks(plan.groups, settings.instructions).map(task => ({ plan, task })));
      const results = await concurrentMap(comparisons, 3, async ({ task }) => request(task));
      // Only validated relation results may move whole domain groups; never individual model-selected tabs.
      for (const plan of plans) {
        const suggestions = results.flatMap((result, index) => comparisons[index].plan === plan ? result : []);
        for (const component of mergePlan(plan.groups, suggestions)) {
          if (component.members.length < 2) continue;
          const members = [];
          for (const group of component.members) {
            const ids = await liveIds(group, plan.windowId);
            if (ids.length) members.push({ group, ids });
          }
          if (members.length < 2) continue;
          const target = members[0].group.chromeId;
          for (const member of members.slice(1)) {
            await chrome.tabs.group({ groupId: target, tabIds: member.ids });
            groupCount--;
          }
          await chrome.tabGroups.update(target, { title: component.title, color: component.color });
        }
      }
    }
    const message = requestCount === 0
      ? t('noRequests')
      : t('organizedResult', { tabs: tabCount, groups: groupCount, requests: requestCount });
    const status = { running: false, locale: language(), at: Date.now(), groupCount, tabCount, eligibleCount, requestCount, message };
    await chrome.storage.local.set({ status });
    return status;
  } catch (error) {
    const message = t('partialError', { error: error.message, tabs: tabCount, groups: groupCount });
    await chrome.storage.local.set({ status: { running: false, locale: language(), at: Date.now(), groupCount, tabCount, eligibleCount, requestCount, error: message } });
    throw new Error(message);
  } finally { running = false; }
}
export async function ungroupAllTabs() {
  if (running) throw new Error(t('busy'));
  running = true;
  let tabCount = 0;
  let groupCount = 0;
  const started = Date.now();
  try {
    await storageReady;
    await chrome.storage.local.set({ status: { running: true, locale: language(), started, message: t('ungroupingWindows') } });
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    for (const window of windows) {
      if (window.incognito || window.type !== 'normal') continue;
      const tabs = (await chrome.tabs.query({ windowId: window.id })).filter(tab => !tab.incognito && tab.groupId !== -1);
      const groups = new Map();
      for (const tab of tabs) {
        if (!groups.has(tab.groupId)) groups.set(tab.groupId, []);
        groups.get(tab.groupId).push(tab.id);
      }
      for (const ids of groups.values()) {
        await chrome.tabs.ungroup(ids);
        tabCount += ids.length;
        groupCount++;
      }
    }
    const message = groupCount ? t('ungroupedResult', { groups: groupCount, tabs: tabCount }) : t('noGroups');
    const result = { running: false, locale: language(), at: Date.now(), tabCount, groupCount, message };
    await chrome.storage.local.set({ status: result });
    return result;
  } catch (error) {
    const message = t('ungroupError', { error: error.message, groups: groupCount });
    await chrome.storage.local.set({ status: { running: false, locale: language(), at: Date.now(), tabCount, groupCount, error: message } });
    throw new Error(message);
  } finally { running = false; }
}
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === alarmName) groupTabs().catch(() => {});
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !['group', 'ungroupAll'].includes(message?.type)) return;
  const operation = message.type === 'ungroupAll' ? ungroupAllTabs() : groupTabs(message.windowId);
  operation.then(result => respond({ result }), error => respond({ error: error.message }));
  return true;
});
