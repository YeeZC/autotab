import { messages } from './messages.js';
export function normalizeLanguage(value) {
  return /^zh(?:[-_]|$)/i.test(value || '') ? 'zh' : 'en';
}
export function language() {
  return normalizeLanguage(globalThis.chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language || 'en');
}
export function t(key, values = {}, locale = language()) {
  const template = messages[normalizeLanguage(locale)]?.[key] ?? messages.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}
export function localizeDocument(root = document) {
  root.documentElement.lang = language() === 'zh' ? 'zh-CN' : 'en';
  root.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  for (const attribute of ['title', 'aria-label', 'placeholder']) {
    root.querySelectorAll(`[data-i18n-${attribute}]`).forEach(element => {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
    });
  }
}
