// The character sheet: two printable pages laid out like source/JUGGS_Character_Sheet.pdf. On screen the pool
// boxes, trackers and conditions can be marked during play, and rolled values have a d20 button.
import * as R from './rules.js';
import { esc, signed, cap } from './dom.js';
import { summaryFor, describe, powerName } from './tab-powers.js';

const rollBtn = (what, bonus) =>
  `<button type="button" class="roll no-print" data-roll="${esc(what)}" data-bonus="${bonus}" aria-label="Roll ${esc(what)}">d20</button>`;

function field(label, value, cls = '') {
  return `<div class="sf ${cls}"><span class="sf-label">${esc(label)}</span><span class="sf-value">${esc(value || '')}</span></div>`;
}

const POOL_DOMAIN = { stamina: 'Body', mana: 'Mind', resolve: 'Spirit' };

function poolTrack(D, c, pool, info) {
  const marked = c.play.marked[pool];
  const band = R.bandAt(info.bands, marked);
  const boxes = [];
  for (const b of info.bands) {
    for (let n = b.from; n <= b.to; n++) {
      boxes.push(`<button type="button" class="box band-${b.id}${n <= marked ? ' marked' : ''}" data-pool="${pool}" data-box="${n}"
        aria-label="${cap(pool)} box ${n} (${b.name})" title="${b.name}${b.penalty ? ` ${b.penalty}` : ''}"></button>`);
    }
  }
  const legend = info.bands.map(b => `<span class="band-${b.id}-text">${esc(b.name)} ${b.from === b.to ? b.from : `${b.from}–${b.to}`}${
    b.penalty ? ` (${b.penalty} ${POOL_DOMAIN[pool]})` : ''}</span>`).join(' · ');
  return { boxes: boxes.join(''), legend, marked, band };
}

function trackerBoxes(c, key, max) {
  const v = c.play.trackers[key];
  return Array.from({ length: max }, (_, i) => `<button type="button" class="box small${i < v ? ' marked' : ''}" data-track="${key}"
    data-val="${i + 1}" aria-label="${cap(key)} ${i + 1}"></button>`).join('');
}

