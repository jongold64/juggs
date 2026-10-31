// The Powers tab: Making a Power (start at Power Level 1, add upgrades), the character's Powers, the stepped spell list
// and the Power Sources, all from the Book of Powers. Casting is freeform: "My Powers" is a shortcut list, not spells
// known.
import * as R from './rules.js';
import { newPower, cleanPower } from './character.js';
import { esc, options, cap } from './dom.js';
import { weirdOn, weirdCard } from './weird.js';

// The Power being made. It is not saved until "Save to character"; editing = index in state.powers, or null.
let draft = null;
let editing = null;
// The spell list's filters. Page state only; not saved with the character.
const view = { query: '', pace: '', unlocked: false };

export function setPowerFilter(key, value) {
  view[key] = value;
}

export function resetDraft() {
  draft = newPower();
  editing = null;
}

// Controls in this tab carry data-draft="field"; app.js passes their changes here.
export function setDraft(D, field, value) {
  draft = cleanPower(D, { ...draft, [field]: value });
}

// Returns the new list of Powers after a button in this tab, or null if nothing changed.
export function powerAction(D, c, action, arg) {
  const list = [...c.powers];
  if (action === 'save') {
    const p = cleanPower(D, { ...draft, name: draft.name || 'Unnamed Power' });
    if (editing !== null && editing < list.length) list[editing] = p; else list.push(p);
    resetDraft();
    return list;
  }
  if (action === 'new') { resetDraft(); return null; }
  if (action === 'edit') { draft = { ...list[arg] }; editing = Number(arg); return null; }
  if (action === 'delete') {
    list.splice(Number(arg), 1);
    if (editing === Number(arg)) resetDraft();
    return list;
  }
  if (action === 'add-spell') {
    if (list.some(p => p.spell === arg)) return null;
    list.push(cleanPower(D, { spell: arg }));
    return list;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------------------------

export const powerName = (D, p) => (p.spell ? D.spellsById.get(p.spell).name : p.name || 'Unnamed Power');

const optionName = (list, id) => list.find(o => o.id === id)?.name || '';

// One line about a made Power.
export function describe(D, p) {
  const u = D.powers.upgrades;
  const parts = [optionName(u.reach, p.reach), optionName(u.targets, p.targets), optionName(u.duration, p.duration)];
  if (p.impact !== 'none') parts.push(optionName(u.impact, p.impact));
  if (p.force) parts.push(`Force +${p.force}`);
  const eff = D.effectsById.get(p.effect);
  return `${parts.join(' · ')}${eff ? ` · ${eff.name}` : ''}${p.notes ? `. ${p.notes}` : ''}`;
}

const manaNote = s => (s.cantrip ? 'free cantrip' : s.discounted ? `Level Discount (base ${s.powerLevel})` : 'base cost');

// ---------------------------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------------------------

function makeCard(D, c) {
  const u = D.powers.upgrades;
  const sum = R.madePowerSummary(D, c, draft);
  const magicOn = c.genres.some(g => ['magic', 'psionics', 'weird-magic'].includes(g));
  const sources = D.powers.sources.filter(s => !s.universal).map(s => ({ value: s.id, label: s.name }));
  const effects = D.effects.map(e => ({ value: e.id, label: `${e.name} (${e.condition})` }));
  const sel = (label, field, list) => `<div class="sb-cat"><div class="sb-label">${label}</div>
    <select data-draft="${field}">${options(list.map(o => ({ value: o.id, label: `${o.name}${o.pl ? ` (+${o.pl})` : ''}` })), draft[field])}</select></div>`;
  const chips = [['Start', 1],
    ...['reach', 'targets', 'duration', 'impact'].map(k => [optionName(u[k], draft[k]), u[k].find(o => o.id === draft[k]).pl]),
    ...(draft.force ? [[`Force ×${draft.force}`, draft.force]] : [])].filter(ch => ch[1] !== 0);
  return `<section class="card wide spell-builder">
    <h2>${editing !== null ? 'Edit Power' : 'Make a Power'}</h2>
    ${magicOn ? '' : '<p class="warn">No Magic, Psionics or Weird Magic Genre is switched on for this campaign.</p>'}
    <p class="hint">${esc(D.powers.making_rule)}</p>
    <div class="two-col">
      <label class="field">Name <input type="text" data-draft="name" value="${esc(draft.name)}" placeholder="Name your Power…" maxlength="80"></label>
      <label class="field">Power Source <select data-draft="source">${options(sources, draft.source, 'Choose…')}</select></label>
    </div>
    <div class="sb-grid">
      ${sel('Reach', 'reach', u.reach)}${sel('Targets', 'targets', u.targets)}${sel('Duration', 'duration', u.duration)}${sel('Impact', 'impact', u.impact)}
      <div class="sb-cat"><div class="sb-label">Force <span class="hint">(+1 each: hits harder)</span></div>
        <select data-draft="force" data-type="int">${options([0, 1, 2, 3, 4].map(n => ({ value: n, label: String(n) })), draft.force)}</select></div>
      <div class="sb-cat"><div class="sb-label">Effect type <span class="hint">(boxes on the ladder, never discounted)</span></div>
        <select data-draft="effect">${options(effects, draft.effect, 'None')}</select></div>
    </div>
    <div class="sb-result">
      <div><span class="sb-rl">Level</span><span class="sb-rv big">PL ${sum.powerLevel}</span></div>
      <div><span class="sb-rl">Mana for you</span><span class="sb-rv">${sum.mana}</span><span class="sb-rs">${esc(manaNote(sum))}</span></div>
      <div><span class="sb-rl">On a hit</span><span class="sb-rv">≥ ${sum.powerLevel}</span><span class="sb-rs">overage or PL, up to the Hit Cap</span></div>
      <div class="sb-chips">${chips.map(([k, p]) => `<span class="sb-chip">${esc(k)} <b>+${p}</b></span>`).join('')}</div>
      ${sum.over ? `<p class="warn">PL ${sum.rawLevel} is above the maximum of 5: cut an upgrade.</p>` : ''}
      ${sum.powerLevel > R.maxPowerLevel(c.level) ? `<p class="warn">Above PL ${R.maxPowerLevel(c.level)}, the most a caster can use at Level ${c.level}.</p>` : ''}
      <div class="sb-buttons">
        <button type="button" class="primary" data-power="save">${editing !== null ? 'Save changes' : 'Save to character'}</button>
        <button type="button" data-power="new">${editing !== null ? 'Cancel' : 'Clear'}</button>
      </div>
    </div>
    <label class="field">Notes <input type="text" data-draft="notes" value="${esc(draft.notes)}" maxlength="500"></label>
    <p class="hint">${esc(D.powers.limits_rule)} ${esc(D.powers.cantrip_rule)}</p>
  </section>`;
}

function stepTable(D, c, spell) {
  return `<div class="table-wrap"><table class="qr-table"><thead><tr><th>Level</th><th>PL</th><th>Mana</th><th>Reach · Targets · Duration</th><th>What it does</th></tr></thead>
    <tbody>${spell.steps.map(s => {
      const m = R.spellStepSummary(D, c, s);
      return `<tr${s.level > c.level ? ' class="beyond"' : ''}><th scope="row">${s.level}</th><td>${s.pl}</td><td>${m.mana}</td>
        <td>${esc(s.reach)} · ${esc(s.targets)} · ${esc(s.duration)}</td><td>${esc(s.text)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function mineCard(D, c) {
  const rows = c.powers.map((p, i) => {
    const spell = D.spellsById.get(p.spell);
    if (spell) {
      const top = R.stepsAt(spell, c.level).pop();
      const m = R.spellStepSummary(D, c, top);
      return `<li><b>${esc(spell.name)}</b> <span class="hint">PL ${top.pl} at most · ${m.mana} Mana · ${esc(spell.pace)}</span>
        <div class="info">${esc(top.reach)} · ${esc(top.targets)} · ${esc(top.duration)}. ${esc(top.text)}</div>
        <button type="button" class="tiny" data-power="delete" data-arg="${i}">Remove</button></li>`;
    }
    const s = R.madePowerSummary(D, c, p);
    const src = D.sourcesById.get(p.source)?.name;
    return `<li><b>${esc(powerName(D, p))}</b> <span class="hint">PL ${s.powerLevel} · ${s.mana} Mana${src ? ` · ${esc(src)}` : ''}</span>
      <div class="info">${esc(describe(D, p))}</div>
      <button type="button" class="tiny" data-power="edit" data-arg="${i}">Edit</button>
      <button type="button" class="tiny" data-power="delete" data-arg="${i}">Remove</button></li>`;
  }).join('');
  return `<section class="card wide"><h2>${esc(c.name || 'This character')}'s Powers</h2>
    <p class="hint">A shortcut list: casting is freeform, so any Power can be cast without being listed here.
      ${R.hasLevelDiscount(D, c) ? `Your Level Discount is −${R.levelDiscount(D, c.level)} Mana, minimum 1.` : 'Only Casters and Channelers have the Level Discount.'}</p>
    ${rows ? `<ul class="power-list">${rows}</ul>` : '<p class="hint">None yet. Make one above or add a spell below.</p>'}</section>`;
}

function spellCard(D, c) {
  const q = view.query.trim().toLowerCase();
  const list = D.powers.spells.filter(s => (!q || `${s.name} ${s.sources_text} ${s.effect_text}`.toLowerCase().includes(q))
    && (!view.pace || s.pace === view.pace) && (!view.unlocked || R.stepsAt(s, c.level).length > 1));
  const paces = ['Quick', 'Steady', 'Measured', 'Slow', 'Epic'];
  const held = new Set(c.powers.map(p => p.spell));
  const cards = list.map(s => {
    const have = R.stepsAt(s, c.level).length;
    return `<details class="rf-card"><summary><b>${esc(s.name)}</b>
        <span class="hint">${esc(s.sources_text)}${s.effect_text ? ` · ${esc(s.effect_text)}` : ''} · ${esc(s.pace)} · Step ${have} of ${s.steps.length}</span>
        ${held.has(s.id) ? '<span class="good">Listed</span>' : ''}</summary>
      ${stepTable(D, c, s)}
      ${s.reskin ? `<p class="hint">Reskin: ${esc(s.reskin)}</p>` : ''}
      ${held.has(s.id) ? '' : `<div class="rf-buttons"><button type="button" class="tiny" data-power="add-spell" data-arg="${s.id}">Add to my Powers</button></div>`}
    </details>`;
  }).join('');
  return `<section class="card wide"><h2>Spells <span class="hint">${list.length} of ${D.powers.spells.length}</span></h2>
    <p class="hint">${esc(D.powers.spell_rule)}</p>
    <div class="rf-filters">
      <input type="search" id="spell-search" data-power-filter="query" value="${esc(view.query)}" placeholder="Search by name, Source or Effect…" aria-label="Search spells">
      <select data-power-filter="pace" aria-label="Pace">${options(paces.map(p => ({ value: p, label: p })), view.pace, 'All paces')}</select>
      <label class="check"><input type="checkbox" data-power-filter="unlocked"${view.unlocked ? ' checked' : ''}> Past Step 1 at my level</label>
    </div>
    ${cards || '<p class="hint">No spells match.</p>'}</section>`;
}

function sourceCard(D) {
  const pool = s => (s.pools_text ? ` · ${esc(s.pools_text)}` : '');
  return `<section class="card wide"><h2>Power Sources</h2>
    <p class="hint">Physical always applies. The first six are core; the rest are genre expansions to agree with your GM.</p>
    ${D.powers.sources.filter(s => !s.universal).map(s => `<details class="rf-card"><summary><b>${esc(s.name)}</b>
      <span class="hint">${s.abilities?.length ? s.abilities.map(a => D.abilitiesById.get(a).name).join(' or ') : 'To be decided'}${pool(s)}${s.tier ? ` · ${cap(s.tier)}` : ''}</span></summary>
      ${(s.text || []).map(t => `<p class="hint">${esc(t)}</p>`).join('') || '<p class="warn">Details to be decided.</p>'}</details>`).join('')}
  </section>`;
}

export function renderPowers(D, c) {
  if (!draft) resetDraft();
  return makeCard(D, c) + (weirdOn(c) ? weirdCard(D) : '') + mineCard(D, c) + spellCard(D, c) + sourceCard(D);
}
