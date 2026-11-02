// JUGGS rules as pure functions. Every function takes the loaded data (D) and/or a character (c) and returns a
// value; nothing here touches the page. See docs/DECISIONS.md for where each rule comes from.

export const ABILITIES = ['str', 'tou', 'agi', 'int', 'wil', 'acu', 'bel', 'mor', 'ser'];
export const DOMAINS = ['body', 'mind', 'spirit'];
export const POOLS = { body: 'stamina', mind: 'mana', spirit: 'resolve' };
export const SLOT_ABILITY = {  // Domain -> Attack / Defend / Deflect Ability Score
  body: { attack: 'str', defend: 'tou', deflect: 'agi' },
  mind: { attack: 'int', defend: 'wil', deflect: 'acu' },
  spirit: { attack: 'bel', defend: 'mor', deflect: 'ser' },
};
export const DOMAIN_OF = { str: 'body', tou: 'body', agi: 'body', int: 'mind', wil: 'mind', acu: 'mind',
                           bel: 'spirit', mor: 'spirit', ser: 'spirit' };

const sum = xs => xs.reduce((a, b) => a + b, 0);
const byLevel = (map, level) => Object.entries(map || {}).filter(([lv]) => Number(lv) <= level)
  .sort((a, b) => a[0] - b[0]);

// ---------------------------------------------------------------------------------------------------------------
// Tiers and levels
// ---------------------------------------------------------------------------------------------------------------

export function tierFor(D, level) {
  return D.core.tiers.find(t => level >= t.levels[0] && level <= t.levels[1]) || D.core.tiers[0];
}

// Novice 1 to Legendary 5.
export const tierNumber = (D, level) => D.core.tiers.indexOf(tierFor(D, level)) + 1;

// Each Signature Effect type gives DR equal to the tier number against damage of that type.
export const signatureDR = (D, c) => tierNumber(D, c.level);

// Levels at or below `level` where something happens.
export const levelsUpTo = (list, level) => list.filter(lv => lv <= level);
export const isTierChange = (D, level) => D.core.advancement.tier_change_levels.includes(level);
export const isFeatLevel = (D, level) => D.core.advancement.feat_levels.includes(level);
export const isAbilityLevel = (D, level) => D.core.advancement.ability_increase_levels.includes(level);
export const skillPointsAt = (D, level) =>
  level >= D.core.advancement.skill_points.from_level ? D.core.advancement.skill_points.per_level : 0;

// ---------------------------------------------------------------------------------------------------------------
// Ability Scores
// ---------------------------------------------------------------------------------------------------------------

export function bpSpent(base) {
  return sum(ABILITIES.map(a => base[a] || 0));
}

// The Domains with the most Build Points in them. One entry means the Primary Domain is settled; more means a tie
// the player breaks.
export function topDomains(base) {
  const totals = DOMAINS.map(d => [d, sum(Object.values(SLOT_ABILITY[d]).map(a => base[a] || 0))]);
  const best = Math.max(...totals.map(t => t[1]));
  return totals.filter(t => t[1] === best).map(t => t[0]);
}

export function primaryDomain(c) {
  const top = topDomains(c.base);
  return top.length === 1 ? top[0] : (top.includes(c.primaryDomain) ? c.primaryDomain : top[0]);
}

export function aptitudeBonuses(D, c) {
  const apt = D.aptitudesById.get(c.aptitude);
  return apt ? apt.ability_bonuses : {};
}

// Ability Scores at a level: 20 BP spread + Background bonuses + even-level increases, plus Ability Score
// Enhancement items (which add to the Score itself). `withGear: false` leaves the items out — the advancement caps
// apply to what the character built, not to what they carry.
export function abilityScores(D, c, level = c.level, { withGear = true } = {}) {
  const scores = {};
  const apt = aptitudeBonuses(D, c);
  for (const a of ABILITIES) scores[a] = (c.base[a] || 0) + (apt[a] || 0);
  for (const [lv, a] of byLevel(c.abilityIncreases, level)) {
    if (a && isAbilityLevel(D, Number(lv))) scores[a] += 1;
  }
  if (withGear) {
    const enh = enhancements(c);
    for (const a of ABILITIES) scores[a] += enh[`ability:${a}`] || 0;
  }
  return scores;
}

