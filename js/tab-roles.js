// The Roles & Feats tab: what the character has, then every Role, Specialty and Feat with its requirements checked
// for this character and buttons to take it at an open level.
import * as R from './rules.js';
import { esc, paragraphs, options, cap } from './dom.js';
import { reqStatus, mark } from './requirements-text.js';

// Which part of the tab is open and the Feat filters. Page state only; not saved with the character.
const view = { section: 'mine', query: '', domain: '', kind: '', eligible: false, category: '' };

export function setRolesFilter(key, value) {
  view[key] = value;
}

const SECTIONS = [['mine', 'Your character'], ['roles', 'Roles'], ['specialties', 'Specialties'], ['feats', 'Feats']];

// ---------------------------------------------------------------------------------------------------------------
// Where things can go
// ---------------------------------------------------------------------------------------------------------------

// Tier-change levels up to the character's level with no Role chosen yet.
const openRoleLevels = (D, c) => R.levelsUpTo(D.core.advancement.tier_change_levels, c.level).filter(lv => !c.roleAdvances[lv]);

// Feat levels where this Feat could go: an empty slot that accepts it, whose requirements are not failed.
function featSlotsFor(D, c, f) {
  return R.levelsUpTo(D.core.advancement.feat_levels, c.level).filter(lv => !c.feats[lv]
    && R.slotAccepts(D, lv, f)
    && R.checkRequirements(f.requires, R.requirementContext(D, c, lv)).ok !== false);
}

