// Small page helpers shared by the page modules.

export const $ = id => document.getElementById(id);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function signed(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

// Plain text -> paragraphs.
export function paragraphs(text) {
  return String(text || '').split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

// <option> list. items: [{ value, label, disabled? }]; blank: label for an empty first option, or null for none.
export function options(items, selected, blank = null) {
  const first = blank === null ? '' : `<option value="">${esc(blank)}</option>`;
  return first + items.map(i => `<option value="${esc(i.value)}"${i.value === selected ? ' selected' : ''}${
    i.disabled ? ' disabled' : ''}>${esc(i.label)}</option>`).join('');
}

// A select grouped under <optgroup> headings: groups: [[label, items]].
export function groupedOptions(groups, selected, blank = null) {
  const first = blank === null ? '' : `<option value="">${esc(blank)}</option>`;
  return first + groups.filter(([, items]) => items.length)
    .map(([label, items]) => `<optgroup label="${esc(label)}">${options(items, selected)}</optgroup>`).join('');
}

export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
