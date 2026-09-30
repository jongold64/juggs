// The Gear tab: weapons, implements, armor and shield, and items (template + Rating + descriptors).
import * as R from './rules.js';
import { newItem, cleanItem, itemTargets } from './character.js';
import { esc, signed, options, groupedOptions, cap } from './dom.js';

const qualityByBonus = (D, bonus) => D.gear.quality.find(q => q.weapon_bonus === bonus)?.id || 'standard';

// The genre a universal item is named for: the first of the campaign's Genres the item has a name in.
function localName(D, c, item) {
  const g = c.genres.find(x => item.names[x]) || 'fantasy';
  return { genre: g, name: item.names[g] || item.name };
}

// "+2 Combat (Melee). ..." -> { rating: 2, appliesTo: 'skill:combat-melee' } when the text names a skill, an
// Ability Score, Attack, Defend or Deflect. Otherwise just the Rating.
function readBonus(D, text) {
  const m = /^\+(\d) (?:to )?([A-Z][\w ()]*?)(?= for| rolls|\.|,| —|$)/.exec(text || '');
  if (!m) return {};
  const target = m[2].trim().toLowerCase();
  const skill = D.skills.find(s => s.name.toLowerCase() === target);
  const ability = D.abilities.abilities.find(a => a.name.toLowerCase() === target);
  const appliesTo = skill ? `skill:${skill.id}` : ability ? `ability:${ability.id}`
    : ['attack', 'defend', 'deflect'].includes(target) ? target : '';
  return { rating: Number(m[1]), appliesTo };
}

// A button in this tab. `pick(id)` reads a picker's current value. Returns true if the character changed.
export function gearAction(D, c, action, arg, pick) {
  const n = Number(arg);
  switch (action) {
    case 'add-weapon': {
      const [kind, id] = (pick('weapon-pick') || '').split(':');
      if (!id) return false;
      const w = kind === 'general' ? D.gear.weapons.find(x => x.id === id) : D.gear.period_equipment.find(x => x.id === id);
      const ranged = kind === 'general' ? /Near|Far|Distant/.test(w.range) && !/^Close/.test(w.range) : w.kind === 'ranged';
      c.weapons.push({ name: w.name, quality: w.quality || qualityByBonus(D, w.bonus), kind: ranged ? 'ranged' : 'melee',
                       effect: '', notes: w.text || w.properties || '' });
      return true;
    }
    case 'custom-weapon': c.weapons.push({ name: 'New weapon', quality: 'standard', kind: 'melee', effect: '', notes: '' }); return true;
    case 'remove-weapon': c.weapons.splice(n, 1); return true;
    case 'add-implement': c.implements.push({ name: 'Focus', quality: 'standard', notes: '' }); return true;
    case 'remove-implement': c.implements.splice(n, 1); return true;
    case 'add-universal': {
      const u = D.items.universal_items.find(x => x.id === pick('universal-pick'));
      if (!u) return false;
      const local = localName(D, c, u);
      c.items.push(cleanItem(D, { ...newItem(), name: local.name, genre: local.genre, template: u.template,
                                  appliesTo: u.id === 'improve-a-weapon' ? 'attack' : '',
                                  notes: `${u.name}. ${u.rating_text}` }));
      return true;
    }
    case 'add-genre-item': {
      const g = D.items.genre_items.find(x => x.id === pick('genre-item-pick'));
      if (!g) return false;
      c.items.push(cleanItem(D, { ...newItem(), name: g.name, genre: g.genre, template: g.template, notes: g.text,
                                  ...readBonus(D, g.text) }));
      return true;
    }
    case 'custom-item': c.items.push(newItem()); return true;
    case 'remove-item': c.items.splice(n, 1); return true;
    default: return false;
  }
}

// ---------------------------------------------------------------------------------------------------------------