// Buttons return true when they changed the character.
export function rolesAction(D, c, action, arg) {
  if (action === 'section') { view.section = arg; return false; }
  const [a, ...rest] = String(arg).split(':');
  const b = rest.join(':');
  if (action === 'start-role') { c.role = a; return true; }
  if (action === 'advance-role') { c.roleAdvances[Number(a)] = b; return true; }
  if (action === 'take-spec') { c.specialties[0] = { id: a, level: 1 }; return true; }
  if (action === 'take-feat') { c.feats[Number(a)] = b; return true; }
  if (action === 'drop-feat') { delete c.feats[Number(a)]; return true; }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------------------------

const btn = (label, action, arg, cls = 'tiny') =>
  `<button type="button" class="${cls}" data-rf="${action}" data-arg="${esc(arg)}">${esc(label)}</button>`;

// levels[i]: the level Step i+1 was taken, the earliest level it could still come (a later tier change), or null if
// it cannot fit before Level 20.
function stepList(role, have, levels) {
  return `<ol class="steps">${role.steps.map((s, i) => {
    const lv = levels[i];
    const when = i < have ? `Level ${lv}` : lv ? `Level ${lv} at the earliest` : 'out of reach by Level 20';
    return `<li class="${i < have ? '' : 'locked'}"><b>Step ${s.step}</b> <span class="hint">(${when})</span> ${esc(s.text)}</li>`;
  }).join('')}</ol>`;
}

// The levels at which this character took each Step of a Role, then the earliest levels the rest could come: one
// Step per tier change still ahead (after the character's level and after the last Step taken).
function stepLevels(D, c, roleId) {
  const tiers = D.core.advancement.tier_change_levels;
  const out = [];
  if (c.role === roleId) out.push(1);
  for (const lv of tiers) if (lv <= c.level && c.roleAdvances[lv] === roleId) out.push(lv);
  const after = Math.max(c.level, out[out.length - 1] || 0);
  const ahead = tiers.filter(lv => lv > after);
  // A Role not held yet starts at the next open tier change (or Level 1 for a new character with no Role).
  if (!out.length && !c.role) ahead.unshift(1);
  while (out.length < 5) out.push(ahead.shift() ?? null);
  return out;
}

// The Steps of a Specialty or Stepped Feat, with the ones not yet reached greyed.
function tierSteps(record, level) {
  return `<ul class="steps">${record.steps.map(s => `<li class="${s.level <= level ? '' : 'locked'}"><b>${esc(s.tier)}</b>
    <span class="hint">Level ${s.level}</span> ${esc(s.text)}${s.at_the_table ? `<div class="hint">At the table: ${esc(s.at_the_table)}</div>` : ''}</li>`).join('')}</ul>`;
}

function renderMine(D, c) {
  const steps = R.roleSteps(D, c);
  const nextTier = D.core.advancement.tier_change_levels.find(lv => lv > c.level);
  const roles = Object.entries(steps).map(([id, n]) => {
    const role = D.rolesById.get(id);
    return `<h3>${esc(role.name)} <span class="hint">Step ${n} of 5</span></h3>${stepList(role, n, stepLevels(D, c, id))}`;
  }).join('') || '<p class="hint">No Role yet — choose one on the Character tab, or under Roles here.</p>';
  const nextNote = nextTier ? `<p class="hint">Next Role advancement: Level ${nextTier} (advance a Role you hold, or begin a new one).</p>` : '';
  const open = openRoleLevels(D, c);

  const specs = R.specialtiesHeld(D, c).map(sp =>
    `<h3>${esc(sp.name)} <span class="hint">${esc(cap(sp.category))} · ${sp.governing.map(a => D.abilitiesById.get(a).name).join(' or ')} · ${cap(sp.pool)}</span></h3>
      ${tierSteps(sp, c.level)}`).join('') || '<p class="hint">No Specialty yet.</p>';

  const feats = R.levelsUpTo(D.core.advancement.feat_levels, c.level).map(lv => {
    const f = D.featsById.get(c.feats[lv]);
    const sp = D.specialtiesById.get(R.slotSpecialty(c.feats[lv]));
    return `<li><b>Level ${lv}</b> ${f
      ? `${esc(f.name)} <span class="hint">${cap(f.kind)}</span> ${btn('Remove', 'drop-feat', lv)}
         <div class="info"><p>${esc(R.featNow(f, c.level))}</p></div>`
      : sp ? `${esc(sp.name)} <span class="hint">Specialty, shown above</span> ${btn('Remove', 'drop-feat', lv)}`
      : `<span class="hint">empty — pick one under Feats or on the Advancement tab</span>`}</li>`;
  }).join('');
  const capstone = D.featsById.get(c.capstone);
  const capstoneRow = c.level >= D.core.advancement.capstone.level ? `<li><b>Capstone</b> ${capstone
    ? `${esc(capstone.name)} <div class="info"><p>${esc(R.featNow(capstone, c.level))}</p>${c.capstoneNote ? `<p>${esc(c.capstoneNote)}</p>` : ''}</div>`
    : '<span class="hint">empty — pick one on the Advancement tab</span>'}</li>` : '';
  return `<section class="card wide"><h2>Roles</h2>${roles}${nextNote}${open.length
      ? `<p class="warn">Role advancement not chosen at Level ${open.join(', ')}.</p>` : ''}</section>
    <section class="card wide"><h2>Specialties</h2>${specs}</section>
    <section class="card wide"><h2>Feats</h2><ul class="feat-list">${feats}${capstoneRow}</ul>${R.featProblems(D, c).map(p => `<p class="warn">${esc(p)}</p>`).join('')}</section>`;
}

function renderRoleList(D, c) {
  const held = R.roleSteps(D, c);
  const open = openRoleLevels(D, c);
  const cats = [...new Set(D.roles.map(r => r.category))];
  const filter = `<div class="row"><select data-rf-filter="category">${options(cats.map(x => ({ value: x, label: cap(x) })), view.category, 'All Roles')}</select></div>`;
  const cards = D.roles.filter(r => !view.category || r.category === view.category).map(role => {
    const have = held[role.id] || 0;
    const startCheck = R.checkRequirements(role.requires, R.requirementContext(D, c, 1));
    const preset = D.presetsById.get(role.id);
    const buttons = [];
    if (!c.role) buttons.push(btn('Start with this Role', 'start-role', role.id));
    for (const lv of open) {
      const before = R.roleSteps(D, c, lv - 1)[role.id] || 0;
      if (before >= 5) continue;
      const ok = before ? true : R.checkRequirements(role.requires, R.requirementContext(D, c, lv)).ok !== false;
      if (ok) buttons.push(btn(before ? `Advance at Level ${lv}` : `Begin at Level ${lv}`, 'advance-role', `${lv}:${role.id}`));
    }
    return `<details class="rf-card"${have ? ' open' : ''}><summary><b>${esc(role.name)}</b>
        <span class="hint">${esc(cap(role.category))} · ${esc(role.identity)}</span>
        ${have ? `<span class="good">Step ${have}</span>` : `<span class="rf-mark">${mark(startCheck)}</span>`}</summary>
      <p>${esc(role.summary)}</p>
      <p>${role.requires.length ? reqStatus(D, startCheck) : '<span class="hint">No prerequisite.</span>'}
        ${role.prerequisite_text && role.prerequisite_text !== 'No prerequisite' ? `<span class="hint">(${esc(role.prerequisite_text)})</span>` : ''}</p>
      ${stepList(role, have, stepLevels(D, c, role.id))}
      ${preset ? `<p class="hint"><b>Suggested Build:</b> ${esc(D.specialtiesById.get(preset.specialty)?.name || '')} Specialty ·
        ${esc(D.aptitudesById.get(preset.aptitude)?.name || '')} Aptitude · ${esc(D.effectsById.get(preset.signature_effect)?.name || '')} ·
        Focus: ${preset.focus_skills.map(s => esc(D.skillsById.get(s).name)).join(', ')}</p>` : ''}
      ${role.design_note ? `<p class="hint"><i>${esc(role.design_note)}</i></p>` : ''}
      ${buttons.length ? `<div class="rf-buttons">${buttons.join('')}</div>` : ''}</details>`;
  }).join('');
  return `<section class="card wide"><h2>All ${D.roles.length} Roles</h2>
    <p class="hint">✓ you meet the requirements now · ✗ not yet · ? check by hand. Steps 2–5 arrive at Levels 5, 9, 13 and 17.</p>
    ${filter}${cards}</section>`;
}

function renderSpecialtyList(D, c) {
  const held = R.specialtiesHeld(D, c).map(s => s.id);
  const ctx = R.requirementContext(D, c, c.level);
  const openSlots = R.levelsUpTo(D.core.advancement.feat_levels, c.level).filter(lv => !c.feats[lv]);
  const cards = D.specialties.map(sp => {
    const syn = sp.synergy?.requires ? R.checkClause(sp.synergy.requires, ctx) : null;
    const buttons = [];
    if (!held.includes(sp.id)) {
      if (!c.specialties[0]) buttons.push(btn('Take as your free Specialty', 'take-spec', sp.id));
      else for (const lv of openSlots) buttons.push(btn(`Take with the Level ${lv} Feat slot`, 'take-feat', `${lv}:specialty:${sp.id}`));
    }
    return `<details class="rf-card"${held.includes(sp.id) ? ' open' : ''}><summary><b>${esc(sp.name)}</b>
        <span class="hint">${esc(cap(sp.category))} · ${sp.governing.map(a => D.abilitiesById.get(a).name).join(' or ')} · ${cap(sp.pool)}</span>
        ${held.includes(sp.id) ? '<span class="good">Yours</span>' : ''}</summary>
      <p class="hint">${esc(sp.summary || '')} Bonus Focus Skills: ${sp.bonus_skills.map(s => esc(D.skillsById.get(s)?.name || s)).join(', ')}.</p>
      ${tierSteps(sp, c.level)}
      <p><b>Synergy</b> (${esc(sp.synergy?.condition_text || '')}) ${syn === true ? '<span class="good">✓ you have it</span>' : syn === false ? '<span class="bad">✗ not yet</span>' : ''}:
        ${esc(sp.synergy?.effect || '')}</p>
      <p><b>Fallout</b> (Natural 1 at 3+ Surge): ${esc(sp.fallout || '')}</p>
      ${buttons.length ? `<div class="rf-buttons">${buttons.join('')}</div>` : ''}</details>`;
  }).join('');
  return `<section class="card wide"><h2>All ${D.specialties.length} Specialties</h2>
    <p class="hint">${esc(D.core.advancement.specialty_rule)}</p>${cards}</section>`;
}

function renderFeatList(D, c) {
  const ctx = R.requirementContext(D, c, c.level);
  const taken = new Map(Object.entries(c.feats).map(([lv, f]) => [f, Number(lv)]));
  const q = view.query.trim().toLowerCase();
  const domains = R.FEAT_GROUPS.map(g => g[0]);
  const list = D.feats.filter(f => (!view.domain || f.domain === view.domain) && (!view.kind || f.kind === view.kind)
    && (!q || f.name.toLowerCase().includes(q) || (f.text || '').toLowerCase().includes(q))
    && (!view.eligible || R.checkRequirements(f.requires, ctx).ok !== false))
    .sort((a, b) => domains.indexOf(a.domain) - domains.indexOf(b.domain) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const filters = `<div class="rf-filters">
    <input type="search" id="feat-search" data-rf-filter="query" value="${esc(view.query)}" placeholder="Search Feats by name or text…" aria-label="Search Feats">
    <select data-rf-filter="domain" aria-label="Domain">${options(R.FEAT_GROUPS.map(([value, label]) => ({ value, label })), view.domain, 'All groups')}</select>
    <select data-rf-filter="kind" aria-label="Stepped or Gated">${options([{ value: 'stepped', label: 'Stepped' }, { value: 'gated', label: 'Gated' }], view.kind, 'Stepped and Gated')}</select>
    <label class="check"><input type="checkbox" data-rf-filter="eligible"${view.eligible ? ' checked' : ''}> Only Feats I qualify for</label>
  </div>`;
  const cards = list.map(f => {
    const check = R.checkRequirements(f.requires, ctx);
    const at = taken.get(f.id);
    const slots = at ? [] : featSlotsFor(D, c, f);
    return `<details class="rf-card"${at ? ' open' : ''}><summary><b>${esc(f.name)}</b>
        <span class="hint">${cap(f.kind)} · ${esc(R.FEAT_GROUPS.find(g => g[0] === f.domain)[1])}</span>
        ${at ? `<span class="good">Taken at Level ${at}</span>` : `<span class="rf-mark">${mark(check)}</span>`}</summary>
      <p>${f.requires.length ? reqStatus(D, check) : '<span class="hint">No prerequisite.</span>'}
        ${f.prerequisite_text && f.prerequisite_text !== 'None' ? `<span class="hint">(${esc(f.prerequisite_text)})</span>` : ''}</p>
      <div class="info">${paragraphs(f.text || '')}</div>
      ${f.at_the_table ? `<p class="hint"><b>At the table:</b> ${esc(f.at_the_table)}</p>` : ''}
      ${f.steps.length ? tierSteps(f, c.level) : ''}
      ${slots.length ? `<div class="rf-buttons">${slots.map(lv => btn(`Take at Level ${lv}`, 'take-feat', `${lv}:${f.id}`)).join('')}</div>` : ''}
    </details>`;
  }).join('');
  return `<section class="card wide"><h2>Feats <span class="hint">${list.length} of ${D.feats.length}</span></h2>
    <p class="hint">Feats come at Levels ${D.core.advancement.feat_levels.join(', ')}. Stepped Feats fit any slot and grow by tier on their own.
      Gated Feats need their requirement and are available from Level ${D.core.advancement.gated_from_level}. ✓ / ✗ / ? are checked at your current level.</p>
    ${filters}${cards || '<p class="hint">No Feats match.</p>'}</section>`;
}

export function renderRoles(D, c) {
  const nav = `<nav class="subtabs card wide">${SECTIONS.map(([id, label]) =>
    `<button type="button" data-rf="section" data-arg="${id}"${view.section === id ? ' class="on"' : ''}>${label}</button>`).join('')}</nav>`;
  const body = { mine: renderMine, roles: renderRoleList, specialties: renderSpecialtyList, feats: renderFeatList }[view.section](D, c);
  return nav + body;
}