export function abilityCap(D, c, ability, level = c.level) {
  const tier = tierFor(D, level);
  if (ability === c.governing) return tier.governing_ability_cap;
  // From Veteran, the other two Scores in the governing Ability's Domain cap at 6, so Superior Mastery can be reached.
  return DOMAIN_OF[ability] === DOMAIN_OF[c.governing] ? tier.governing_domain_cap : tier.other_ability_cap;
}

// Problems with the creation spread, as sentences.
export function creationProblems(D, c) {
  const cr = D.core.creation;
  const out = [];
  const spent = bpSpent(c.base);
  if (spent !== cr.build_points) out.push(`${spent} of ${cr.build_points} Build Points spent.`);
  const apt = aptitudeBonuses(D, c);
  for (const a of ABILITIES) {
    const v = c.base[a] || 0;
    const name = D.abilitiesById.get(a).name;
    if (v < cr.ability_min) out.push(`${name} must be at least ${cr.ability_min}.`);
    if (v > cr.ability_max) out.push(`${name} can be at most ${cr.ability_max} from Build Points.`);
    if (v + (apt[a] || 0) > cr.ability_max_with_bonuses) {
      out.push(`${name} can be at most ${cr.ability_max_with_bonuses} with the Background bonus.`);
    }
  }
  return out;
}

// Problems with the even-level increases (a Score above its cap at the level it was raised).
export function increaseProblems(D, c) {
  const out = [];
  for (const [lv, a] of byLevel(c.abilityIncreases, c.level)) {
    if (!a) continue;
    const level = Number(lv);
    const score = abilityScores(D, c, level, { withGear: false })[a];
    const cap = abilityCap(D, c, a, level);
    if (score > cap) out.push(`Level ${level}: ${D.abilitiesById.get(a).name} ${score} is over its cap of ${cap}.`);
  }
  return out;
}