export function renderGear(D, c, rollBtn) {
  const wealth = c.wealth ?? R.startingWealth(D, c);
  const tier = D.core.wealth_tiers[wealth - 1];
  const qualityOpts = D.gear.quality.map(q => ({ value: q.id, label: `${q.name} (${signed(q.weapon_bonus)})` }));
  const effectOpts = D.effects.map(e => ({ value: e.id, label: e.name }));
  const overWarn = q => (R.overWealth(D, c, q)
    ? `<span class="warn">Above your Wealth ceiling — needs a story reason or a Wealth check.</span>` : '');

  const wealthCard = `<section class="card wide"><h2>Wealth</h2>
    <p>Tier ${wealth} · <b>${esc(tier.name)}</b> · Gear ceiling: ${esc(tier.gear_ceiling)} · Cash on Hand ${esc(tier.cash_on_hand)}</p>
    <p class="hint">Change the Wealth Tier on the Character tab. ${esc(D.gear.rules.weapons)}</p></section>`;

  // Weapons
  const pickWeapon = groupedOptions([
    ['General', D.gear.weapons.map(w => ({ value: `general:${w.id}`, label: `${w.name} (${signed(w.bonus)})` }))],
    ['Early Modern — melee', D.gear.period_equipment.filter(p => p.kind === 'melee').map(p => ({ value: `period:${p.id}`, label: `${p.name} (${signed(p.bonus)})` }))],
    ['Early Modern — ranged', D.gear.period_equipment.filter(p => p.kind === 'ranged').map(p => ({ value: `period:${p.id}`, label: `${p.name} (${signed(p.bonus)})` }))],
  ], '', 'Choose a weapon…');
  const weaponRows = c.weapons.map((w, i) => {
    const atk = R.weaponAttack(D, c, w);
    return `<div class="gear-row">
      <div class="gear-main">
        <input type="text" data-bind="weapons.${i}.name" value="${esc(w.name)}" aria-label="Weapon name">
        <select data-bind="weapons.${i}.quality" aria-label="Quality">${options(qualityOpts, w.quality)}</select>
        <select data-bind="weapons.${i}.kind" aria-label="Melee or ranged">${options([{ value: 'melee', label: 'Melee' }, { value: 'ranged', label: 'Ranged' }], w.kind)}</select>
        <select data-bind="weapons.${i}.effect" aria-label="Effect">${options(effectOpts, w.effect, 'No Effect')}</select>
      </div>
      <div class="gear-result"><b>Attack ${signed(atk.total)}</b> ${rollBtn(`${w.name} attack`, atk.total)}
        <span class="hint">${esc(D.abilitiesById.get(atk.ability).name)} + ${esc(D.skillsById.get(atk.skill).name)} + quality${
          w.effect && w.effect !== c.signature.offensive ? ' · non-Signature Effect: −1' : ''}</span> ${overWarn(w.quality)}
        <button type="button" class="tiny" data-gear="remove-weapon" data-arg="${i}">Remove</button></div>
      ${w.notes ? `<p class="hint">${esc(w.notes)}</p>` : ''}</div>`;
  }).join('');
  const weapons = `<section class="card wide"><h2>Weapons</h2>
    <div class="row"><select id="weapon-pick">${pickWeapon}</select>
      <button type="button" data-gear="add-weapon">Add</button><button type="button" data-gear="custom-weapon">Add your own</button></div>
    ${weaponRows || '<p class="hint">Unarmed attacks are +0 and always available.</p>'}</section>`;

  // Implements
  const implRows = c.implements.map((m, i) => {
    const cast = R.basicCast(D, c, m);
    return `<div class="gear-row"><div class="gear-main">
        <input type="text" data-bind="implements.${i}.name" value="${esc(m.name)}" aria-label="Implement name">
        <select data-bind="implements.${i}.quality" aria-label="Quality">${options(qualityOpts, m.quality)}</select></div>
      <div class="gear-result"><b>Basic Cast ${signed(cast.total)}</b> ${rollBtn(`Basic Cast (${m.name})`, cast.total)}
        <span class="hint">${esc(D.abilitiesById.get(cast.ability).name)} + ${esc(D.skillsById.get(cast.skill).name)} + quality</span>
        ${overWarn(m.quality)} <button type="button" class="tiny" data-gear="remove-implement" data-arg="${i}">Remove</button></div></div>`;
  }).join('');
  const implementsCard = `<section class="card wide"><h2>Implements <span class="hint">wand, staff, holy symbol, focus stone</span></h2>
    <p class="hint">Same quality ladder as weapons. Unfocused casting is +0.</p>
    ${implRows}<button type="button" data-gear="add-implement">Add an implement</button></section>`;

  // Armor and shield
  const info = R.armorInfo(D, c);
  const armorCard = `<section class="card wide"><h2>Armor &amp; Shield</h2>
    <div class="two-col">
      <label class="field">Armor <select data-bind="armor">${options(D.gear.armor.filter(a => a.id !== 'no-armor').map(a => ({ value: a.id,
        label: `${a.name} (DR ${a.dr}${a.agility_penalty ? `, Agility ${a.agility_penalty}` : ''}, TL ${a.tech_level})` })), c.armor, 'None')}</select></label>
      <label class="field">Shield <select data-bind="shield">${options(D.gear.shields.map(s => ({ value: s.id,
        label: `${s.name} (DR ${s.dr}, TL ${s.tech_level})` })), c.shield, 'None')}</select></label>
    </div>
    <p><b>DR ${info.dr}</b> ${info.parts.length ? `<span class="hint">(${info.parts.map(([n, v]) => `${esc(n)} ${v}`).join(' + ')})</span>` : ''}
      ${info.agilityPenalty ? ` · <b>Agility rolls ${info.agilityPenalty}</b>` : ''}</p>
    <p class="hint">${esc(D.gear.rules.armor)} ${info.armor?.notes ? esc(info.armor.notes) : ''} ${info.shield?.benefit ? esc(info.shield.benefit) : ''}</p>
  </section>`;

  // Items
  const templates = D.items.templates;
  const universal = D.items.universal_items.map(u => ({ value: u.id, label: `${u.name} — ${localName(D, c, u).name} (${cap(u.template)})` }));
  const shownGenres = c.genres.length ? c.genres : D.genres.map(g => g.id);
  const genreGroups = D.genres.filter(g => shownGenres.includes(g.id)).map(g => [g.name, D.items.genre_items
    .filter(x => x.genre === g.id).map(x => ({ value: x.id, label: `${x.name} (${cap(x.template)})` }))]);
  const targets = itemTargets(D);
  const itemRows = c.items.map((it, i) => {
    const t = templates.find(x => x.id === it.template);
    const value = t.has_rating ? t.rating_values?.[it.rating] : null;
    return `<div class="gear-row">
      <div class="gear-main">
        <input type="text" data-bind="items.${i}.name" value="${esc(it.name)}" placeholder="Item name" aria-label="Item name">
        <select data-bind="items.${i}.template" aria-label="Template">${options(templates.map(x => ({ value: x.id, label: x.name })), it.template)}</select>
        ${t.has_rating ? `<select data-bind="items.${i}.rating" data-type="int" aria-label="Rating">${options([1, 2, 3, 4, 5].map(r =>
          ({ value: r, label: `Rating ${r}${t.rating_values ? ` · ${t.rating_values[r]}` : ''}` })), it.rating)}</select>` : ''}
        ${it.template === 'enhancement' ? `<select data-bind="items.${i}.appliesTo" aria-label="Adds to">${options(targets, it.appliesTo, 'Adds to…')}</select>` : ''}
      </div>
      <p class="hint"><b>${esc(t.name)}</b>${value ? ` ${esc(value)}` : ''} — ${esc(t.summary)}
        ${it.template === 'reserve' ? 'Only one Reserve item per session.' : ''}</p>
      ${it.notes ? `<p class="hint">${esc(it.notes)}</p>` : ''}
      <details><summary>Descriptors${it.descriptors.length ? `: ${esc(it.descriptors.map(d => D.items.descriptors.find(x => x.id === d).name).join(', '))}` : ''}</summary>
        ${['material', 'origin', 'quirk'].map(g => `<p class="sb-label small">${cap(g)}</p><div class="genre-grid">${D.items.descriptors.filter(d => d.group === g)
          .map(d => `<label class="check" title="${esc(d.effect)}"><input type="checkbox" data-toggle="items.${i}.descriptors" value="${d.id}"${
            it.descriptors.includes(d.id) ? ' checked' : ''}> ${esc(d.name)}</label>`).join('')}</div>`).join('')}
      </details>
      <button type="button" class="tiny" data-gear="remove-item" data-arg="${i}">Remove</button></div>`;
  }).join('');
  const itemsCard = `<section class="card wide"><h2>Items</h2>
    <p class="hint">${esc(D.items.rules)} Only the highest Enhancement to a given roll counts.</p>
    <div class="row"><select id="universal-pick">${options(universal, '', 'Universal item…')}</select>
      <button type="button" data-gear="add-universal">Add</button></div>
    <div class="row"><select id="genre-item-pick">${groupedOptions(genreGroups, '', 'Genre item…')}</select>
      <button type="button" data-gear="add-genre-item">Add</button>
      <button type="button" data-gear="custom-item">Build your own</button></div>
    ${itemRows}</section>`;

  return wealthCard + weapons + implementsCard + armorCard + itemsCard;
}
