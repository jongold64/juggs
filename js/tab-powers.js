// The Powers tab: a Spell Builder (layout from source/juggs_spell_builder_v2.html, numbers from the Player Book's
// point budget), the character's saved Powers, and the Player Book's example Powers.
import * as R from './rules.js';
import { newPower, cleanPower } from './character.js';
import { esc, options, groupedOptions } from './dom.js';

// The Power being built. It is not saved until "Save to character"; editing = index in state.powers, or null.
let draft = null;
let editing = null;

export function resetDraft() {
  draft = newPower();
  editing = null;
}

// Controls in this tab carry data-draft="field"; app.js passes their changes here.
export function setDraft(D, field, value) {
  draft = cleanPower(D, { ...draft, [field]: value });
}

export function toggleCondition(D, id) {
  const set = new Set(draft.conditions);
  if (set.has(id)) set.delete(id); else if (set.size < D.powers.builder.max_conditions) set.add(id);
  draft.conditions = [...set];
}

// Returns the new list of Powers after a button in this tab, or null if nothing changed.
export function powerAction(D, c, action, arg) {
  const list = [...c.powers];
  if (action === 'save') {
    const p = cleanPower(D, { ...draft, name: draft.name || autoName(D, draft) || 'Unnamed Power' });
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
  if (action === 'example') {
    const [id, level] = String(arg).split(':');
    const ex = D.powers.examples.find(e => e.id === id);
    list.push(cleanPower(D, { name: ex.name, example: id, exampleLevel: Number(level) }));
    return list;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Names and descriptions (after the Spell Builder's autoName and description)
// ---------------------------------------------------------------------------------------------------------------

const EFFECT_WORDS = {
  acid: ['Corrosive', 'Acid'], cold: ['Freezing', 'Frost'], concussive: ['Deafening', 'Concussion'],
  electric: ['Crackling', 'Lightning'], fire: ['Burning', 'Flame'], force: ['Crushing', 'Force'],
  gravity: ['Crushing', 'Gravity'], healing: ['Mending', 'Restoration'], nature: ['Entangling', 'Thorn'],
  necrotic: ['Withering', 'Blight'], psychic: ['Searing', 'Mind'], radiant: ['Blazing', 'Radiance'],
  shadow: ['Shrouding', 'Shadow'], sonic: ['Thundering', 'Echo'], toxic: ['Festering', 'Venom'],
  void: ['Unraveling', 'Void'], bleed: ['Bleeding', 'Blood'],
};
const TARGET_WORDS = { line: 'Lance', cone: 'Burst', burst: 'Nova', 'multi-3': 'Barrage', 'multi-6': 'Storm' };
const RANGE_WORDS = { far: 'Far-Reaching', sight: 'Distant', anywhere: 'Omnipresent' };
const DURATION_WORDS = { rounds: 'Pulse', concentration: 'Sustained', minutes: 'Lingering', 'ten-minutes': 'Enduring',
                         hours: 'Eternal' };
const CONDITION_WORDS = {
  bleeding: 'Bleeding', blinded: 'Blinding', burning: 'Burning', charmed: 'Beguiling', concealed: 'Shrouding',
  confused: 'Confusing', dazed: 'Dazing', deafened: 'Silencing', doomed: 'Dooming', drained: 'Draining',
  enfeebled: 'Weakening', exhausted: 'Exhausting', exposed: 'Exposing', fascinated: 'Beguiling',
  frightened: 'Terrifying', invisible: 'Vanishing', petrified: 'Petrifying', poisoned: 'Poisoning', prone: 'Toppling',
  restrained: 'Binding', routed: 'Routing', sickened: 'Sickening', silenced: 'Muting', slowed: 'Slowing',
  stunned: 'Stunning', blessed: 'Blessed', braced: 'Fortifying', focused: 'Focusing', hasted: 'Hastening',
  inspired: 'Inspiring', quickened: 'Quickening', rallied: 'Rallying', resolute: 'Resolute',
};

export function autoName(D, p) {
  if (p.summon) return p.summon === 'rival' ? 'Summoned Champion' : 'Summoned Ally';
  const [adj, noun] = EFFECT_WORDS[p.effect] || ['', ''];
  const shape = TARGET_WORDS[p.targets] || '';
  const cond = p.conditions.map(x => CONDITION_WORDS[x]).filter(Boolean);
  if (cond.length >= 2 && !adj) return `${cond[0]} and ${cond[1]}`;
  if (cond[0] && adj) return [cond[0], adj, shape].filter(Boolean).join(' ');
  if (adj && shape && RANGE_WORDS[p.range]) return `${RANGE_WORDS[p.range]} ${adj} ${shape}`;
  if (noun && shape && DURATION_WORDS[p.duration]) return `${DURATION_WORDS[p.duration]} ${noun} ${shape}`;
  if (adj && shape) return `${adj} ${shape}`;
  if (adj) return `${adj} ${noun}`;
  if (cond[0]) return `${cond[0]} Power`;
  return '';
}

const optionName = (list, id) => list.find(o => o.id === id)?.name || '';

// Sentence pieces, as in the Spell Builder's description.
const RANGE_PHRASE = { close: 'at Close range', near: 'at Near range (30–59 ft)', far: 'at Far range (60+ ft)',
                       sight: 'anywhere in sight', anywhere: 'anywhere known' };
const TARGET_PHRASE = { single: 'a single target', line: 'a 30-ft line', cone: 'a 15-ft cone', burst: 'a 20-ft burst',
                        'multi-3': 'up to 3 targets', 'multi-6': 'up to 6 targets' };
const DURATION_PHRASE = { rounds: 'for 1 round per level', concentration: 'while the caster concentrates (up to 1 minute)',
                          minutes: 'for 1 minute per level', 'ten-minutes': 'for 10 minutes per level',
                          hours: 'for 1 hour per level' };
const SUMMON_PHRASE = { grunt: 'a Grunt-tier creature', rival: 'a Rival-tier creature' };

export const powerName = (D, p) => p.name || autoName(D, p) || 'Unnamed Power';

export function describe(D, p, sum) {
  const name = p.name || autoName(D, p) || 'The Power';
  const eff = D.effectsById.get(p.effect);
  const conds = p.conditions.map(x => D.conditionsById.get(x).name);
  let s = `${name} affects ${TARGET_PHRASE[p.targets]} ${RANGE_PHRASE[p.range]}`;
  s += p.duration === 'instant' ? ', resolving instantly' : `, persisting ${DURATION_PHRASE[p.duration]}`;
  if (p.summon) s += `. It calls ${SUMMON_PHRASE[p.summon]} for the scene`;
  if (eff) s += `. It carries ${eff.name} (strength set by Surge)`;
  if (conds.length) s += `, applying ${conds.join(' + ')}`;
  s += '.';
  const level = sum.powerLevel === 0 ? 'Cantrip' : `Power Level ${sum.effectiveLevel}`;
  return `${s} ${level} · ${sum.points} points · ${sum.mana} Mana.`;
}

// ---------------------------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------------------------

function exampleSummary(D, c, p) {
  const level = p.exampleLevel;
  const caster = R.isCaster(D, c);
  return { points: null, powerLevel: level, effectiveLevel: level,
           mana: R.powerCost(level, R.tierFor(D, c.level).power_level, caster), discounted: caster };
}

export function summaryFor(D, c, p) {
  return p.example ? exampleSummary(D, c, p) : R.powerSummary(D, c, p);
}

export function renderPowers(D, c) {
  if (!draft) resetDraft();
  const b = D.powers.builder;
  const sum = R.powerSummary(D, c, draft);
  const magicOn = c.genres.some(g => ['magic', 'psionics', 'weird-magic'].includes(g));
  const opt = list => list.map(o => ({ value: o.id, label: `${o.name} (${o.points})` }));
  const sel = (label, field, list, blank = null) => `<div class="sb-cat"><div class="sb-label">${label}</div>
    <select data-draft="${field}">${options(opt(list), draft[field], blank)}</select></div>`;

  const core = D.effects.filter(e => !e.supplemental).map(e => ({ value: e.id, label: e.name }));
  const extra = D.effects.filter(e => e.supplemental).map(e => ({ value: e.id, label: e.name }));
  const effect = D.effectsById.get(draft.effect);
  const sources = D.powers.sources.filter(s => !s.universal).map(s => ({ value: s.id, label: s.name }));

  const condButtons = list => list.map(x => {
    const on = draft.conditions.includes(x.id);
    const full = !on && draft.conditions.length >= b.max_conditions;
    return `<button type="button" class="sb-cond${on ? ' on' : ''}" data-draft-cond="${x.id}"${full ? ' disabled' : ''}
      title="${esc(x.effect || '')}">${esc(x.name)}</button>`;
  }).join('');
  const negative = D.conditions.filter(x => !x.positive && x.id !== 'removed');
  const positive = D.conditions.filter(x => x.positive);

  const chips = [
    ['Range', optionName(b.range, draft.range), b.range.find(o => o.id === draft.range).points],
    ['Targets', optionName(b.targets, draft.targets), b.targets.find(o => o.id === draft.targets).points],
    ['Duration', optionName(b.duration, draft.duration), b.duration.find(o => o.id === draft.duration).points],
    ...(draft.summon ? [['Summon', optionName(b.summons, draft.summon), b.summons.find(o => o.id === draft.summon).points]] : []),
    ...draft.conditions.map(x => [D.conditionsById.get(x).name, 'Condition', b.condition_points]),
    ...(draft.focusItem && R.focusItemAllowed(D, draft) ? [['Focus Item', '', -1]] : []),
  ].filter(ch => ch[2] !== 0);

  const builder = `<section class="card wide spell-builder">
    <h2>${editing !== null ? 'Edit Power' : 'Build a Power'}</h2>
    ${magicOn ? '' : '<p class="warn">No Magic, Psionics or Weird Magic Genre is switched on for this campaign.</p>'}
    <div class="two-col">
      <label class="field">Name <input type="text" data-draft="name" value="${esc(draft.name)}"
        placeholder="${esc(autoName(D, draft) || 'Name your Power…')}" maxlength="80"></label>
      <label class="field">Power Source <select data-draft="source">${options(sources, draft.source, 'Choose…')}</select></label>
    </div>
    <div class="sb-grid">
      ${sel('A · Range', 'range', b.range)}
      ${sel('B · Targets / Area', 'targets', b.targets)}
      ${sel('C · Duration', 'duration', b.duration)}
      <div class="sb-cat"><div class="sb-label">D · Effect <span class="hint">(0 — Surge sets its strength)</span></div>
        <select data-draft="effect">${groupedOptions([['Effects', core], ['Supplemental (GM approval)', extra]], draft.effect, 'None — overage only')}</select>
        <select data-draft="summon">${options(opt(b.summons), draft.summon, 'No summon')}</select></div>
    </div>
    ${effect ? `<div class="sb-scale">${effect.intensity.map((x, i) => `<span><b>Surge ${i + 2}${i === 3 ? '+' : ''}</b> ${esc(x.text)}</span>`).join('')}</div>` : ''}
    <div class="sb-cat"><div class="sb-label">E · Conditions <span class="hint">(${b.condition_points} point each, up to ${b.max_conditions})</span></div>
      <div class="sb-conds">${condButtons(negative)}</div>
      <div class="sb-label small">Positive</div><div class="sb-conds">${condButtons(positive)}</div></div>
    <div class="sb-mods">${b.modifiers.map(m => {
      const blocked = m.id === 'focus-item' && !R.focusItemAllowed(D, draft);
      const field = m.id === 'focus-item' ? 'focusItem' : 'entityBlessing';
      return `<label class="check${blocked ? ' dim' : ''}"><input type="checkbox" data-draft="${field}"${draft[field] ? ' checked' : ''}${
        blocked ? ' disabled' : ''}> <b>${esc(m.name)}</b> <span class="hint">${esc(m.text)}</span></label>`;
    }).join('')}</div>
    <div class="sb-result">
      <div><span class="sb-rl">Points</span><span class="sb-rv big">${sum.points}</span></div>
      <div><span class="sb-rl">Level</span><span class="sb-rv">${sum.powerLevel === 0 ? 'Cantrip' : `PL ${sum.effectiveLevel}`}</span>
        ${draft.entityBlessing && sum.powerLevel ? `<span class="sb-rs">built at PL ${sum.powerLevel}</span>` : ''}</div>
      <div><span class="sb-rl">Mana for you</span><span class="sb-rv">${sum.mana}</span>
        <span class="sb-rs">${sum.powerLevel === 0 ? (sum.mana ? 'not a practitioner' : 'free Cantrip') : sum.discounted ? `Caster discount (base ${sum.powerLevel})` : 'base cost'}</span></div>
      <div class="sb-chips">${chips.length ? chips.map(([k, v, p]) => `<span class="sb-chip">${esc(k)}${v ? `: ${esc(v)}` : ''} <b>${p > 0 ? '+' : ''}${p}</b></span>`).join('')
        : '<span class="sb-chip dim">No costs yet</span>'}</div>
      <p class="sb-desc" id="power-desc">${esc(describe(D, draft, sum))}</p>
      <div class="sb-buttons">
        <button type="button" class="primary" data-power="save">${editing !== null ? 'Save changes' : 'Save to character'}</button>
        ${editing !== null ? '<button type="button" data-power="new">Cancel</button>' : '<button type="button" data-power="new">Clear</button>'}
        <button type="button" data-copy="power-desc">Copy description</button>
      </div>
    </div>
    <p class="hint">${esc(b.effect_note)} ${esc(b.cantrip_rule)}</p>
  </section>`;

  const saved = c.powers.map((p, i) => {
    const s = summaryFor(D, c, p);
    const src = D.sourcesById.get(p.source)?.name;
    const text = p.example ? D.powers.examples.find(e => e.id === p.example)?.levels.find(l => l.level === p.exampleLevel)
      : null;
    return `<li><b>${esc(powerName(D, p))}</b> <span class="hint">${s.powerLevel === 0 ? 'Cantrip' : `PL ${s.effectiveLevel}`} · ${s.mana} Mana${
      src ? ` · ${esc(src)}` : ''}${p.example ? ' · Player Book example' : ''}</span>
      <div class="info">${text ? esc(`${text.profile} → ${text.result || ''}`) : esc(describe(D, p, s))}</div>
      ${p.example ? '' : `<button type="button" class="tiny" data-power="edit" data-arg="${i}">Edit</button>`}
      <button type="button" class="tiny" data-power="delete" data-arg="${i}">Remove</button></li>`;
  }).join('');
  const mine = `<section class="card wide"><h2>${esc(c.name || 'This character')}'s Powers</h2>
    ${saved ? `<ul class="power-list">${saved}</ul>` : '<p class="hint">None yet. Build one above or add an example below.</p>'}</section>`;

  const examples = D.powers.examples.map(e => `<details class="example"><summary><b>${esc(e.name)}</b>
      <span class="hint">${esc(e.source_text)} · ${esc(e.ability_text)} · ${esc(e.effect_text)}</span></summary>
      <p class="hint">${esc(e.description || '')}</p>
      ${e.levels.length ? `<ul>${e.levels.map(l => `<li><b>L${l.level}</b> ${esc(l.profile)}${l.result ? ` → ${esc(l.result)}` : ''}
        <button type="button" class="tiny" data-power="example" data-arg="${e.id}:${l.level}">Add</button></li>`).join('')}</ul>`
        : '<p class="warn">No Power Level lines in the Player Book.</p>'}
      ${e.surge.length ? `<p class="hint">${e.surge.map(x => `${esc(x.boxes)} box: ${esc(x.text)}`).join(' · ')}</p>` : ''}</details>`).join('');
  const exampleCard = `<section class="card wide"><h2>Example Powers <span class="hint">from the Player Book</span></h2>${examples}</section>`;

  return builder + mine + exampleCard;
}
