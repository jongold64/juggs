// The Quick Rules tab: the How to Play cheat sheet plus the tables a player looks up mid-session, with the
// character's tier highlighted and Maneuver costs at their tier.
import * as R from './rules.js';
import { esc, signed } from './dom.js';
import { weirdOn, weirdCard } from './weird.js';

const HOW_TO_PLAY = 'https://claude.ai/code/artifact/5ea00859-2298-46d0-b0ad-aaf4fb2c4806';

// The cheat sheet from the How to Play doc.
const CHEAT = [
  ['The roll', 'd20 + Ability + Skill (+ gear, + Domain Mastery); the margin is overage, 1 overage = 1 box; when a hero ties an enemy, the hero gets the Upper Hand: the enemy takes −2 on its next roll'],
  ['Declare first', 'attack, defend, heal, press or task — before the die lands'],
  ['Attack', '1 Action; target Defends (1 Reaction, roll) or Deflects (free, 10 + Deflect Score + tier bonus)'],
  ['Hit Cap', 'one hit crosses at most 5 + tier number boxes, after armor; each Effort box raises it for that hit; healing has no cap'],
  ['Armor', 'DR comes off Stamina damage; it does not raise Defend or Deflect'],
  ['Minions', 'in the target\'s zone, they fall at the rate of your total overage, which ignores the Hit Cap; each lasts as many hits as the party\'s tier number'],
  ['Basics', 'free: one plain use of a skill, in or out of combat (Basic Attack, Basic Cast, Basic Press, picking a lock)'],
  ['Techniques', 'a Basic with upgrades: Rank 1 + 1 per upgrade; pay Rank boxes less your tier discount (min 1); on a hit cross the overage or the Rank; highest Rank 2 / 3 / 4 / 5 / 5 by tier'],
  ['Effort', '+1 to the roll and +1 Hit Cap per box, before the roll, paid win or lose; max 3 / 4 / 5 / 6 / 7 by tier'],
  ['Big Effort', '3+ boxes: on a hit the target can only Deflect; a natural 1 crosses the same boxes again'],
  ['Effects', 'declare the type, spend boxes before the roll, one ladder for every type; off-Signature −1; Signature 1-box rung free on an Effort 2+ hit'],
  ['Fallout', 'natural 1: casters using 5+ Effort; Specialty and Weird Fallout at Effort 3+'],
  ['Boon', 'natural 20 (wider at higher tiers): pick from the Boon Menu, 1 / 1 / 2 / 2 / 3 choices by tier'],
  ['Boon Menu', 'never the same twice: Momentum, +2 to all rolls until the end of your next turn · Recovery, unmark 1 box · Tempo (Seasoned+), +1 Action, once per round · Clarity, clear a Condition on you · Guard, +2 to Deflect and Defend until your next turn · Opening, next ally to attack the same target this round gets +2 · Break Through, this hit ignores armor DR, once per round · Reset, regain one spent Reaction, once per round · Keen Eye, one true answer from the GM · Grace, give one of these to an ally in Near range'],
  ['Bane', 'natural 1: −2 to all rolls until the end of your next turn; from Seasoned the GM also picks from the Bane Menu; no Bane while your Boon is still active'],
  ['Abjure', 'from Seasoned: Belief 3+ and Channel 1. Belief vs Morale, 2 Resolve, once per scene. Removed on 5+ overage needs Abjurer's Authority'],
  ['Pools', '15 boxes; Hurt 6–10 −1, Injured 11–14 −2 (that Domain), last box Broken'],
  ['Rest', 'Quick: Healthy boxes · Full: Healthy and Hurt · Broken: magic + Full Rest'],
  ['Heal', 'd20 + Belief or Serenity + Channel vs DC 15; overage or Rank unmarks boxes; mundane healing uses Survive'],
  ['Crafting', 'ordinary things are a Basic: Operate or Craft vs the quality DC (8 / 10 / 13 / 16 / 19 / 23); an item with a Rating is a Technique of that Rank, paid in Mana; Wealth Tier must reach Rating + 2'],
  ['Helping', 'free +2, or spend an Action / Reaction for +4; two helpers at most'],
  ['Movement', 'next zone free; farther 1 Action; leaving a Contested zone without an Action = Bane'],
  ['Social', 'pick an approach; Press / Hold / Deflect; total overage sets the result'],
  ['Levels', '6 skill points, +1 Score on even levels, Feats at 1 / 3 / 7 / 11 / 15 / 17 / 19, Roles, Specialties and Stepped Feats grow at 5 / 9 / 13 / 17'],
];

const table = (head, rows, cls = '') => `<div class="table-wrap"><table class="qr-table ${cls}">
  <thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
  <tbody>${rows.join('')}</tbody></table></div>`;

export function renderRules(D, c) {
  const tier = R.tierFor(D, c.level);
  const card = (title, body) => `<section class="card wide"><h2>${title}</h2>${body}</section>`;

  const cheat = card('Cheat sheet', `<p class="hint">One line per rule. The full rules are in <a href="${HOW_TO_PLAY}" target="_blank" rel="noopener">How to Play ↗</a>.</p>` + table(['Rule', 'In one line'],
    CHEAT.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`)));

  const menu = card('Boon Menu', `<p>On a Boon you pick <b>${tier.boon_choices === 1 ? 'one' : tier.boon_choices}</b> of these (never the same one twice):</p>
    <ul class="qr-menu">${R.boonMenu(D, c.level).map(b => `<li><b>${esc(b.name)}</b> ${esc(b.effect)}</li>`).join('')}</ul>`);

  const tiers = card(`Tiers <span class="hint">you are ${esc(tier.name)}, Level ${c.level}</span>`, table(
    ['Tier', 'Levels', 'Actions / Reactions', 'Boon on', 'Boon choices', 'Bane Menu', 'Deflect bonus', 'Hit Cap', 'Effort max',
     'Skill caps (Focus / other)', 'Governing cap', 'Highest Rank', 'Technique cost'],
    D.core.tiers.map(t => `<tr${t.id === tier.id ? ' class="current"' : ''}><th scope="row">${esc(t.name)}</th>
      <td>${t.levels[0]}–${t.levels[1]}</td><td>${t.actions} / ${t.reactions}</td>
      <td>${t.boon_threshold === 20 ? '20' : `${t.boon_threshold}–20`}</td>
      <td>${t.boon_choices}</td><td>${t.bane_choices || '—'}</td><td>${signed(t.deflect_bonus)}</td><td>${t.hit_cap}</td>
      <td>${t.surge_max}</td><td>${t.focus_skill_cap} / ${t.other_skill_cap}</td><td>${t.governing_ability_cap}</td>
      <td>${t.technique_rank_cap}</td><td>${t.technique_discount ? `Rank − ${t.technique_discount}` : 'Rank'}</td></tr>`), 'tiers'));

  const boons = card('Boons and Banes', `
    <p><b>Boon</b> (natural ${tier.boon_threshold === 20 ? '20' : `${tier.boon_threshold}–20`} for you):
      ${tier.boon_choices === 1 ? 'one choice' : `${tier.boon_choices} choices`} from the Boon Menu (above).</p>
    <p><b>Bane</b> (natural 1): −2 to all your rolls until the end of your next turn. ${tier.bane_choices
      ? `The GM also picks <b>${tier.bane_choices === 1 ? 'one' : tier.bane_choices}</b> from this menu (never the same twice):`
      : 'From Seasoned the GM also picks from this menu (never the same twice):'}</p>
    <ul class="qr-menu">${D.core.bane_menu.map(b => `<li><b>${esc(b.name)}</b> ${esc(b.effect)}</li>`).join('')}</ul>`);

  const surge = card('Effort and Fallout', table(['Boxes', 'Roll', 'Hit Cap', 'On a hit', 'Natural 1'],
    D.core.surge.filter(s => s.boxes > 0).map(s => `<tr${s.boxes > tier.surge_max ? ' class="beyond"' : ''}><th scope="row">${s.boxes}</th>
      <td>${esc(s.roll_bonus)}</td><td>+${s.hit_cap_rise}</td><td>${s.big_surge ? 'Target can only Deflect' : '—'}</td><td>${esc(s.backlash)}</td></tr>`))
    + `<p class="hint">Greyed rows are beyond your Effort maximum of ${tier.surge_max}. Pay from the pool you are using.</p>`);

  const maneuvers = card('Maneuvers <span class="hint">ready-made Techniques; cost for you at your tier</span>', table(['Maneuver', 'Rank', 'For you', 'Effect'],
    D.maneuvers.map(m => {
      const boxes = m.cost?.boxes;
      const mine = boxes ? R.techniqueCost(D, boxes, c.level) : null;
      return `<tr><th scope="row">${esc(m.name)}</th><td>${esc(m.cost_text)}</td>
        <td>${boxes ? `${mine} Stamina` : esc(m.cost_text)}</td><td>${esc(m.effect)}</td></tr>`;
    })));

  const conds = list => list.map(x => `<details class="qr-cond"><summary><b>${esc(x.name)}</b> <span class="hint">${esc(x.effect || '')}</span></summary>
    ${x.removed ? `<p class="hint">Ends: ${esc(x.removed)}</p>` : ''}${x.source ? `<p class="hint">From: ${esc(x.source)}</p>` : ''}</details>`).join('');
  const conditions = card('Conditions', `<p class="hint">They do not stack, except Weakened (−2 per level, to −6) and Drained (to level 3). Burning, Bleeding and Poisoned are separate. Tap one for how it ends.</p>
    ${conds(R.playConditions(D, false))}
    <h3>Positive</h3>${conds(R.playConditions(D, true))}
    <details class="qr-cond"><summary><b>Supernatural</b> <span class="hint">GM reference, from the appendix</span></summary>${conds(D.conditions.filter(x => x.supernatural))}</details>`);

  const ladder = list => table(['Boxes', 'On a hit'], list.map(r => `<tr><th scope="row">${esc(r.boxes)}</th><td>${esc(r.text)}</td></tr>`));
  const effects = card('Effects', `<p class="hint">${esc(D.core.effects_rule)}</p>${ladder(D.core.effect_ladder)}
    ${table(['Type', 'Condition', 'Pools', 'Usually from'], D.effects.map(e => `<tr><th scope="row">${esc(e.name)}</th><td>${esc(e.condition)}</td>
      <td>${esc(e.pools.map(p => p[0].toUpperCase() + p.slice(1)).join(', '))}</td><td>${esc(e.use)}</td></tr>`))}
    <h3>Healing</h3><p class="hint">A separate action: declare Heal, roll against DC 15, pay the Power's cost from Mana or Resolve, and unmark the overage or the Power Level, whichever is higher, with no cap. Not on yourself in active combat.</p>`);

  return cheat + menu + tiers + boons + surge + (weirdOn(c) ? weirdCard(D) : '') + effects + maneuvers + conditions;
}
