import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
for (const dir of ['extension', 'tests', 'scripts']) {
  for (const file of readdirSync(dir).filter(file => file.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', `${dir}/${file}`], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(1);
  }
}
JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
for (const locale of ['en', 'zh_CN', 'zh_TW']) JSON.parse(readFileSync(`extension/_locales/${locale}/messages.json`, 'utf8'));
console.log('JavaScript, locale catalogs and manifest syntax OK.');