// Domain Mastery: +1 / +2 when all three Scores in a Domain reach 4 / 6.
export function domainMastery(D, scores) {
  const out = {};
  for (const d of DOMAINS) {
    const low = Math.min(...Object.values(SLOT_ABILITY[d]).map(a => scores[a]));
    const reached = D.core.domain_mastery.filter(m => low >= m.all_at_least);
    out[d] = reached.length ? reached[reached.length - 1].bonus : 0;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------------------------------------------

// Toughened (by tier) and Iron Body add boxes that follow the normal growth order; Defender Step 2 adds one Healthy
// Stamina box; Legendary Endurance adds two Stamina boxes at the end of Injured (DECISIONS.md).
const TOUGHENED_BY_TIER = { novice: 1, seasoned: 2, veteran: 2, heroic: 3, legendary: 3 };
export function poolExtras(D, c, level = c.level) {
  const feats = new Set(featsTaken(D, c, level));
  const steps = roleSteps(D, c, level);
  const extra = { stamina: { grow: 0, healthy: 0, injured: 0 }, mana: { grow: 0, healthy: 0, injured: 0 },
                  resolve: { grow: 0, healthy: 0, injured: 0 } };
  if (feats.has('toughened')) for (const p of Object.values(extra)) p.grow += TOUGHENED_BY_TIER[tierFor(D, level).id];
  if (feats.has('iron-body')) extra.stamina.grow += 3;
  if ((steps.defender || 0) >= 2) extra.stamina.healthy += 1;
  if (feats.has('legendary-endurance')) extra.stamina.injured += 2;
  return extra;
}

export function poolGrowth(D, level) {
  return levelsUpTo(D.core.advancement.pool_increase_levels, level).length;
}

// Bands for a pool: [{ id, name, from, to, penalty }], boxes numbered from 1. Extra boxes join Healthy, then
// Hurt, then Injured, repeating; Broken is always the last box.
export function poolBands(D, grow, fixed = { healthy: 0, injured: 0 }) {
  const bands = D.core.pools.bands.map(b => ({ ...b }));
  const byId = Object.fromEntries(bands.map(b => [b.id, b]));
  const order = D.core.pools.growth_order;
  for (let i = 0; i < grow; i++) byId[order[i % order.length]].boxes += 1;
  byId.healthy.boxes += fixed.healthy || 0;
  byId.injured.boxes += fixed.injured || 0;
  let n = 1;
  return bands.map(b => {
    const band = { id: b.id, name: b.name, from: n, to: n + b.boxes - 1, penalty: b.penalty, boxes: b.boxes };
    n += b.boxes;
    return band;
  });
}

export function pools(D, c, level = c.level) {
  const extras = poolExtras(D, c, level);
  const growth = poolGrowth(D, level);
  const out = {};
  for (const [pool, x] of Object.entries(extras)) {
    const bands = poolBands(D, growth + x.grow, x);
    out[pool] = { size: bands[bands.length - 1].to, bands };
  }
  return out;
}

export function bandAt(bands, marked) {
  if (marked <= 0) return null;
  return bands.find(b => marked >= b.from && marked <= b.to) || bands[bands.length - 1];
}

// ---------------------------------------------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------------------------------------------

export function enabledGenres(D, c) {
  const on = new Set(c.genres || []);
  // A Genre that needs another (Weird Magic needs Magic) only counts when that one is on too.
  return new Set([...on].filter(g => (D.genresById.get(g)?.requires || []).every(r => on.has(r))));
}

export function availableSkills(D, c) {
  const on = enabledGenres(D, c);
  return D.skills.filter(s => !s.gm_only && (!s.genres.length || s.genres.some(g => on.has(g))));
}

// Bonus Focus Skills from the Background and Specialties held at a level, with where each came from. A Specialty
// taken later gives its bonus skills from the level it is taken.
export function bonusSkills(D, c, level = c.level) {
  const out = [];
  const apt = D.aptitudesById.get(c.aptitude);
  if (apt) {
    const list = Array.isArray(apt.bonus_skills) ? apt.bonus_skills : (c.aptitudeSkills || []).slice(0, 2);
    for (const s of list) if (s) out.push({ skill: s, from: apt.name });
  }
  for (const sp of specialtiesHeld(D, c, level)) {
    for (const s of sp.bonus_skills) out.push({ skill: s, from: sp.name });
  }
  return out;
}

// Focus Skills: the 6 chosen plus bonus skills. A bonus skill that is already a Focus Skill becomes an "overlap":
// +1 to another skill of the player's choice instead (c.overlapPicks, one per overlap, in bonusSkills order).
export function focusInfo(D, c, level = c.level) {
  const focus = new Set((c.focus || []).filter(Boolean));
  const overlaps = [];
  for (const b of bonusSkills(D, c, level)) {
    if (focus.has(b.skill)) overlaps.push(b);
    else focus.add(b.skill);
  }
  return { focus, overlaps };
}

export function skillRank(D, c, skill, level = c.level) {
  const { focus, overlaps } = focusInfo(D, c, level);
  const cr = D.core.creation;
  let rank = focus.has(skill) ? cr.focus_skill_start : cr.other_skill_start;
  rank += overlaps.filter((o, i) => (c.overlapPicks || [])[i] === skill).length;
  for (const [, list] of byLevel(c.skillPoints, level)) rank += (list || []).filter(s => s === skill).length;
  return rank;
}

export function skillCap(D, c, skill, level = c.level) {
  const tier = tierFor(D, level);
  return focusInfo(D, c, level).focus.has(skill) ? tier.focus_skill_cap : tier.other_skill_cap;
}

// The Ability Score a skill rolls with: the best of its governing Scores ("primary_attack" = the Primary Domain's
// Attack Score, for Persuade).
export function skillAbility(D, c, skill, scores) {
  const s = D.skillsById.get(skill);
  const options = s.governing.map(g => (g === 'primary_attack' ? SLOT_ABILITY[primaryDomain(c)].attack : g));
  if (!options.length) return null;
  return options.reduce((best, a) => (scores[a] > scores[best] ? a : best), options[0]);
}

// d20 + Ability + Skill rank + Domain Mastery for the Ability's Domain + gear (Enhancements, armor penalty).
export function skillTotal(D, c, skill, level = c.level) {
  const scores = abilityScores(D, c, level);
  const ability = skillAbility(D, c, skill, scores);
  if (!ability) return null;
  const mastery = domainMastery(D, scores)[DOMAIN_OF[ability]];
  return scores[ability] + skillRank(D, c, skill, level) + mastery + gearRollBonus(D, c, ability, skill);
}

// Problems with the skill points spent at each level.
export function skillPointProblems(D, c) {
  const out = [];
  for (let level = 2; level <= c.level; level++) {
    const list = (c.skillPoints?.[level] || []).filter(Boolean);
    const allowed = skillPointsAt(D, level);
    if (list.length > allowed) out.push(`Level ${level}: ${list.length} skill points, only ${allowed} allowed.`);
    if (new Set(list).size !== list.length) out.push(`Level ${level}: each point must go to a different skill.`);
    for (const s of new Set(list)) {
      const rank = skillRank(D, c, s, level);
      const cap = skillCap(D, c, s, level);
      if (rank > cap) out.push(`Level ${level}: ${D.skillsById.get(s)?.name || s} rank ${rank} is over its cap of ${cap}.`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Roles, Specialties, Feats
// ---------------------------------------------------------------------------------------------------------------

// Role Steps held at a level: { roleId: steps }. Roles work as Stepped Feats: the first is free, a further one sits in
// a Feat slot, and every Role held has the Steps its tier has reached.
export function roleSteps(D, c, level = c.level) {
  const steps = D.core.tiers.indexOf(tierFor(D, level)) + 1;
  const out = {};
  if (c.role) out[c.role] = steps;
  for (const [, f] of byLevel(c.feats, level)) if (slotRole(f)) out[slotRole(f)] = steps;
  return out;
}

export const FEAT_GROUPS = [['universal', 'Universal'], ['body', 'Body'], ['mind', 'Mind'], ['spirit', 'Spirit'], ['social', 'Social'],
                           ['magic', 'Magic'], ['mastery', 'Specialty Masteries'], ['cross', 'Cross-Specialty']];

// A Feat slot can hold a Feat id, a further Specialty as "specialty:<id>", or a further Role as "role:<id>".
const SPECIALTY_SLOT = 'specialty:';
const ROLE_SLOT = 'role:';
export const slotSpecialty = value => (typeof value === 'string' && value.startsWith(SPECIALTY_SLOT) ? value.slice(SPECIALTY_SLOT.length) : null);
export const slotRole = value => (typeof value === 'string' && value.startsWith(ROLE_SLOT) ? value.slice(ROLE_SLOT.length) : null);

// The free Specialty (c.specialties), plus any taken in a Feat slot.
export function specialtiesHeld(D, c, level = c.level) {
  const ids = (c.specialties || []).filter(s => s && s.id && (s.level || 1) <= level).map(s => s.id);
  for (const [, f] of byLevel(c.feats, level)) if (slotSpecialty(f)) ids.push(slotSpecialty(f));
  return [...new Set(ids)].map(id => D.specialtiesById.get(id)).filter(Boolean);
}

// Feats in the character's slots, the Stepped Feat taken instead of a free Specialty, and the Level 17 Capstone.
export function featsTaken(D, c, level = c.level) {
  const out = byLevel(c.feats, level).map(([, f]) => f).filter(f => f && !slotSpecialty(f) && !slotRole(f));
  if (c.bonusFeat) out.push(c.bonusFeat);
  if (c.capstone && level >= D.core.advancement.capstone.level) out.push(c.capstone);
  return out;
}

// The Steps of a Stepped Feat or a Specialty that have arrived by a level.
export const stepsAt = (record, level) => (record.steps || []).filter(s => s.level <= level);

// What a Feat does now: its latest Step's words, or for a Gated Feat its own.
export function featNow(f, level) {
  const step = stepsAt(f, level).pop();
  if (!step || /^As written above/.test(step.text)) return f.at_the_table || f.text;
  return step.text;
}

// Gated Feats wait for Level 11. Stepped Feats fit every slot.
export const slotAccepts = (D, level, feat) => feat.kind !== 'gated' || level >= D.core.advancement.gated_from_level;

// Things in a save that the rules no longer allow. The builder keeps them and says so.
export function featProblems(D, c) {
  const out = [];
  for (const [lv, f] of byLevel(c.feats, c.level)) {
    const feat = D.featsById.get(f);
    if (feat && !slotAccepts(D, Number(lv), feat)) out.push(`Level ${lv}: ${feat.name} is a Gated Feat, available from Level ${D.core.advancement.gated_from_level}.`);
  }
  for (const s of (c.specialties || []).slice(1)) {
    const name = D.specialtiesById.get(s.id)?.name;
    if (name) out.push(`${name}: a further Specialty needs a Feat slot, and no slot is open.`);
  }
  return out;
}

// Everything a requirement check needs to know about the character at a level.
export function requirementContext(D, c, level) {
  const scores = abilityScores(D, c, level);
  const skills = {};
  for (const s of D.skills) skills[s.id] = skillRank(D, c, s.id, level);
  return {
    scores, skills, focus: focusInfo(D, c, level).focus, roles: roleSteps(D, c, level),
    feats: new Set(featsTaken(D, c, level - 1)), genres: enabledGenres(D, c), powerLevel: tierFor(D, level).power_level,
    reputation: reputation(D, c), specialties: new Set(specialtiesHeld(D, c, level).map(s => s.id)),
    specialtyCategories: new Set(specialtiesHeld(D, c, level).map(s => s.category)),
  };
}

// Check one requirement clause. Returns true, false, or null (a clause written in words the builder cannot check).
export function checkClause(clause, ctx) {
  const results = [];
  for (const [key, val] of Object.entries(clause)) {
    switch (key) {
      case 'ability': results.push(val.some(a => ctx.scores[a] >= clause.min)); break;
      case 'skill': results.push((ctx.skills[val] || 0) >= clause.rank_min); break;
      case 'focus': results.push(clause.all ? val.every(s => ctx.focus.has(s)) : val.some(s => ctx.focus.has(s))); break;
      case 'role': results.push(val.some(r => (ctx.roles[r] || 0) >= clause.step)); break;
      case 'feat': results.push(val.some(f => ctx.feats.has(f))); break;
      case 'genre': results.push(val.some(g => ctx.genres.has(g))); break;
      case 'power_level_min': results.push(ctx.powerLevel >= val); break;
      case 'reputation_min': results.push(ctx.reputation >= val); break;
      case 'specialty': results.push(val.some(s => ctx.specialties.has(s))); break;
      case 'specialty_category': results.push(ctx.specialtyCategories.has(val)); break;
      case 'any': {
        const r = val.map(sub => checkClause(sub, ctx));
        results.push(r.includes(true) ? true : r.includes(null) ? null : false);
        break;
      }
      case 'text': results.push(null); break;
      default: break;  // min, rank_min, step, all, note: read with their clause
    }
  }
  return results.includes(false) ? false : results.includes(null) ? null : true;
}

// { ok: true | false | null, failed: [clauses], unknown: [clauses] }
export function checkRequirements(clauses, ctx) {
  const failed = [];
  const unknown = [];
  for (const cl of clauses || []) {
    const r = checkClause(cl, ctx);
    if (r === false) failed.push(cl);
    if (r === null) unknown.push(cl);
  }
  return { ok: failed.length ? false : unknown.length ? null : true, failed, unknown };
}

// ---------------------------------------------------------------------------------------------------------------
// Defenses, costs, standing
// ---------------------------------------------------------------------------------------------------------------

// The tier bonus is on top: see deflectFor.
export function deflect(scores, domain) {
  return 10 + scores[SLOT_ABILITY[domain].deflect];
}

// The Boon Menu at a level: Tempo opens at Seasoned.
export const boonMenu = (D, level) => D.core.boon_menu.filter(b => b.id !== 'tempo' || level >= 5);

// One hit crosses at most this many boxes, after armor. Each Surge box raises it for that hit.
export const hitCap = (D, level, surge = 0) => tierFor(D, level).hit_cap + surge;

// Bonus added to d20 for a roll with an Ability Score: the Score plus its Domain's Mastery bonus.
export function rollBonus(D, scores, ability) {
  return scores[ability] + domainMastery(D, scores)[DOMAIN_OF[ability]];
}

export function initiativeBonus(D, c, level = c.level) {
  const scores = abilityScores(D, c, level);
  const ability = SLOT_ABILITY[primaryDomain(c)].deflect;
  return rollBonus(D, scores, ability) + gearRollBonus(D, c, ability);
}

// Enhancements to Defend or Deflect: "defend" / "deflect" cover all three Domains, "defend:mind" one Domain.
const domainEnh = (c, kind, domain) => {
  const enh = enhancements(c);
  return Math.max(enh[kind] || 0, enh[`${kind}:${domain}`] || 0);
};

// Defend roll for a Domain: Defend Ability + Domain Mastery + Defend Enhancement + gear on the Ability.
export function defendBonus(D, c, domain) {
  const scores = abilityScores(D, c);
  const ability = SLOT_ABILITY[domain].defend;
  return rollBonus(D, scores, ability) + domainEnh(c, 'defend', domain) + gearRollBonus(D, c, ability);
}

// Deflect threshold for a Domain: 10 + Deflect Ability + tier bonus + a Deflect Enhancement. Armor does not change
// it: DR comes off the damage instead.
export function deflectFor(D, c, domain, level = c.level) {
  return deflect(abilityScores(D, c, level), domain) + tierFor(D, level).deflect_bonus + domainEnh(c, 'deflect', domain);
}

// Mana for a Power: the Roles with the Level Discount pay Power Level - (Level / 6, rounded down), minimum 1; others
// pay in full.
export function levelDiscount(D, level) {
  return Math.floor(level / D.core.level_discount.divisor);
}

export function powerCost(D, powerLevel, level, discounted) {
  return discounted ? Math.max(1, powerLevel - levelDiscount(D, level)) : powerLevel;
}

export function hasLevelDiscount(D, c, level = c.level) {
  const steps = roleSteps(D, c, level);
  return D.core.level_discount.roles.some(r => (steps[r] || 0) >= 1);
}

// A Maneuver's cost after the tier's Mastery Floor (Seasoned: 1-cost free, ... Legendary: all free).
export function maneuverCost(D, level, cost) {
  const free = tierFor(D, level).mastery_floor_free_up_to;
  return free === 'all' || cost <= free ? 0 : cost;
}

// Conditions marked on the sheet. The appendix's supernatural conditions stay in the data as GM reference.
export const playConditions = (D, positive) => D.conditions.filter(x => !x.supernatural && x.positive === positive);

// ---------------------------------------------------------------------------------------------------------------
// Powers. A made Power: { name, source, reach, targets, duration, impact, force, effect, notes } with upgrade ids from
// D.powers.upgrades. A listed spell: { spell, notes }.
// ---------------------------------------------------------------------------------------------------------------

const upgradePL = (list, id) => list.find(o => o.id === id)?.pl || 0;

// Power Level 1, +1 per upgrade. Above 5 the player cuts an upgrade; rawLevel keeps the sum for the warning.
export function madePowerLevel(D, p) {
  const u = D.powers.upgrades;
  return 1 + upgradePL(u.reach, p.reach) + upgradePL(u.targets, p.targets) + upgradePL(u.duration, p.duration)
    + upgradePL(u.impact, p.impact) + (p.force || 0);
}

// Casters may use Powers up to Character Level + 1, to a maximum of 5.
export const maxPowerLevel = level => Math.min(5, level + 1);

// A practitioner's Attack Ability + Cast or Channel rank totals 3 or more: Basic Casts and cantrips are free. Those
// skills only exist with the Magic Genre on.
export function isPractitioner(D, c, level = c.level) {
  const scores = abilityScores(D, c, level);
  const on = new Set(availableSkills(D, c).map(s => s.id));
  const attack = s => (s === 'channel' ? scores.bel : Math.max(scores.int, scores.bel));
  return ['cast-attack', 'cast-defend', 'cast-utility', 'channel'].filter(s => on.has(s))
    .some(s => attack(s) + skillRank(D, c, s, level) >= 3);
}

function manaFor(D, c, powerLevel, cantrip) {
  if (cantrip && isPractitioner(D, c)) return { mana: 0, discounted: false, cantrip: true };
  const discount = hasLevelDiscount(D, c);
  const mana = powerCost(D, powerLevel, c.level, discount);
  return { mana, discounted: discount && mana < powerLevel, cantrip: false };
}

export function madePowerSummary(D, c, p) {
  const rawLevel = madePowerLevel(D, p);
  const powerLevel = Math.min(5, rawLevel);
  const cantrip = powerLevel === 1 && p.reach === 'touch';
  return { rawLevel, powerLevel, over: rawLevel > 5, ...manaFor(D, c, powerLevel, cantrip) };
}

// A Step of a spell: { level, pl, reach, targets, ... }. A cantrip is PL 1 on one target or yourself at Touch or Close;
// the utility tricks that reach Near or sense an area say "Free for casters as a Cantrip" in their text.
export function spellStepSummary(D, c, step) {
  const cantrip = step.pl === 1 && (/Free for casters as a Cantrip/.test(step.text)
    || (/^(Touch|Close|Self)$/.test(step.reach) && /^(One\b|You$)/.test(step.targets)));
  return { powerLevel: step.pl, ...manaFor(D, c, step.pl, cantrip) };
}

// ---------------------------------------------------------------------------------------------------------------
// Gear and items
// ---------------------------------------------------------------------------------------------------------------

export const qualityBonus = (D, id) => D.gear.quality.find(q => q.id === id)?.weapon_bonus ?? 0;

// Enhancement items: the highest one for each roll counts (they do not stack with each other). Keys:
// 'attack', 'defend', 'deflect', 'skill:<id>', 'ability:<id>'.
export function enhancements(c) {
  const out = {};
  for (const it of c.items || []) {
    if (it.template !== 'enhancement' || !it.appliesTo || !(it.rating > 0)) continue;
    out[it.appliesTo] = Math.max(out[it.appliesTo] || 0, it.rating);
  }
  return out;
}

// Worn armor from its type: { name, dr, agilityPenalty } or null.
export function armorStats(D, armor) {
  const t = D.gear.armor_types.find(x => x.id === armor?.type);
  if (!t) return null;
  return { name: armor.name || `${t.name} armor`, dr: t.dr, agilityPenalty: t.agility_penalty };
}

// Armor, shield, Defender Steps and Ward items (all DR count). DR comes off Stamina damage.
// The Ascetic gains no benefit and no penalty from armor.
export function armorInfo(D, c, level = c.level) {
  const ascetic = (roleSteps(D, c, level).ascetic || 0) >= 1;
  const armor = ascetic ? null : armorStats(D, c.armor);
  const shield = D.gear.shields.find(s => s.id === c.shield);
  const steps = roleSteps(D, c, level).defender || 0;
  const parts = [];
  if (armor?.dr) parts.push([armor.name, armor.dr]);
  if (shield?.dr) parts.push([shield.name, shield.dr]);
  if (steps >= 1) parts.push(['Defender', steps >= 4 ? 2 : 1]);
  for (const it of c.items || []) {
    if (it.template === 'ward' && it.appliesTo === 'dr' && it.rating > 0) parts.push([it.name || 'Ward', it.rating]);
  }
  return { armor, shield, parts, dr: sum(parts.map(p => p[1])), agilityPenalty: armor?.agilityPenalty || 0, ascetic };
}

// What gear adds to a roll made with an Ability Score (and, optionally, a skill): skill Enhancements and the armor's
// Agility penalty on Agility rolls. (Ability Score Enhancements are already in the Score; see abilityScores.)
export function gearRollBonus(D, c, ability, skill = null) {
  const enh = enhancements(c);
  let bonus = skill ? enh[`skill:${skill}`] || 0 : 0;
  if (ability === 'agi') bonus += armorInfo(D, c).agilityPenalty;
  return bonus;
}

// A weapon attack: d20 + Strength (melee) or Agility (ranged) + Combat skill rank + Domain Mastery + quality
// + Enhancements (items stack with weapon quality).
export function weaponAttack(D, c, w) {
  const scores = abilityScores(D, c);
  const ability = w.kind === 'ranged' ? 'agi' : 'str';
  const skill = w.kind === 'ranged' ? 'combat-ranged' : 'combat-melee';
  const enh = enhancements(c);
  return {
    ability, skill,
    total: rollBonus(D, scores, ability) + skillRank(D, c, skill) + qualityBonus(D, w.quality)
      + (enh.attack || 0) + gearRollBonus(D, c, ability, skill),
  };
}

// A Basic Cast with an implement: d20 + the best Attack Ability for Cast (Intellect or Belief) + the best of the
// character's Cast (Attack) / Channel ranks + Domain Mastery + implement quality.
export function basicCast(D, c, implement) {
  const scores = abilityScores(D, c);
  const ability = scores.bel > scores.int ? 'bel' : 'int';
  const skill = ['cast-attack', 'channel'].reduce((best, s) => (skillRank(D, c, s) > skillRank(D, c, best) ? s : best), 'cast-attack');
  return { ability, skill, total: rollBonus(D, scores, ability) + skillRank(D, c, skill)
    + qualityBonus(D, implement?.quality) + gearRollBonus(D, c, ability, skill) };
}

// Gear above the character's Wealth ceiling needs a story reason or a Wealth check.
export function overWealth(D, c, qualityId) {
  const q = D.gear.quality.find(x => x.id === qualityId);
  const wealth = c.wealth ?? startingWealth(D, c);
  return q ? q.min_wealth_tier > wealth : false;
}

export function armorOverWealth(D, c, typeId) {
  const t = D.gear.armor_types.find(x => x.id === typeId);
  return t ? t.min_wealth_tier > (c.wealth ?? startingWealth(D, c)) : false;
}

// Cash on Hand = Wealth Tier × the tier's multiplier (stored as "x8").
export const cashOnHand = (D, wealth) => wealth * Number(D.core.wealth_tiers[wealth - 1].cash_on_hand.slice(1));

export function startingWealth(D, c) {
  const apt = D.aptitudesById.get(c.aptitude);
  return apt?.starting_wealth ?? D.core.creation.starting_wealth;
}

export function reputation(D, c) {
  if (Number.isInteger(c.reputation)) return c.reputation;
  const apt = D.aptitudesById.get(c.aptitude);
  const origin = D.originsById.get(c.origin);
  return Math.max(D.core.creation.starting_reputation, apt?.starting_reputation || 0, origin?.starting_reputation || 0);
}

// Power Sources: Physical always, plus defaults from Focus Skills (Cast -> Arcane, Channel -> Spirit), plus any the
// player declared.
export function powerSources(D, c) {
  const { focus } = focusInfo(D, c);
  const out = new Set(['physical']);
  for (const s of D.powers.sources) {
    if ((s.default_from_focus || []).some(f => focus.has(f))) out.add(s.id);
  }
  for (const s of c.powerSources || []) out.add(s);
  return [...out];
}