export function renderSheet(D, c) {
  const tier = R.tierFor(D, c.level);
  const scores = R.abilityScores(D, c);
  const mastery = R.domainMastery(D, scores);
  const primary = R.primaryDomain(c);
  const steps = R.roleSteps(D, c);
  const roleNames = Object.entries(steps).map(([id, n]) => `${D.rolesById.get(id).name} ${n}`).join(', ');
  const specs = R.specialtiesHeld(D, c);
  const apt = D.aptitudesById.get(c.aptitude);
  const origin = D.originsById.get(c.origin);
  const genres = c.genres.map(g => D.genresById.get(g).name).join(', ');

  // Identity
  const identity = `<section class="s-box s-wide"><h3>Identity</h3><div class="sf-grid">
    ${field('Character name', c.name, 'span2')}${field('Player', c.player)}${field('Concept', c.concept, 'span3')}
    ${field('Role', roleNames)}${field('Specialty', specs.map(s => s.name).join(', '))}${field('Aptitude', apt?.name)}
    ${field('Origin', origin ? `${origin.name}${c.originChoice ? ` (${c.originChoice})` : ''}` : '')}
    ${field('Genre', genres)}${field('Level', `${c.level} · ${tier.name}`)}</div></section>`;

  // Ability Scores
  const abilityRows = R.DOMAINS.map(dom => {
    const d = D.domainsById.get(dom);
    return `<tr class="s-domain dom-${dom}"><th colspan="2">${esc(d.name)}${dom === primary ? ' ★' : ''}</th>
      <td class="s-mastery" rowspan="4">${mastery[dom] ? signed(mastery[dom]) : '—'}<span>Mastery</span></td></tr>` +
      d.abilities.map(a => {
        const ab = D.abilitiesById.get(a);
        return `<tr><td>${esc(ab.name)}${a === c.governing ? ' ◆' : ''} <span class="s-hint">(${cap(ab.slot)})</span></td><td class="s-num">${scores[a]}</td></tr>`;
      }).join('');
  }).join('');
  const abilities = `<section class="s-box"><h3>Ability Scores</h3><table class="s-abilities">${abilityRows}</table>
    <p class="s-hint">★ Primary Domain · ◆ governing Ability</p></section>`;

  // Defenses
  const init = R.initiativeBonus(D, c);
  const defRows = R.DOMAINS.map(dom => {
    const slot = R.SLOT_ABILITY[dom];
    const defend = R.defendBonus(D, c, dom);
    return `<tr class="dom-${dom}"><th>${cap(dom)}</th><td><b>${R.deflectFor(D, c, dom)}</b><span class="s-hint">10 + ${esc(D.abilitiesById.get(slot.deflect).name)}${dom === 'body' && R.armorInfo(D, c).dr ? ' + DR' : ''}${dom === 'body' && R.armorInfo(D, c).agilityPenalty ? ' − armor' : ''}</span></td>
      <td><b>${signed(defend)}</b> ${rollBtn(`Defend (${cap(dom)})`, defend)}<span class="s-hint">${esc(D.abilitiesById.get(slot.defend).name)}</span></td></tr>`;
  }).join('');
  const defenses = `<section class="s-box"><h3>Defenses</h3>
    <div class="s-stats">
      <div><span class="s-big">${signed(init)}</span> ${rollBtn('Initiative', init)}<span class="s-hint">Initiative</span></div>
      <div><span class="s-big">${tier.actions} / ${tier.reactions}</span><span class="s-hint">Actions / Reactions</span></div>
      <div><span class="s-big">${tier.surge_max}</span><span class="s-hint">Surge max</span></div>
      <div><span class="s-big">${tier.boon_threshold === 20 ? '20' : `${tier.boon_threshold}–20`}</span><span class="s-hint">Boon: Momentum ${tier.momentum_turns === 1 ? '1 turn' : `${tier.momentum_turns} turns`}${
        tier.boon_choices ? ` + ${tier.boon_choices} choice${tier.boon_choices > 1 ? 's' : ''}` : ''}</span></div>
    </div>
    <table class="s-def"><thead><tr><th></th><th>Deflect</th><th>Defend</th></tr></thead><tbody>${defRows}</tbody></table>
    ${(() => {
      const a = R.armorInfo(D, c);
      return `<p class="s-armor"><b>DR ${a.dr}</b> added to Body Defend and Deflect${a.agilityPenalty ? ' (armor lowers Deflect and Agility rolls)' : ''}${a.parts.length ? ` <span class="s-hint">(${a.parts.map(([n, v]) => `${esc(n)} ${v}`).join(' + ')})</span>` : ''}${
        a.agilityPenalty ? ` · Agility rolls ${a.agilityPenalty}` : ''}</p>`;
    })()}</section>`;

  // Weapons and implements
  const effName = id => D.effectsById.get(id)?.name || '';
  const weaponRows = [
    ...c.weapons.map(w => {
      const atk = R.weaponAttack(D, c, w);
      const q = D.gear.quality.find(x => x.id === w.quality);
      return `<tr><td><b>${esc(w.name)}</b></td><td>${esc(q.name)} ${signed(q.weapon_bonus)}</td><td>${cap(w.kind)}</td><td>${esc(effName(w.effect))}</td>
        <td><b>${signed(atk.total)}</b> ${rollBtn(`${w.name} attack`, atk.total)}</td></tr>`;
    }),
    ...c.implements.map(m => {
      const cast = R.basicCast(D, c, m);
      const q = D.gear.quality.find(x => x.id === m.quality);
      return `<tr><td><b>${esc(m.name)}</b></td><td>${esc(q.name)} ${signed(q.weapon_bonus)}</td><td>Implement</td><td></td>
        <td><b>${signed(cast.total)}</b> ${rollBtn(`Basic Cast (${m.name})`, cast.total)}</td></tr>`;
    }),
  ].join('');
  const weaponBox = weaponRows ? `<section class="s-box s-wide"><h3>Weapons &amp; Implements</h3><table class="s-powers">
    <thead><tr><th>Name</th><th>Quality</th><th>Kind</th><th>Effect</th><th>Attack / Cast</th></tr></thead><tbody>${weaponRows}</tbody></table></section>` : '';

  // Pools, side by side
  const pools = R.pools(D, c);
  const poolCols = R.DOMAINS.map(dom => {
    const pool = R.POOLS[dom];
    const t = poolTrack(D, c, pool, pools[pool]);
    return `<div class="s-pool dom-${dom}"><div class="s-pool-head"><b>${cap(pool)}</b> <span class="s-hint">${cap(dom)}</span>
      <span class="s-pool-max">${t.marked} / ${pools[pool].size}${t.band ? ` · ${esc(t.band.name)}` : ''}</span></div>
      <div class="s-boxes s-pool-boxes" style="grid-template-columns: repeat(${pools[pool].size}, minmax(0, 1fr))">${t.boxes}</div>
      <div class="s-hint">${t.legend}</div></div>`;
  }).join('');
  const poolRow = `<section class="s-box s-wide"><h3>Pools</h3><div class="s-pools">${poolCols}</div>
    <p class="s-hint">Mark left to right; unmark right to left. Tap a box to mark up to it.</p></section>`;

  // Skills
  const { focus } = R.focusInfo(D, c);
  const skills = R.availableSkills(D, c).map(s => {
    const ab = R.skillAbility(D, c, s.id, scores);
    const total = ab ? R.skillTotal(D, c, s.id) : null;
    return `<div class="s-skill${focus.has(s.id) ? ' focus' : ''}"><span class="s-f">${focus.has(s.id) ? '★' : ''}</span>
      <span class="s-name">${esc(s.name)}<span class="s-hint"> ${ab ? esc(D.abilitiesById.get(ab).name) : ''}</span></span>
      <span class="s-rank">${R.skillRank(D, c, s.id)}</span><span class="s-total">${total === null ? '' : signed(total)}</span>
      ${total === null ? '' : rollBtn(s.name, total)}</div>`;
  }).join('');
  const skillBox = `<section class="s-box s-wide"><h3>Skills <span class="s-hint">★ Focus · rank · total (Ability + rank + Mastery)</span></h3>
    <div class="s-skills">${skills}</div></section>`;

  // Signature, sources, standing
  const eff = id => D.effectsById.get(id)?.name || '';
  const wealth = c.wealth ?? R.startingWealth(D, c);
  const w = D.core.wealth_tiers[wealth - 1];
  const small = `<section class="s-box"><h3>Signature Effect</h3>${field('Offensive (free on Surge 2+)', eff(c.signature.offensive))}
      ${field('Defensive / utility', eff(c.signature.utility))}<p class="s-hint">Any other Effect: −1 to the roll.</p></section>
    <section class="s-box"><h3>Power Source</h3><p>${R.powerSources(D, c).map(s => esc(D.sourcesById.get(s).name)).join(' · ')}</p>
      <p class="s-hint">Physical always applies.</p></section>
    <section class="s-box"><h3>Wealth &amp; Standing</h3>${field('Wealth Tier', `${wealth} · ${w.name}`)}${field('Cash on Hand', w.cash_on_hand)}
      ${field('Reputation', String(R.reputation(D, c)))}
      <div class="sf"><span class="sf-label">Boon Tokens</span><span class="sf-value">${c.play.boonTokens}
        <button type="button" class="tiny no-print" data-step="play.boonTokens" data-by="-1" aria-label="Spend a Boon Token">−</button>
        <button type="button" class="tiny no-print" data-step="play.boonTokens" data-by="1" aria-label="Bank a Boon Token">+</button></span></div></section>`;

  const page1 = `<div class="sheet-page"><div class="s-title"><b>JUGGS</b> Jon's Universal Genre Gaming System · Character Sheet<span>d20 + Ability + Skill</span></div>
    ${identity}<div class="s-row">${abilities}${defenses}</div>${poolRow}${weaponBox}${skillBox}<div class="s-row s-three">${small}</div></div>`;

  // Page 2: features
  const roleList = Object.entries(steps).map(([id, n]) => {
    const role = D.rolesById.get(id);
    return role.steps.filter(s => s.step <= n).map(s => `<li><b>${esc(role.name)} ${s.step}</b> ${esc(s.text)}</li>`).join('');
  }).join('');
  const unlocked = R.specialtyAbilities(D, c);
  const specList = specs.map(sp => (unlocked[sp.id] || []).map(k => `<li><b>${esc(sp.name)} ${k === 'mastery' ? 'Mastery' : k.replace('ability', '')}</b> ${
    esc(sp.abilities[k].text)}</li>`).join('')).join('');
  const featList = R.levelsUpTo(D.core.advancement.feat_levels, c.level).map(lv => {
    const f = D.featsById.get(c.feats[lv]);
    return `<li><b>L${lv}</b> ${f ? `${esc(f.name)} — ${esc(f.at_the_table || f.text || '')}` : ''}</li>`;
  }).join('');
  const features = `<section class="s-box s-wide"><h3>Features, Specialty Abilities &amp; Feats</h3>
    <h4>Role Features</h4><ul class="s-list">${roleList || '<li class="s-hint">—</li>'}</ul>
    <h4>Specialty Abilities</h4><ul class="s-list">${specList || '<li class="s-hint">—</li>'}</ul>
    <h4>Feats</h4><ul class="s-list">${featList}</ul></section>`;

  const powerRows = c.powers.map(p => {
    const s = summaryFor(D, c, p);
    const ex = p.example && D.powers.examples.find(e => e.id === p.example)?.levels.find(l => l.level === p.exampleLevel);
    return `<tr><td><b>${esc(powerName(D, p))}</b></td><td>${s.powerLevel === 0 ? 'Cantrip' : `PL ${s.effectiveLevel}`}</td><td>${s.mana}</td>
      <td>${esc(ex ? `${ex.profile} → ${ex.result || ''}` : describe(D, p, s).replace(/ Power Level.*$| Cantrip ·.*$/, ''))}</td></tr>`;
  }).join('');
  const powers = c.powers.length ? `<section class="s-box s-wide"><h3>Powers</h3><table class="s-powers">
    <thead><tr><th>Power</th><th>Level</th><th>Mana</th><th>What it does</th></tr></thead><tbody>${powerRows}</tbody></table></section>` : '';

  const trackers = `<section class="s-box"><h3>Status Trackers</h3>
    ${[['corruption', 5, 'persistent · never resets'], ['fear', 4, 'individual, acute'], ['morale', 5, 'party shared'],
       ['sanity', 4, 'horror campaigns']].map(([k, n, note]) =>
      `<div class="s-tracker"><span>${cap(k)}</span><span class="s-boxes">${trackerBoxes(c, k, n)}</span><span class="s-hint">${note}</span></div>`).join('')}
    <p class="s-hint">Corruption: Clean · Tainted 1–2 · Marked 3–4 · Claimed 5</p></section>`;
  const conds = D.conditions.filter(x => !x.positive && x.id !== 'removed');
  const conditions = `<section class="s-box"><h3>Conditions</h3><div class="s-conds">${conds.map(x =>
    `<label><input type="checkbox" data-toggle="play.conditions" value="${x.id}"${c.play.conditions.includes(x.id) ? ' checked' : ''}> ${esc(x.name)}</label>`).join('')}</div>
    <h4>Positive</h4><div class="s-conds">${D.conditions.filter(x => x.positive).map(x =>
    `<label><input type="checkbox" data-toggle="play.conditions" value="${x.id}"${c.play.conditions.includes(x.id) ? ' checked' : ''}> ${esc(x.name)}</label>`).join('')}</div></section>`;
  const itemList = c.items.map(it => {
    const t = D.items.templates.find(x => x.id === it.template);
    const target = it.appliesTo && it.appliesTo !== 'dr'
      ? (it.appliesTo.includes(':') ? (D.skillsById.get(it.appliesTo.split(':')[1]) || D.abilitiesById.get(it.appliesTo.split(':')[1]))?.name
        : cap(it.appliesTo)) : '';
    const value = t.rating_values?.[it.rating] || '';
    return `<li><b>${esc(it.name || t.name)}</b> <span class="s-hint">${esc(t.name)}${value ? ` ${esc(value)}` : ''}${target ? ` to ${esc(target)}` : ''}${
      it.descriptors.length ? ` · ${esc(it.descriptors.map(d => D.items.descriptors.find(x => x.id === d).name).join(', '))}` : ''}</span></li>`;
  }).join('');
  const notes = `<section class="s-box"><h3>Gear &amp; Equipment</h3>
      ${itemList ?`<ul class="s-list">${itemList}</ul>` : ''}<p class="s-pre">${esc(c.gear)}</p>
      ${c.languages ? `<h4>Languages</h4><p>${esc(c.languages)}</p>` : ''}</section>
    <section class="s-box"><h3>Notes, Bonds &amp; Story Hooks</h3><p class="s-pre">${esc(c.notes)}</p></section>`;

  const page2 = `<div class="sheet-page"><div class="s-title"><b>JUGGS</b> Features · Trackers · Gear · Notes<span>Page 2</span></div>
    ${features}${powers}<div class="s-row">${trackers}${conditions}</div><div class="s-row">${notes}</div></div>`;
  return page1 + page2;
}
