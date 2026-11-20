import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeLanguage, language, t } from '../extension/i18n.js';
import { messages } from '../extension/messages.js';
import { defaults, normalizeSettings, validateSettings, makeTask, taskPrompt, requestApi, endpoint } from '../extension/core.js';

test('Chinese locales use Chinese; English, unsupported and missing locales use English', () => {
  for (const locale of ['zh', 'zh-CN', 'zh-TW', 'zh-Hant-HK', 'ZH_cn']) assert.equal(normalizeLanguage(locale), 'zh');
  for (const locale of ['en', 'en-US', 'fr-FR', 'ja', '', undefined]) assert.equal(normalizeLanguage(locale), 'en');
  assert.equal(t('tabs', {}, 'zh-TW'), '标签页');
  assert.equal(t('tabs', {}, 'fr-FR'), 'Tabs');
  assert.equal(t('tabsCount', { count: 3 }, 'en'), '3 tabs');
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages.zh).sort());
  for (const key of Object.keys(messages.en)) {
    assert.deepEqual((messages.en[key].match(/\{\w+\}/g) || []).sort(), (messages.zh[key].match(/\{\w+\}/g) || []).sort(), key);
  }
});
test('all built-in prompt instructions remain English while output language follows Chrome', () => {
  const original = globalThis.chrome;
  try {
    for (const [locale, expected] of [['zh-TW', 'Chinese'], ['en-US', 'English'], ['fr', 'English']]) {
      globalThis.chrome = { i18n: { getUILanguage: () => locale } };
      const groups = [{ id: 'd0', domain: 'example.com', tabs: [1], samples: ['Documentation'], title: 'Docs', summary: 'Documentation' }];
      for (const stage of ['name', 'merge']) {
        const task = makeTask(stage, groups);
        assert.equal(task.language, language());
        const prompt = taskPrompt(task);
        assert.match(prompt, new RegExp(`Write titles and summaries in ${expected}`));
        assert.ok(!/[\u3400-\u9fff]/.test(prompt));
        assert.ok(prompt.includes('Group data: '));
      }
    }
  } finally { globalThis.chrome = original; }
});
test('removed local provider migrates to unconfigured API mode with schedule off', () => {
  const migrated = normalizeSettings({ provider: 'codex', model: 'old', apiKey: 'old', automatic: true, instructions: 'Keep work separate' });
  assert.equal(migrated.provider, 'openai');
  assert.equal(migrated.automatic, false);
  assert.equal(migrated.apiKey, '');
  assert.equal(migrated.model, '');
  assert.equal(migrated.instructions, 'Keep work separate');
  assert.throws(() => validateSettings({ ...defaults, provider: 'codex' }));
  assert.ok(!JSON.parse(readFileSync('extension/manifest.json')).permissions.includes('nativeMessaging'));
});
test('both compatible formats accept custom API hosts and preserve URL prefixes', async () => {
  for (const provider of ['openai', 'anthropic']) {
    const settings = { ...defaults, provider, baseUrl: 'https://custom.example/api/v2', model: 'user-model', apiKey: 'user-key' };
    const task = { stage: 'merge', instructions: '', language: 'en', groups: [] };
    await requestApi(settings, task, async (url, options) => {
      assert.equal(url, settings.baseUrl + (provider === 'anthropic' ? '/messages' : '/chat/completions'));
      assert.equal(JSON.parse(options.body).model, 'user-model');
      assert.ok(provider === 'anthropic' ? options.headers['x-api-key'] === 'user-key' : options.headers.Authorization === 'Bearer user-key');
      return { ok: true, json: async () => provider === 'anthropic' ? { content: [{ type: 'text', text: '{"groups":[]}' }] } : { choices: [{ message: { content: '{"groups":[]}' } }] } };
    });
  }
  assert.equal(endpoint({ ...defaults, baseUrl: 'https://custom.example/api/v2/' }), 'https://custom.example/api/v2/chat/completions');
});
