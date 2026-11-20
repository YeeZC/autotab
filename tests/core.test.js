import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, endpoint, validateSettings, eligible, rootDomain, domainGroups, makeTask, parseTask, requestApi, concurrentMap, mergeTasks, mergePlan } from '../extension/core.js';
const tabs = Array.from({ length: 300 }, (_, id) => ({ id, title: `标题${id}`, url: `https://sub.example.com/${id}?secret=1`, groupId: -1 }));
const groups = domainGroups(tabs);
const task = makeTask('name', groups);
const valid = { groups: [{ title: '开发', summary: '开发资料', color: 'blue', groupIds: ['d0'] }] };
test('root domains follow PSL including compound suffixes, wildcard and exceptions', () => {
  for (const [url, expected] of [
    ['https://a.b.example.com', 'example.com'], ['https://docs.example.co.uk', 'example.co.uk'],
    ['https://a.example.com.cn', 'example.com.cn'], ['https://a.github.io', 'a.github.io'],
    ['https://x.a.github.io', 'a.github.io'], ['https://a.b.ck', 'a.b.ck'],
    ['https://x.www.ck', 'www.ck'], ['https://x.city.kawasaki.jp', 'city.kawasaki.jp'],
    ['http://localhost:8080', 'localhost'], ['http://127.0.0.1:99', '127.0.0.1'],
    ['http://[::1]:80', '[::1]'], ['https://例子.中国', 'xn--fsqu00a.xn--fiqs8s'],
  ]) assert.equal(rootDomain(url), expected, url);
});
test('300 same-domain tabs produce one bounded group description, no paths or tab IDs', () => {
  assert.equal(groups.length, 1);
  assert.equal(groups[0].tabs.length, 300);
  assert.equal(task.groups[0].count, 300);
  assert.equal(task.groups[0].samples.length, 3);
  assert.ok(JSON.stringify(task).length < 500);
  assert.ok(!JSON.stringify(task).includes('secret'));
  assert.ok(!JSON.stringify(task).includes('tabIds'));
});
test('validate all naming IDs and merge relations before applying', () => {
  assert.deepEqual(parseTask(valid, task), valid.groups);
  for (const groupIds of [['d0', 'd0'], ['other'], []]) assert.throws(() => parseTask({ groups: [{ ...valid.groups[0], groupIds }] }, task));
  assert.throws(() => parseTask({ groups: [] }, task));
  assert.throws(() => parseTask({ groups: [{ ...valid.groups[0], color: 'invalid' }] }, task));
  assert.throws(() => parseTask('{}', task));
  assert.deepEqual(parseTask('```json\n' + JSON.stringify(valid) + '\n```', task), valid.groups);
  assert.deepEqual(parseTask({ groups: [] }, makeTask('merge', groups)), []);
});
test('protect fixed, grouped, private, and browser tabs', () => {
  assert.equal(eligible(tabs[0]), true);
  for (const change of [{ pinned: true }, { incognito: true }, { groupId: 4 }, { url: 'chrome://settings' }]) assert.equal(eligible({ ...tabs[0], ...change }), false);
});
test('configuration validation prevents insecure remote endpoints', () => {
  assert.throws(() => validateSettings(defaults));
  assert.throws(() => endpoint({ ...defaults, baseUrl: 'http://example.com/v1' }));
  assert.throws(() => endpoint({ ...defaults, baseUrl: 'https://user:password@example.com' }));
  assert.equal(endpoint({ ...defaults, baseUrl: 'http://localhost:8080/v1/' }), 'http://localhost:8080/v1/chat/completions');
  assert.throws(() => validateSettings({ ...defaults, intervalSeconds: 0 }));
});
test('OpenAI and Anthropic transport send bounded group tasks', async () => {
  for (const provider of ['openai', 'anthropic']) {
    const result = await requestApi({ ...defaults, provider, model: 'test', apiKey: 'secret' }, task, async (url, options) => {
      assert.equal(options.redirect, 'error');
      assert.ok(JSON.parse(options.body).messages[0].content.includes('root-domain'));
      assert.ok(provider === 'anthropic' ? options.headers['x-api-key'] === 'secret' : options.headers.Authorization === 'Bearer secret');
      return { ok: true, json: async () => provider === 'anthropic' ? { content: [{ type: 'text', text: JSON.stringify(valid) }] } : { choices: [{ message: { content: JSON.stringify(valid) } }] } };
    });
    assert.deepEqual(result, valid.groups);
  }
  await assert.rejects(requestApi(defaults, task, async () => ({ ok: false, status: 401 })), /HTTP 401/);
});
test('concurrency pool bounds simultaneous requests and drains before failing', async () => {
  let active = 0; let peak = 0;
  const values = await concurrentMap([1, 2, 3, 4, 5, 6], 3, async value => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5)); active--; return value * 2;
  });
  assert.equal(peak, 3); assert.deepEqual(values, [2, 4, 6, 8, 10, 12]);
  await assert.rejects(concurrentMap([1, 2, 3], 3, async value => {
    active++; await new Promise(resolve => setTimeout(resolve, 5)); active--;
    if (value === 1) throw new Error('timeout');
  }), /timeout/);
  assert.equal(active, 0);
});
test('bounded merge comparisons cover every pair across batches', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ ...groups[0], id: `d${i}` }));
  const tasks = mergeTasks(many);
  for (const task of tasks) { assert.ok(task.groups.length <= 12); assert.ok(!JSON.stringify(task).includes('samples')); }
  for (const a of many) for (const b of many) {
    if (a !== b) assert.ok(tasks.some(task => task.groups.some(g => g.id === a.id) && task.groups.some(g => g.id === b.id)));
  }
  const suggestions = [['d0', 'd7'], ['d7', 'd19']].map(groupIds => ({ ...valid.groups[0], groupIds }));
  const plan = mergePlan(many, suggestions);
  assert.equal(plan.find(component => component.members.length === 3).members.length, 3);
  assert.equal(plan.length, 18);
});
