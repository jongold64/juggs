// The Quick Rules tab: the How to Play cheat sheet plus the tables a player looks up mid-session, with the
// character's tier highlighted and Maneuver costs after their Mastery Floor.
import * as R from './rules.js';
import { esc } from './dom.js';

// The cheat sheet from the How to Play doc.
const CHEAT = [
  ['The roll', 'd20 + Ability + Skill (+ gear, + Domain Mastery); the margin is overage, 1 overage = 1 box'],
  ['Declare first', 'attack, defend, heal, press or task — before the die lands'],
  ['Attack', '1 Action; target Defends (1 Reaction, roll) or Deflects (free, 10 + Deflect Score)'],
  ['Body Defend / Deflect', "+ armor DR; Deflect also − the armor's Agility penalty"],
  ['Free basics', 'Basic Attack, Basic Cast, Basic Press cost no boxes'],
  ['Surge', '+1 per box before the roll, paid win or lose; max 3 / 4 / 5 / 6 / 7 by tier'],
  ['Effects', 'description below Surge 2; from Surge 2, Surge sets strength; off-Signature −1'],
  ['Fallout', 'natural 1 while Surging 3+: extra boxes, then Conditions and Corruption'],
  ['Boon', 'natural 20 (wider at higher tiers): Momentum (+2) until the end of your next turn; from Seasoned also the Boon Menu, a turn longer per tier; banks a Token'],
  ['Boon Menu', 'from Seasoned, pick (never the same twice): Recovery, unmark 1 box · Tempo, +1 Action this round · Clarity, clear a Condition on you · Guard, +2 to Deflect and Defend until your next turn · Grace, give one of these to an ally in Near range'],
  ['Bane', 'natural 1: Regression (−2) until the end of your next turn, plus more consequences at higher tiers'],
  ['Pools', '15 boxes; Hurt 6–10 −1, Injured 11–14 −2 (that Domain), last box Broken'],
  ['Rest', 'Quick: Healthy boxes · Full: Healthy and Hurt · Broken: magic + Full Rest'],
  ['Heal', 'd20 + Belief or Serenity + Heal vs DC 15; overage unmarks boxes'],
  ['Pool Transfer', 'once per encounter, free: any pool to any other at 2 spent for 1 restored, up to 6 / 8 / 10 / 12 / 14 boxes spent by tier'],
  ['Helping', 'free +2, or spend an Action / Reaction for +4; two helpers at most'],
  ['Movement', 'next zone free; farther 1 Action; leaving a Contested zone without an Action = Bane'],
  ['Social', 'pick an approach; Press / Hold / Deflect; total overage sets the result'],
  ['Levels', '6 skill points, +1 Score on even levels, Feats at 1 / 3 / 7 / 11 / 15 / 17 / 19, a Role Step at 5 / 9 / 13 / 17'],
];

const table = (head, rows, cls = '') => `<div class="table-wrap"><table class="qr-table ${cls}">
  <thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
  <tbody>${rows.join('')}</tbody></table></div>`;

