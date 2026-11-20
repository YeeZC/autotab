import test from 'node:test';
import assert from 'node:assert/strict';
let current = []; let mutations = []; let updates = []; let state = {}; let failFetch = false; let changeDuringRequest = false; let requests = []; let nextGroup = 10; let failMerge = false; let active = 0; let peak = 0; let ungroupError = false;
const testWindows = [{ id: 1, type: 'normal' }, { id: 2, type: 'normal' }, { id: 3, type: 'normal', incognito: true }];
const event = { addListener() {} };
globalThis.chrome = {
  storage: { local: {
    async setAccessLevel() {},
    async get() { return { settings: { provider: 'openai', baseUrl: 'https://example.com/v1', apiKey: 'secret', model: 'test' } }; },
    async set(value) { Object.assign(state, value); },
  }, onChanged: event },
  runtime: { onInstalled: event, onStartup: event, onMessage: event },
  alarms: { onAlarm: event }, permissions: { async contains() { return true; } },
  windows: { async get(id) { return { id, type: 'normal' }; }, async getAll() { return testWindows; } },
  tabs: {
    async query(filter) { return current.filter(t => t.windowId === undefined || t.windowId === filter.windowId).map(t => ({ ...t })); },
    async ungroup(ids) {
      if (ungroupError) throw new Error('Chrome ungroup failed');
      mutations.push({ ungroup: ids });
      for (const tab of current) if (ids.includes(tab.id)) tab.groupId = -1;
    },
    async group(options) {
      mutations.push(options);
      const id = options.groupId ?? nextGroup++;
      for (const tab of current) if (options.tabIds.includes(tab.id)) tab.groupId = id;
      return id;
    },
  },
  tabGroups: { async update(id, options) { updates.push({ id, ...options }); } },
};
function reset() {
  current = [
    { id: 1, url: 'https://docs.example.com/a', title: '开发资料', groupId: -1 },
    { id: 2, url: 'https://example.com/b', title: '开发指南', groupId: -1 },
    { id: 3, url: 'https://github.com/project', title: '项目代码', groupId: -1 },
  ];
  mutations = []; updates = []; requests = []; state = {}; failFetch = false; changeDuringRequest = false; failMerge = false; active = 0; peak = 0; ungroupError = false;
}
globalThis.fetch = async (url, options) => {
  // Local domain groups must already be visible before any request.
  assert.ok(current.every(tab => tab.groupId !== -1));
  const content = JSON.parse(options.body).messages[0].content;
  const input = JSON.parse(content.split('Group data: ')[1]);
  requests.push(input);
  if (failFetch) throw new Error('Network unavailable');
  const naming = input[0].samples !== undefined;
  if (!naming && failMerge) throw new Error('Merge timeout');
  active++; peak = Math.max(peak, active);
  await new Promise(resolve => setTimeout(resolve, 3));
  active--;
  if (changeDuringRequest) current[2].groupId = 999;
  const groups = naming ? input.map(group => ({ title: '开发', summary: '开发资料与代码', color: 'blue', groupIds: [group.id] }))
    : [{ title: '项目开发', summary: '开发资料与代码', color: 'blue', groupIds: input.map(g => g.id) }];
  return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ groups }) } }] }) };
};
const { groupTabs, ungroupAllTabs } = await import('../extension/background.js');
test('local root-domain grouping precedes naming and related groups merge whole', async () => {
  reset();
  const result = await groupTabs(1);
  assert.deepEqual(mutations[0].tabIds, [1, 2]);
  assert.deepEqual(mutations[1].tabIds, [3]);
  assert.equal(updates[0].title, 'example.com');
  assert.equal(result.requestCount, 2);
  assert.equal(result.groupCount, 1);
  assert.equal(result.tabCount, 3);
  assert.deepEqual(mutations[2].tabIds, [3]);
  assert.equal(current[0].groupId, current[2].groupId);
  assert.ok(!JSON.stringify(requests).includes('/project'));
});
test('API failure retains immediate domain groups and reports partial completion', async () => {
  reset(); failFetch = true;
  await assert.rejects(groupTabs(1), /Network unavailable/);
  assert.equal(mutations.length, 2);
  assert.equal(state.status.running, false);
  assert.equal(state.status.groupCount, 2);
  assert.match(state.status.error, /local grouping and naming are preserved/);
});
test('do not move a tab reassigned by the user during model inference', async () => {
  reset(); changeDuringRequest = true;
  await groupTabs(1);
  assert.equal(mutations.length, 2);
  assert.equal(current[2].groupId, 999);
});
test('no eligible tabs means no model calls', async () => {
  reset(); current = current.map(tab => ({ ...tab, pinned: true }));
  assert.equal((await groupTabs(1)).requestCount, 0);
  assert.equal(mutations.length, 0);
  assert.match(state.status.message, /No request sent/);
});

test('multi-batch pipeline issues at most three concurrent requests with bounded payloads', async () => {
  reset();
  current = Array.from({ length: 21 }, (_, i) => ({ id: i, url: `https://site${i}.com/path`, title: '项目资料', groupId: -1 }));
  const result = await groupTabs(1);
  assert.equal(peak, 3);
  assert.equal(result.groupCount, 1);
  assert.equal(result.tabCount, 21);
  for (const input of requests) assert.ok(input.length <= (input[0].samples ? 4 : 12));
});
test('relation failure preserves successful names and domain boundaries', async () => {
  reset(); failMerge = true;
  await assert.rejects(groupTabs(1), /Merge timeout/);
  assert.equal(mutations.length, 2);
  assert.equal(updates.filter(update => update.title === '开发').length, 2);
  assert.notEqual(current[0].groupId, current[2].groupId);
});

test('ungroup all regular windows including manually grouped tabs without model calls', async () => {
  reset();
  current = [
    { id: 1, windowId: 1, groupId: 7 }, { id: 2, windowId: 1, groupId: 7 },
    { id: 3, windowId: 2, groupId: 8, url: 'chrome://settings/' },
    { id: 4, windowId: 2, groupId: -1 },
    { id: 5, windowId: 3, groupId: 9, incognito: true },
  ];
  const result = await ungroupAllTabs();
  assert.equal(result.groupCount, 2);
  assert.equal(result.tabCount, 3);
  assert.deepEqual(current.map(tab => tab.groupId), [-1, -1, -1, -1, 9]);
  assert.equal(current.length, 5);
  assert.equal(requests.length, 0);
  assert.equal(state.status.running, false);
  assert.equal((await ungroupAllTabs()).groupCount, 0);
});
test('grouping and ungrouping share a lock, released after failures', async () => {
  reset();
  const pending = groupTabs(1);
  await assert.rejects(ungroupAllTabs(), /operation is in progress/);
  await pending;
  ungroupError = true;
  await assert.rejects(ungroupAllTabs(), /Chrome ungroup failed/);
  assert.equal(state.status.running, false);
  ungroupError = false;
  assert.equal((await ungroupAllTabs()).groupCount, 1);
});
