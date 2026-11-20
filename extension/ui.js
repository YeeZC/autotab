const paths = {
  settings: '<path d="m9 3 .6 2a7 7 0 0 1 4.8 0L15 3l3 2-1.4 1.6a7 7 0 0 1 2.4 4.1l2 .3v3l-2 .3a7 7 0 0 1-2.4 4.1L18 20l-3 1-1-2a7 7 0 0 1-4 0l-1 2-3-1 1.4-1.6A7 7 0 0 1 5 14.3L3 14v-3l2-.3a7 7 0 0 1 2.4-4.1L6 5z"/><circle cx="12" cy="12" r="3"/>',
  window: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  ungroup: '<path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3M8 8l8 8m0-8-8 8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  connection: '<rect x="3" y="5" width="7" height="14" rx="2"/><rect x="14" y="5" width="7" height="14" rx="2"/><path d="M10 12h4M6.5 9h.01M17.5 15h.01"/>',
  sliders: '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3m6 0h4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  tabs: '<rect x="4" y="7" width="14" height="13" rx="2"/><path d="M8 7V4h13v12h-3"/>',
};
export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.tabs}</svg>`;
}
export function mountIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
}
export function animateIn(selector) {
  if (!globalThis.gsap || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.from(selector, { opacity: 0, y: 7, scale: 0.99, duration: 0.32, stagger: 0.035, ease: 'power2.out', clearProps: 'all' });
}
export function setStatus(element, message, state = '') {
  element.textContent = message;
  element.hidden = !message;
  element.dataset.state = state;
}