export function renderRules(D, c) {
  const tier = R.tierFor(D, c.level);
  const card = (title, body) => `<section class="card wide"><h2>${title}</h2>${body}</section>`;

  const cheat = card('Cheat sheet', table(['Rule', 'In one line'],
    CHEAT.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`)));

  const free = t => (t.mastery_floor_free_up_to === 'all' ? 'all' : t.mastery_floor_free_up_to ? `${t.mastery_floor_free_up_to}-box` : '—');
  const tiers = card(`Tiers <span class="hint">you are ${esc(tier.name)}, Level ${c.level}</span>`, table(
    ['Tier', 'Levels', 'Actions / Reactions', 'Boon on', 'Momentum', 'Menu choices', 'Surge max', 'Skill caps (Focus / other)',
     'Governing cap', 'Free Maneuvers', 'Pool Transfer max'],
    D.core.tiers.map(t => `<tr${t.id === tier.id ? ' class="current"' : ''}><th scope="row">${esc(t.name)}</th>
      <td>${t.levels[0]}–${t.levels[1]}</td><td>${t.actions} / ${t.reactions}</td>
      <td>${t.boon_threshold === 20 ? '20' : `${t.boon_threshold}–20`}</td>
      <td>${t.momentum_turns === 1 ? '1 turn' : `${t.momentum_turns} turns`}</td><td>${t.boon_choices || '—'}</td>
      <td>${t.surge_max}</td><td>${t.focus_skill_cap} / ${t.other_skill_cap}</td><td>${t.governing_ability_cap}</td>
      <td>${free(t)}</td><td>${t.pool_transfer_max}</td></tr>`), 'tiers'));

  const boons = card('Boons and Banes', `
    <p><b>Boon</b> (natural ${tier.boon_threshold === 20 ? '20' : `${tier.boon_threshold}–20`} for you): Momentum, +2 to all your rolls
      ${tier.momentum_turns === 1 ? 'until the end of your next turn' : `for ${tier.momentum_turns} turns`}${
      tier.boon_choices ? `, plus ${tier.boon_choices === 1 ? 'one choice' : `${tier.boon_choices} choices`} from the Boon Menu` : ''}.
      Every natural Boon banks a Boon Token (1 token: Fallout one step milder; 2: cancel it).</p>
    <ul class="qr-list">${D.core.boon_menu.map(b => `<li><b>${esc(b.name)}</b> — ${esc(b.effect)}</li>`).join('')}</ul>
    <p><b>Bane</b> (natural 1): Regression, −2 to all your rolls until the end of your next turn, plus:</p>
    ${table(['Tier', 'What happens'], D.core.tiers.map(t => `<tr${t.id === tier.id ? ' class="current"' : ''}><th scope="row">${esc(t.name)}</th><td>${esc(t.bane)}</td></tr>`))}`);

  const surge = card('Surge and Fallout', table(['Boxes', 'Roll', 'Effect strength', 'Natural 1 (Fallout)'],
    D.core.surge.filter(s => s.boxes > 0).map(s => `<tr${s.boxes > tier.surge_max ? ' class="beyond"' : ''}><th scope="row">${s.boxes}</th>
      <td>${esc(s.roll_bonus)}</td><td>${esc(s.effect_intensity)}</td><td>${esc(s.fallout)}</td></tr>`))
    + `<p class="hint">Greyed rows are beyond your Surge maximum of ${tier.surge_max}. Pay from the pool you are using.</p>`);

  const maneuvers = card('Maneuvers <span class="hint">cost for you after the Mastery Floor</span>', table(['Maneuver', 'Cost', 'For you', 'Effect'],
    D.maneuvers.map(m => {
      const boxes = m.cost?.boxes;
      const mine = boxes ? R.maneuverCost(D, c.level, boxes) : null;
      return `<tr><th scope="row">${esc(m.name)}</th><td>${esc(m.cost_text)}</td>
        <td>${boxes ? (mine === 0 ? '<b class="good">free</b>' : `${mine} Stamina`) : esc(m.cost_text)}</td><td>${esc(m.effect)}</td></tr>`;
    })));

  const conds = list => list.map(x => `<details class="qr-cond"><summary><b>${esc(x.name)}</b> <span class="hint">${esc(x.effect || '')}</span></summary>
    ${x.removed ? `<p class="hint">Ends: ${esc(x.removed)}</p>` : ''}${x.source ? `<p class="hint">From: ${esc(x.source)}</p>` : ''}</details>`).join('');
  const conditions = card('Conditions', `<p class="hint">They do not stack, except Exhausted (−2 per level). Tap one for how it ends.</p>
    ${conds(D.conditions.filter(x => !x.positive && x.id !== 'removed'))}
    <h3>Positive</h3>${conds(D.conditions.filter(x => x.positive))}`);

  return cheat + tiers + boons + surge + maneuvers + conditions;
}
