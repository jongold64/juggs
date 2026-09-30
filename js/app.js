// Page code: loads the data, keeps the open character in `state`, and redraws every tab from it. Controls carry a
// data-bind path (e.g. "base.str", "skillPoints.5.2"); one change handler writes the value and calls update().
import { loadData } from './data.js';
import { newCharacter, clean } from './character.js';
import * as R from './rules.js';
import { $, esc, signed, paragraphs, options, groupedOptions, cap } from './dom.js';
import { openRoster, saveRoster, loadCharacter, saveCharacter, removeCharacter, newId, exportData, importData } from './storage.js';
import { renderSheet } from './sheet.js';
import { renderPowers, setDraft, toggleCondition, powerAction, resetDraft } from './tab-powers.js';
import { renderGear, gearAction } from './tab-gear.js';

const TABS = ['character', 'skills', 'roles', 'advancement', 'powers', 'gear', 'sheet'];
export const rollBtn = (what, bonus) =>
  `<button type="button" class="roll no-print" data-roll="${esc(what)}" data-bonus="${bonus}" aria-label="Roll ${esc(what)}">d20</button>`;
const LEVEL_MAPS = new Set(['skillPoints', 'feats', 'featChoices', 'roleAdvances', 'abilityIncreases']);

let D = null;
let state = null;
let roster = null;
let tab = 'character';

// ---------------------------------------------------------------------------------------------------------------
// Saving and loading
// ---------------------------------------------------------------------------------------------------------------

function label(c) {
  const role = D.rolesById.get(c.role)?.name;
  return c.name || (role ? `${role} ${c.level}` : `New character`);
}

function save() {
  saveCharacter(roster, roster.current, state, label(state));
}

function open(id) {
  roster.current = id;
  saveRoster(roster);
  state = clean(D, loadCharacter(id));
  resetDraft();
  render();
}

// ---------------------------------------------------------------------------------------------------------------
// Writing control values into the character
// ---------------------------------------------------------------------------------------------------------------

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (o[k] === undefined || o[k] === null) {
      const levelKeyed = i === 0 && LEVEL_MAPS.has(k);
      o[k] = !levelKeyed && /^\d+$/.test(keys[i + 1]) ? [] : {};
    }
    o = o[k];
  }
  o[keys[keys.length - 1]] = value;
}

function readValue(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.dataset.type === 'int') return el.value === '' ? null : parseInt(el.value, 10);
  return el.value;
}

function update() {
  state = clean(D, state);
  save();
  render();
}

function onChange(e) {
  const el = e.target;
  if (el.dataset.draft) {  // the Power being built (not saved until "Save to character")
    setDraft(D, el.dataset.draft, readValue(el));
    render();
  } else if (el.dataset.bind) {
    setPath(state, el.dataset.bind, readValue(el));
    update();
  } else if (el.dataset.toggle) {  // a checkbox list stored as an array of ids
    const list = new Set(getPath(state, el.dataset.toggle) || []);
    if (el.checked) list.add(el.value); else list.delete(el.value);
    setPath(state, el.dataset.toggle, [...list]);
    update();
  }
}

// Text boxes save as you type but only redraw when you leave them, so the cursor stays put.
function onInput(e) {
  const el = e.target;
  if (el.dataset.bind && (el.tagName === 'TEXTAREA' || el.type === 'text')) {
    setPath(state, el.dataset.bind, el.value);
    save();
  }
}

function onClick(e) {
  const b = e.target.closest('button, [data-box], [data-track]');
  if (!b) return;
  const d = b.dataset;
  if (d.tab) { tab = d.tab; render(); return; }
  if (d.draftCond) {
    toggleCondition(D, d.draftCond);
    render();
  } else if (d.power) {
    const list = powerAction(D, state, d.power, d.arg);
    if (list) { state.powers = list; update(); } else render();
  } else if (d.gear) {
    if (gearAction(D, state, d.gear, d.arg, id => $(id)?.value)) update();
  } else if (d.copy) {
    const text = $(d.copy)?.textContent || '';
    navigator.clipboard?.writeText(text).then(() => { b.textContent = 'Copied'; }, () => {});
  } else if (d.step) {  // +/- on a number
    const cur = Number(getPath(state, d.step)) || 0;
    setPath(state, d.step, cur + Number(d.by));
    update();
  } else if (d.preset) {
    applyPreset(d.preset);
  } else if (d.concept !== undefined) {
    state.concept = d.concept;
    update();
  } else if (d.box) {  // mark boxes on a pool
    const cur = state.play.marked[d.pool];
    const n = Number(d.box);
    state.play.marked[d.pool] = cur === n ? n - 1 : n;
    update();
  } else if (d.track) {
    const cur = state.play.trackers[d.track];
    const n = Number(d.val);
    state.play.trackers[d.track] = cur === n ? n - 1 : n;
    update();
  } else if (d.roll) {
    roll(d.roll, Number(d.bonus));
  }
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function applyPreset(id) {
  const p = D.presetsById.get(id);
  if (!p) return;
  state.role = p.role;
  state.aptitude = p.aptitude;
  state.specialties = [{ id: p.specialty, level: 1 }];
  state.focus = [...p.focus_skills];
  state.signature = { ...state.signature, offensive: p.signature_effect };
  state.powerSources = p.power_sources || [];
  update();
}

// ---------------------------------------------------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------------------------------------------------

let toastTimer = null;
function roll(what, bonus) {
  const die = 1 + Math.floor(Math.random() * 20);
  const tier = R.tierFor(D, state.level);
  const note = die === 1 ? ' — Bane (Natural 1)' : die >= tier.boon_threshold ? ' — Boon!' : '';
  const toast = $('roll-toast');
  toast.innerHTML = `<b>${esc(what)}</b>: d20 (${die}) ${signed(bonus)} = <b>${die + bonus}</b>${esc(note)}`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 6000);
}

// ---------------------------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------------------------

const abilityName = a => D.abilitiesById.get(a).name;
const skillName = s => D.skillsById.get(s)?.name || s;
const card = (title, body, cls = '') => `<section class="card ${cls}"><h2>${esc(title)}</h2>${body}</section>`;
const problems = list => (list.length ? `<ul class="problems">${list.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : '');

function reqText(clause) {
  if (clause.text) return clause.text;
  if (clause.ability) return `${clause.ability.map(abilityName).join(' or ')} ${clause.min}+`;
  if (clause.skill) return `${skillName(clause.skill)} rank ${clause.rank_min}+`;
  if (clause.focus) return `${clause.focus.map(skillName).join(clause.all ? ' and ' : ' or ')} as Focus Skill`;
  if (clause.role) return `${clause.role.map(r => D.rolesById.get(r).name).join(' or ')} Role Step ${clause.step}`;
  if (clause.feat) return clause.feat.map(f => D.featsById.get(f).name).join(' or ');
  if (clause.genre) return `${clause.genre.map(g => D.genresById.get(g).name).join(' or ')} Genre`;
  if (clause.power_level_min) return `Power Level ${clause.power_level_min}+`;
  if (clause.reputation_min) return `Reputation ${clause.reputation_min}+`;
  if (clause.specialty) return `${clause.specialty.map(s => D.specialtiesById.get(s)?.name || s).join(' or ')} Specialty`;
  if (clause.specialty_category) return `an active ${cap(clause.specialty_category)} Specialty`;
  if (clause.specialty_ability) return `a Specialty at ${clause.specialty_ability.replace('ability', 'Ability ')}`;
  if (clause.any) return clause.any.map(reqText).join(' or ');
  return JSON.stringify(clause);
}

// "✓ met" / "✗ Strength 3+" / "? check by hand: ..." for a list of requirements.
function reqStatus(check) {
  if (check.ok === true) return '<span class="good">✓ Requirements met</span>';
  const parts = [];
  if (check.failed.length) parts.push(`<span class="bad">✗ Needs ${esc(check.failed.map(reqText).join(', '))}</span>`);
  if (check.unknown.length) parts.push(`<span class="warn">? Check by hand: ${esc(check.unknown.map(reqText).join(', '))}</span>`);
  return parts.join(' ');
}

const mark = check => (check.ok === true ? '✓' : check.ok === false ? '✗' : '?');

// ---------------------------------------------------------------------------------------------------------------
// Character tab
// ---------------------------------------------------------------------------------------------------------------

function renderCharacter() {
  const c = state;
  const scores = R.abilityScores(D, c);
  const apt = R.aptitudeBonuses(D, c);
  const tier = R.tierFor(D, c.level);

  const genreBoxes = D.genres.map(g => `<label class="check"><input type="checkbox" data-toggle="genres" value="${g.id}"${
    c.genres.includes(g.id) ? ' checked' : ''}> ${esc(g.name)}</label>`).join('');
  const needs = D.genres.filter(g => c.genres.includes(g.id) && (g.requires || []).some(r => !c.genres.includes(r)))
    .map(g => `${g.name} needs ${g.requires.map(r => D.genresById.get(r).name).join(' and ')} switched on too.`);
  const campaign = card('Campaign', `
    <p class="hint">Genres are agreed at Session Zero. Each one adds its skills; Magic, Psionics and Weird Magic
      unlock their Roles.</p>
    <div class="genre-grid">${genreBoxes}</div>${problems(needs)}
    <label class="row">Level <select data-bind="level" data-type="int">${options(
      Array.from({ length: 20 }, (_, i) => ({ value: i + 1, label: `${i + 1} (${R.tierFor(D, i + 1).name})` })), c.level)}</select></label>
    <p class="hint">${esc(tier.name)}: ${tier.actions} Action / ${tier.reactions} Reaction, Boon on ${
      tier.boon_threshold === 20 ? 'a natural 20' : `${tier.boon_threshold}–20`}, Surge up to ${tier.surge_max}.</p>`, 'wide');

  const role = D.rolesById.get(c.role);
  const concepts = role ? (D.conceptsById.get(role.id)?.concepts || []) : [];
  const identity = card('Who are you?', `
    <label class="field">Character name <input type="text" data-bind="name" value="${esc(c.name)}" maxlength="60"></label>
    <label class="field">Player <input type="text" data-bind="player" value="${esc(c.player)}" maxlength="60"></label>
    <label class="field">Concept (one sentence)
      <textarea data-bind="concept" rows="2" maxlength="300">${esc(c.concept)}</textarea></label>
    ${concepts.length ? `<details><summary>Ideas for a ${esc(role.name)}</summary><ul class="ideas">${concepts.map(x =>
      `<li><button type="button" class="link" data-concept="${esc(x.text)}">Use</button> <i>${esc(x.setting)}</i>: ${
        esc(x.text)}</li>`).join('')}</ul></details>` : ''}`);

  // Aptitude and Origin
  const aptGroups = [...new Set(D.aptitudes.map(a => a.category))].map(cat =>
    [cat, D.aptitudes.filter(a => a.category === cat).map(a => ({ value: a.id, label: a.name }))]);
  const aptRec = D.aptitudesById.get(c.aptitude);
  let aptInfo = '';
  if (aptRec) {
    const pick = Array.isArray(aptRec.bonus_skills) ? '' : [0, 1].map(i => `<select data-bind="aptitudeSkills.${i}">${
      options(R.availableSkills(D, c).map(s => ({ value: s.id, label: s.name })), c.aptitudeSkills[i] || '', 'Pick a skill…')}</select>`).join('');
    aptInfo = `<div class="info">
      <p><b>+1</b> ${Object.keys(aptRec.ability_bonuses).map(abilityName).join(', ')} ·
        <b>Bonus Focus Skills:</b> ${Array.isArray(aptRec.bonus_skills) ? aptRec.bonus_skills.map(skillName).join(', ') : 'any two'}
        · <b>Starting Wealth:</b> Tier ${aptRec.starting_wealth}</p>${pick}
      <p><b>Signature Ability.</b> ${esc(aptRec.signature_ability)}</p>
      <p class="hint">${esc(aptRec.description)}</p></div>`;
  }
  const origin = D.originsById.get(c.origin);
  let originInfo = '';
  if (origin) {
    const choice = origin.choice;
    originInfo = `<div class="info">
      <p>${origin.trait ? esc(origin.trait) : '<span class="warn">Trait to be decided.</span>'}</p>
      ${choice?.options ? `<label class="row">${esc(choice.name)} <select data-bind="originChoice">${options(
        choice.options.map(o => ({ value: o, label: cap(o) })), c.originChoice, 'Choose…')}</select></label>`
        : choice ? `<label class="field">${esc(choice.name)} <input type="text" data-bind="originChoice" value="${esc(c.originChoice)}"></label>` : ''}
      <p class="hint">${esc(origin.notes || '')} (${esc(origin.analogs.join(', '))})</p></div>`;
  }
  const background = card('Aptitude and Origin', `
    <label class="field">Aptitude (optional) <select data-bind="aptitude">${groupedOptions(aptGroups, c.aptitude, 'None')}</select></label>
    ${aptInfo}
    <label class="field">Origin (optional) <select data-bind="origin">${groupedOptions([
      ['Lineage', D.origins.filter(o => o.kind === 'lineage').map(o => ({ value: o.id, label: o.name }))],
      ['Circumstance', D.origins.filter(o => o.kind === 'circumstance').map(o => ({ value: o.id, label: o.name }))],
    ], c.origin, 'None')}</select></label>${originInfo}`);

  // Ability Scores
  const spent = R.bpSpent(c.base);
  const rows = R.DOMAINS.map(dom => {
    const domain = D.domainsById.get(dom);
    return `<tr class="domain-row"><th colspan="7">${esc(domain.name)} <span class="hint">· ${esc(cap(domain.pool))}</span></th></tr>` +
      domain.abilities.map(a => {
        const ab = D.abilitiesById.get(a);
        const item = R.enhancements(c)[`ability:${a}`] || 0;
        const levelUps = scores[a] - c.base[a] - (apt[a] || 0) - item;
        return `<tr><td class="left">${esc(ab.name)} <span class="hint">${cap(ab.slot)}</span></td>
          <td class="stepper"><button type="button" data-step="base.${a}" data-by="-1" aria-label="Lower ${esc(ab.name)}">−</button>
            <b>${c.base[a]}</b>
            <button type="button" data-step="base.${a}" data-by="1" aria-label="Raise ${esc(ab.name)}">+</button></td>
          <td>${apt[a] ? '+1' : ''}</td><td>${levelUps ? signed(levelUps) : ''}</td><td>${item ? signed(item) : ''}</td>
          <td><b>${scores[a]}</b></td><td class="hint">${R.abilityCap(D, c, a)}</td></tr>`;
      }).join('');
  }).join('');
  const top = R.topDomains(c.base);
  const mastery = R.domainMastery(D, scores);
  const abilities = card('Ability Scores', `
    <p class="points${spent !== D.core.creation.build_points ? ' over' : ''}">Build Points: ${spent} / ${D.core.creation.build_points}</p>
    <table class="abilities"><thead><tr><th class="left">Score</th><th>BP</th><th>Apt</th><th>Levels</th><th>Items</th><th>Total</th><th>Cap</th></tr></thead>
    <tbody>${rows}</tbody></table>
    ${problems([...R.creationProblems(D, c), ...R.increaseProblems(D, c)])}
    <label class="row">Primary Domain ${top.length > 1
      ? `<select data-bind="primaryDomain">${options(top.map(d => ({ value: d, label: cap(d) })), R.primaryDomain(c))}</select>
         <span class="hint">(tied — your choice)</span>`
      : `<b>${cap(top[0])}</b>`}</label>
    <label class="row">Governing Ability <select data-bind="governing">${options(
      R.ABILITIES.map(a => ({ value: a, label: abilityName(a) })), c.governing, 'Choose…')}</select></label>
    <p class="hint">The governing Ability's cap rises each tier (5 → 13); every other Score stops at 5.</p>
    <p>Domain Mastery: ${R.DOMAINS.map(d => `${cap(d)} ${signed(mastery[d])}`).join(' · ')}</p>`);

  // Role, Specialty, Signature Effects, Power Sources, Wealth
  const roleCtx = R.requirementContext(D, c, 1);
  const roleGroups = [...new Set(D.roles.map(r => r.category))].map(cat => [cap(cat), D.roles.filter(r => r.category === cat)
    .map(r => ({ value: r.id, label: `${mark(R.checkRequirements(r.requires, roleCtx))} ${r.name}` }))]);
  const roleInfo = role ? `<div class="info"><p><b>Step 1.</b> ${esc(role.steps[0].text)}</p>
    <p>${reqStatus(R.checkRequirements(role.requires, roleCtx))}</p>
    ${role.prerequisite_text && role.prerequisite_text !== 'No prerequisite' ? `<p class="hint">Prerequisite: ${esc(role.prerequisite_text)}</p>` : ''}
    <p class="hint">${esc(role.summary)}</p>
    ${D.presetsById.has(role.id) ? `<button type="button" data-preset="${role.id}">Use the Suggested Build</button>
      <span class="hint">Sets Aptitude, Specialty, Focus Skills, Signature Effect and Power Source.</span>` : ''}</div>` : '';

  const specOpts = [...new Set(D.specialties.map(s => s.category))].map(cat => [cap(cat), D.specialties
    .filter(s => s.category === cat).map(s => ({ value: s.id, label: s.name }))]);
  const spec1 = c.specialties[0];
  const spec2 = c.specialties[1];
  const specInfo = s => {
    const sp = D.specialtiesById.get(s?.id);
    return sp ? `<div class="info"><p><b>Ability 1.</b> ${esc(sp.abilities.ability1.text)}</p>
      <p class="hint">Bonus Focus Skills: ${sp.bonus_skills.map(skillName).join(', ')} · ${esc(sp.summary || '')}</p></div>` : '';
  };
  const second = c.level >= D.core.advancement.second_specialty_level ? `
    <label class="field">Second Specialty (from Level ${D.core.advancement.second_specialty_level})
      <select data-bind="specialties.1.id">${groupedOptions(specOpts, spec2?.id || '', 'None')}</select></label>
    ${spec2 ? `<label class="row">Taken at level <select data-bind="specialties.1.level" data-type="int">${options(
      Array.from({ length: c.level - 4 }, (_, i) => ({ value: i + 5, label: String(i + 5) })), spec2.level)}</select></label>` : ''}
    ${specInfo(spec2)}` : '';

  const effectOpts = D.effects.map(e => ({ value: e.id, label: e.name }));
  const autoSources = R.powerSources(D, { ...c, powerSources: [] });
  const sourceBoxes = D.powers.sources.filter(s => !s.universal).map(s => {
    const auto = autoSources.includes(s.id);
    return `<label class="check"><input type="checkbox" data-toggle="powerSources" value="${s.id}"${
      auto || c.powerSources.includes(s.id) ? ' checked' : ''}${auto ? ' disabled' : ''}> ${esc(s.name)}${auto ? ' <span class="hint">(from Focus Skills)</span>' : ''}</label>`;
  }).join('');

  const wealth = c.wealth ?? R.startingWealth(D, c);
  const doing = card('What can you do?', `
    <label class="field">Starting Role <select data-bind="role">${groupedOptions(roleGroups, c.role, 'Choose a Role…')}</select></label>
    ${roleInfo}
    <label class="field">Specialty (optional) <select data-bind="specialties.0.id">${groupedOptions(specOpts, spec1?.id || '', 'None')}</select></label>
    ${specInfo(spec1)}${second}
    <div class="two-col">
      <label class="field">Signature Effect <select data-bind="signature.offensive">${options(effectOpts, c.signature.offensive, 'None')}</select></label>
      <label class="field">Defensive / utility <select data-bind="signature.utility">${options(effectOpts, c.signature.utility, 'None')}</select></label>
    </div>
    <p class="hint">Any other Effect is −1 to the roll.</p>
    <p><b>Power Sources</b> <span class="hint">Physical always applies.</span></p><div class="genre-grid">${sourceBoxes}</div>`, 'wide');

  const standing = card('Final details', `
    <div class="two-col">
      <label class="field">Wealth Tier <select data-bind="wealth" data-type="int">${options(D.core.wealth_tiers.map(w =>
        ({ value: w.tier, label: `${w.tier} · ${w.name}` })), wealth)}</select></label>
      <label class="field">Reputation <select data-bind="reputation" data-type="int">${options(
        [0, 1, 2, 3, 4, 5].map(n => ({ value: n, label: String(n) })), R.reputation(D, c))}</select></label>
    </div>
    <p class="hint">${esc(D.core.wealth_tiers[wealth - 1].gear_ceiling)} · Cash on Hand ${esc(D.core.wealth_tiers[wealth - 1].cash_on_hand)}</p>
    <label class="field">Languages <span class="hint">(${D.core.creation.extra_languages} extra at creation)</span>
      <input type="text" data-bind="languages" value="${esc(c.languages)}"></label>
    <label class="field">Gear <textarea data-bind="gear" rows="3">${esc(c.gear)}</textarea></label>
    <label class="field">Notes, bonds and story hooks <textarea data-bind="notes" rows="3">${esc(c.notes)}</textarea></label>`);

  return campaign + identity + background + abilities + doing + standing;
}

// ---------------------------------------------------------------------------------------------------------------
// Skills tab
// ---------------------------------------------------------------------------------------------------------------

function renderSkills() {
  const c = state;
  const skills = R.availableSkills(D, c);
  const skillOpts = skills.map(s => ({ value: s.id, label: s.name }));
  const { focus, overlaps } = R.focusInfo(D, c);
  const chosen = Array.from({ length: D.core.creation.focus_skills }, (_, i) =>
    `<select data-bind="focus.${i}">${options(skillOpts.map(o => ({ ...o,
      disabled: c.focus.includes(o.value) && c.focus[i] !== o.value })), c.focus[i] || '', 'Pick a Focus Skill…')}</select>`).join('');
  const bonus = R.bonusSkills(D, c);
  const overlapRows = overlaps.map((o, i) => `<label class="row">${esc(skillName(o.skill))} (from ${esc(o.from)}) is already a
    Focus Skill — +1 to <select data-bind="overlapPicks.${i}">${options(skillOpts.filter(s => !focus.has(s.value)),
    c.overlapPicks[i] || '', 'Pick a skill…')}</select></label>`).join('');
  const picks = card('Focus Skills', `
    <p class="hint">Choose ${D.core.creation.focus_skills}. Focus Skills start at rank ${D.core.creation.focus_skill_start},
      every other skill at ${D.core.creation.other_skill_start}, and Focus Skills cap one rank higher.</p>
    <div class="focus-grid">${chosen}</div>
    ${bonus.length ? `<p><b>Bonus Focus Skills:</b> ${bonus.map(b => `${esc(skillName(b.skill))} <span class="hint">(${esc(b.from)})</span>`).join(', ')}</p>` : ''}
    ${overlapRows}`, 'wide');

  const scores = R.abilityScores(D, c);
  const byCat = ['body', 'mind', 'spirit', 'social'].map(cat => [cat, skills.filter(s => s.category === cat)]);
  const table = byCat.filter(([, list]) => list.length).map(([cat, list]) => `
    <tr class="domain-row"><th colspan="6">${cap(cat)}</th></tr>` + list.map(s => {
      const rank = R.skillRank(D, c, s.id);
      const ab = R.skillAbility(D, c, s.id, scores);
      return `<tr${focus.has(s.id) ? ' class="focus"' : ''}><td class="left">${focus.has(s.id) ? '★ ' : ''}${esc(s.name)}${
        s.genres.length ? ` <span class="hint">${esc(s.genres.map(g => D.genresById.get(g).name).join(', '))}</span>` : ''}</td>
        <td>${ab ? esc(abilityName(ab)) : ''}</td><td>${rank}</td><td class="hint">${R.skillCap(D, c, s.id)}</td>
        <td><b>${ab ? signed(R.skillTotal(D, c, s.id)) : ''}</b></td><td class="hint">${R.skillMastery(rank) ? `DC −${R.skillMastery(rank)}` : ''}</td></tr>`;
    }).join('')).join('');
  const list = card('Skills', `
    <p class="hint">Total = Ability Score + rank + Domain Mastery. Skill Mastery lowers fixed task DCs. Spend skill points
      on the Advancement tab.</p>
    <div class="table-wrap"><table class="skills"><thead><tr><th class="left">Skill</th><th>Ability</th><th>Rank</th><th>Cap</th>
      <th>Total</th><th>Mastery</th></tr></thead><tbody>${table}</tbody></table></div>
    ${problems(R.skillPointProblems(D, c))}`, 'wide');
  return picks + list;
}

// ---------------------------------------------------------------------------------------------------------------
// Roles & Feats tab
// ---------------------------------------------------------------------------------------------------------------

function renderRoles() {
  const c = state;
  const steps = R.roleSteps(D, c);
  const roles = Object.entries(steps).map(([id, n]) => {
    const role = D.rolesById.get(id);
    return `<h3>${esc(role.name)} <span class="hint">Step ${n} of 5</span></h3><ol class="steps">${role.steps.map(s =>
      `<li class="${s.step <= n ? '' : 'locked'}"><b>Step ${s.step}</b> <span class="hint">(${s.step === 1 ? 'Level 1' : `tier change`})</span> ${esc(s.text)}</li>`).join('')}</ol>`;
  }).join('') || '<p class="hint">Choose a starting Role on the Character tab.</p>';

  const unlocked = R.specialtyAbilities(D, c);
  const specs = R.specialtiesHeld(D, c).map(sp => {
    const have = unlocked[sp.id] || [];
    const row = (key, title) => `<li class="${have.includes(key) ? '' : 'locked'}"><b>${title}</b> ${esc(sp.abilities[key].text)}</li>`;
    return `<h3>${esc(sp.name)} <span class="hint">${esc(cap(sp.category))} · ${sp.governing.map(abilityName).join(' or ')} · ${cap(sp.pool)}</span></h3>
      <ul class="steps">${row('ability1', 'Ability 1')}${row('ability2', 'Ability 2')}${row('ability3', 'Ability 3')}${row('mastery', 'Mastery Enhancement')}</ul>
      <p class="hint">Synergy (${esc(sp.synergy?.condition_text || '')}): ${esc(sp.synergy?.effect || '')}. Fallout: ${esc(sp.fallout || '')}</p>`;
  }).join('') || '<p class="hint">No Specialty.</p>';

  const feats = R.levelsUpTo(D.core.advancement.feat_levels, c.level).map(lv => {
    const f = D.featsById.get(c.feats[lv]);
    return `<li><b>Level ${lv}</b> ${f ? `${esc(f.name)} <span class="hint">Rank ${esc(f.rank)}</span><div class="info">${paragraphs(f.text)}</div>`
      : '<span class="hint">not chosen — see Advancement</span>'}</li>`;
  }).join('');
  return card('Roles', roles, 'wide') + card('Specialties', specs, 'wide') + card('Feats', `<ul class="feat-list">${feats}</ul>`, 'wide');
}

// ---------------------------------------------------------------------------------------------------------------
// Advancement tab
// ---------------------------------------------------------------------------------------------------------------

function featOptions(level) {
  const c = state;
  const ctx = R.requirementContext(D, c, level);
  const taken = new Set(Object.entries(c.feats).filter(([lv]) => Number(lv) !== level).map(([, f]) => f));
  const eligible = D.feats.filter(f => R.slotAccepts(D, level, f) && (!taken.has(f.id) || f.repeatable)
    && !(level === 1 && f.unlocks) && !(f.available_from_level > level));
  const groups = ['universal', 'body', 'mind', 'spirit', 'social', 'any'].map(dom => [dom === 'any' ? 'Specialty' : cap(dom),
    eligible.filter(f => f.domain === dom).sort((a, b) => a.rank.localeCompare(b.rank))
      .map(f => {
        const check = R.checkRequirements(f.requires, ctx);
        return { value: f.id, label: `${mark(check)} ${f.name} (Rank ${f.rank})`, disabled: check.ok === false && c.feats[level] !== f.id };
      })]);
  return groups;
}

function levelCard(level) {
  const c = state;
  const tier = R.tierFor(D, level);
  const parts = [];
  if (R.isTierChange(D, level)) {
    const ctx = R.requirementContext(D, c, level);
    const before = R.roleSteps(D, c, level - 1);
    const opts = D.roles.map(r => {
      const held = before[r.id] || 0;
      const check = held ? { ok: true } : R.checkRequirements(r.requires, ctx);
      return { value: r.id, label: held ? `Advance ${r.name} to Step ${held + 1}` : `${mark(check)} Begin ${r.name} (Step 1)`,
               disabled: held >= 5 || (check.ok === false && c.roleAdvances[level] !== r.id) };
    });
    const pick = D.rolesById.get(c.roleAdvances[level]);
    const step = pick ? R.roleSteps(D, c, level)[pick.id] : 0;
    parts.push(`<label class="field">Role advancement <select data-bind="roleAdvances.${level}">${options(opts, c.roleAdvances[level] || '', 'Choose…')}</select></label>
      ${pick ? `<p class="info">${esc(pick.steps[step - 1].text)}</p>` : ''}`);
  }
  if (R.isAbilityLevel(D, level)) {
    parts.push(`<label class="field">+1 Ability Score <select data-bind="abilityIncreases.${level}">${options(
      R.ABILITIES.map(a => ({ value: a, label: `${abilityName(a)} (cap ${R.abilityCap(D, c, a, level)})` })), c.abilityIncreases[level] || '', 'Choose…')}</select></label>`);
  }
  const points = R.skillPointsAt(D, level);
  if (points) {
    const skillOpts = R.availableSkills(D, c).map(s => ({ value: s.id, label: s.name }));
    const list = c.skillPoints[level] || [];
    parts.push(`<p><b>${points} skill points</b> <span class="hint">each to a different skill; caps: Focus ${tier.focus_skill_cap}, other ${tier.other_skill_cap}</span></p>
      <div class="focus-grid">${Array.from({ length: points }, (_, i) => `<select data-bind="skillPoints.${level}.${i}">${options(
        skillOpts.map(o => ({ ...o, label: `${o.label} (${R.skillRank(D, c, o.value, level - 1)})`,
          disabled: list.includes(o.value) && list[i] !== o.value })), list[i] || '', '—')}</select>`).join('')}</div>`);
  }
  if (R.isFeatLevel(D, level)) {
    const f = D.featsById.get(c.feats[level]);
    const check = f ? R.checkRequirements(f.requires, R.requirementContext(D, c, level)) : null;
    const specChoice = f?.unlocks ? `<label class="row">Specialty <select data-bind="featChoices.${level}">${options(
      R.specialtiesHeld(D, c, level).map(s => ({ value: s.id, label: s.name })), c.featChoices[level] || '', 'Choose…')}</select></label>` : '';
    parts.push(`<label class="field">Feat <span class="hint">(Rank ${R.slotRank(D, level)} or lower)</span>
      <select data-bind="feats.${level}">${groupedOptions(featOptions(level), c.feats[level] || '', 'Choose a Feat…')}</select></label>
      ${specChoice}
      ${f ? `<div class="info"><p>${reqStatus(check)}</p>${paragraphs(f.text)}${f.at_the_table ? `<p class="hint">At the table: ${esc(f.at_the_table)}</p>` : ''}</div>` : ''}`);
  }
  const gains = [];
  if (D.core.advancement.pool_increase_levels.includes(level)) gains.push('+1 to all three pools');
  if (R.isTierChange(D, level)) gains.push(`${tier.name}: ${tier.actions} Actions / ${tier.reactions} Reactions, Boon on ${tier.boon_threshold}–20`);
  return `<section class="card wide level-card"><h2>Level ${level} <span class="hint">${esc(tier.name)}</span></h2>
    ${gains.length ? `<p class="gain">${esc(gains.join(' · '))}</p>` : ''}${parts.join('')}</section>`;
}

function renderAdvancement() {
  const levels = Array.from({ length: state.level }, (_, i) => i + 1)
    .filter(lv => lv > 1 || R.isFeatLevel(D, 1));
  return card('Advancement', `<p class="hint">Everything a level grants, level by level. Set the character's level on the
    Character tab. ✓ requirements met · ✗ not met · ? written in words, check by hand.</p>
    ${problems([...R.skillPointProblems(D, state), ...R.increaseProblems(D, state)])}`, 'wide')
    + levels.map(levelCard).join('');
}

// ---------------------------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------------------------

function render() {
  const c = state;
  const tier = R.tierFor(D, c.level);
  const role = D.rolesById.get(c.role);
  $('subtitle').textContent = `${label(c)} · Level ${c.level} ${tier.name}${role ? ` · ${role.name}` : ''}`;
  $('char-select').innerHTML = roster.characters.map(x => `<option value="${esc(x.id)}"${x.id === roster.current ? ' selected' : ''}>${
    esc(x.label || 'New character')}</option>`).join('');
  for (const b of document.querySelectorAll('.tabs [data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  for (const t of TABS) $(`tab-${t}`).hidden = t !== tab;
  const panel = $(`tab-${tab}`);
  const scroll = window.scrollY;
  panel.innerHTML = { character: renderCharacter, skills: renderSkills, roles: renderRoles, advancement: renderAdvancement,
                      powers: () => renderPowers(D, c), gear: () => renderGear(D, c, rollBtn),
                      sheet: () => renderSheet(D, c) }[tab]();
  window.scrollTo(0, scroll);
}

// ---------------------------------------------------------------------------------------------------------------
// Character bar
// ---------------------------------------------------------------------------------------------------------------

function initBar() {
  $('char-select').addEventListener('change', e => open(e.target.value));
  $('char-new').addEventListener('click', () => {
    const id = newId();
    roster.characters.push({ id, label: '' });
    saveCharacter(roster, id, newCharacter(), '');
    tab = 'character';
    open(id);
  });
  $('char-copy').addEventListener('click', () => {
    const id = newId();
    const copy = { ...structuredClone(state), name: state.name ? `${state.name} (copy)` : '' };
    roster.characters.push({ id, label: '' });
    saveCharacter(roster, id, copy, label(copy));
    open(id);
  });
  $('char-delete').addEventListener('click', () => {
    if (!confirm(`Delete ${label(state)}? This cannot be undone.`)) return;
    removeCharacter(roster, roster.current);
    roster = openRoster();
    open(roster.current);
  });
  $('char-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(exportData(state), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(label(state)).replace(/[^\w -]+/g, '').trim() || 'character'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('char-import').addEventListener('click', () => $('char-file').click());
  $('char-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let character = null;
    try { character = importData(JSON.parse(await file.text())); } catch { /* not JSON */ }
    if (!character) { alert('That file is not a saved JUGGS character.'); return; }
    const id = newId();
    const c = clean(D, character);
    roster.characters.push({ id, label: '' });
    saveCharacter(roster, id, c, label(c));
    open(id);
  });
  $('char-print').addEventListener('click', () => {
    tab = 'sheet';
    render();
    window.print();
  });
}

async function main() {
  try {
    D = await loadData();
  } catch (err) {
    $('loading').textContent = `Could not load the rules data: ${err.message}. Open the page through the local server (see README).`;
    return;
  }
  roster = openRoster();
  state = clean(D, loadCharacter(roster.current));
  initBar();
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('click', onClick);
  $('loading').hidden = true;
  $('app').hidden = false;
  const hash = location.hash.slice(1);  // index.html#sheet opens that tab
  if (TABS.includes(hash)) tab = hash;
  render();
}

main();
