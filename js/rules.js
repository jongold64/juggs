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

// Ability Scores at a level: 20 BP spread + Aptitude bonuses + even-level increases, plus Ability Score
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
  return ability === c.governing ? tier.governing_ability_cap : tier.other_ability_cap;
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
      out.push(`${name} can be at most ${cr.ability_max_with_bonuses} with the Aptitude bonus.`);
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

// Domain Mastery: +1 / +2 / +3 when all three Scores in a Domain reach 2 / 4 / 6.
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

// Toughened and Iron Body add boxes that follow the normal growth order; Defender Step 2 adds one Healthy
// Stamina box; Legendary Endurance adds two Stamina boxes at the end of Injured (DECISIONS.md).
export function poolExtras(D, c, level = c.level) {
  const feats = new Set(featsTaken(c, level));
  const steps = roleSteps(D, c, level);
  const extra = { stamina: { grow: 0, healthy: 0, injured: 0 }, mana: { grow: 0, healthy: 0, injured: 0 },
                  resolve: { grow: 0, healthy: 0, injured: 0 } };
  if (feats.has('toughened')) for (const p of Object.values(extra)) p.grow += 1;
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

// Bonus Focus Skills from the Aptitude and Specialties held at a level, with where each came from. A Specialty
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

// Skill Mastery: fixed-DC tasks are 1 easier per rank above 1.
export const skillMastery = rank => Math.max(0, rank - 1);

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

// Role Steps held at a level: { roleId: steps }. The starting Role is Step 1 at Level 1; each tier change adds a
// Step to the Role picked there (a new Role starts at Step 1).
export function roleSteps(D, c, level = c.level) {
  const out = {};
  if (c.role) out[c.role] = 1;
  for (const [lv, r] of byLevel(c.roleAdvances, level)) {
    if (r && isTierChange(D, Number(lv))) out[r] = Math.min(5, (out[r] || 0) + 1);
  }
  return out;
}

export function specialtiesHeld(D, c, level = c.level) {
  return (c.specialties || []).filter(s => s && s.id && (s.level || 1) <= level)
    .map(s => D.specialtiesById.get(s.id)).filter(Boolean);
}

export function featsTaken(c, level = c.level) {
  return byLevel(c.feats, level).map(([, f]) => f).filter(Boolean);
}

// Which Specialty abilities are unlocked: { specialtyId: ['ability1', 'ability2', ...] }.
export function specialtyAbilities(D, c, level = c.level) {
  const out = {};
  for (const sp of specialtiesHeld(D, c, level)) out[sp.id] = ['ability1'];
  for (const [lv, f] of byLevel(c.feats, level)) {
    const feat = D.featsById.get(f);
    const target = c.featChoices?.[lv];
    if (feat?.unlocks && out[target]) out[target].push(feat.unlocks);
  }
  return out;
}

// Feat Ranks A-D (the book's Basic, Advanced, Mastery, Legendary). A slot takes a Feat of its Rank or lower.
export const slotRank = (D, level) => D.core.advancement.feat_slot_max_rank?.[level] || 'A';
export function slotAccepts(D, level, feat) {
  return feat.rank <= slotRank(D, level);
}

// Everything a requirement check needs to know about the character at a level.
export function requirementContext(D, c, level) {
  const scores = abilityScores(D, c, level);
  const skills = {};
  for (const s of D.skills) skills[s.id] = skillRank(D, c, s.id, level);
  return {
    scores, skills, focus: focusInfo(D, c, level).focus, roles: roleSteps(D, c, level),
    feats: new Set(featsTaken(c, level - 1)), genres: enabledGenres(D, c), powerLevel: tierFor(D, level).power_level,
    reputation: reputation(D, c), specialties: specialtyAbilities(D, c, level),
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
      case 'specialty': results.push(val.some(s => s in ctx.specialties)); break;
      case 'specialty_category': results.push(ctx.specialtyCategories.has(val)); break;
      case 'specialty_ability': results.push(Object.values(ctx.specialties).some(list => list.includes(val))); break;
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

export function deflect(scores, domain) {
  return 10 + scores[SLOT_ABILITY[domain].deflect];
}

// Bonus added to d20 for a roll with an Ability Score: the Score plus its Domain's Mastery bonus.
export function rollBonus(D, scores, ability) {
  return scores[ability] + domainMastery(D, scores)[DOMAIN_OF[ability]];
}

export function initiativeBonus(D, c, level = c.level) {
  const scores = abilityScores(D, c, level);
  const ability = SLOT_ABILITY[primaryDomain(c)].deflect;
  return rollBonus(D, scores, ability) + gearRollBonus(D, c, ability);
}

// DR (armor, shield, Defender, Ward items) works through the roll: it adds to the Body Defend roll and the Body
// Deflect number, and is not taken off Stamina damage. Mind and Spirit get a bonus only from items that name them.
export const bodyDR = (D, c, domain) => (domain === 'body' ? armorInfo(D, c).dr : 0);

// Enhancements to Defend or Deflect: "defend" / "deflect" cover all three Domains, "defend:mind" one Domain.
const domainEnh = (c, kind, domain) => {
  const enh = enhancements(c);
  return Math.max(enh[kind] || 0, enh[`${kind}:${domain}`] || 0);
};

// Defend roll for a Domain: Defend Ability + Domain Mastery + DR (Body) + Defend Enhancement + gear on the Ability.
export function defendBonus(D, c, domain) {
  const scores = abilityScores(D, c);
  const ability = SLOT_ABILITY[domain].defend;
  return rollBonus(D, scores, ability) + bodyDR(D, c, domain) + domainEnh(c, 'defend', domain) + gearRollBonus(D, c, ability);
}

// Deflect threshold for a Domain: 10 + Deflect Ability + DR (Body) + a Deflect Enhancement.
export function deflectFor(D, c, domain) {
  return deflect(abilityScores(D, c), domain) + bodyDR(D, c, domain) + domainEnh(c, 'deflect', domain);
}

// Mana for a Power: Casters pay the Power Level minus their tier's Power Level, minimum 1; others pay in full.
export function powerCost(powerLevel, tierPowerLevel, isCaster) {
  return isCaster ? Math.max(1, powerLevel - tierPowerLevel) : powerLevel;
}

// A Maneuver's cost after the tier's Mastery Floor (Seasoned: 1-cost free, ... Legendary: all free).
export function maneuverCost(D, level, cost) {
  const free = tierFor(D, level).mastery_floor_free_up_to;
  return free === 'all' || cost <= free ? 0 : cost;
}

// ---------------------------------------------------------------------------------------------------------------
// Powers (the Spell Builder). A Power spec: { name, source, range, targets, duration, effect, summon,
// conditions: [ids], focusItem, entityBlessing } — option ids from D.powers.builder.
// ---------------------------------------------------------------------------------------------------------------

const optionPoints = (list, id) => list.find(o => o.id === id)?.points || 0;

export function powerPoints(D, p) {
  const b = D.powers.builder;
  let pts = optionPoints(b.range, p.range) + optionPoints(b.targets, p.targets) + optionPoints(b.duration, p.duration)
    + optionPoints(b.summons, p.summon) + Math.min(b.max_conditions, (p.conditions || []).length) * b.condition_points;
  if (p.focusItem && focusItemAllowed(D, p)) pts -= 1;
  return Math.max(0, pts);
}

export const focusItemAllowed = (D, p) =>
  D.powers.builder.modifiers.find(m => m.id === 'focus-item').sources.includes(p.source);

export function powerLevelFor(D, points) {
  return D.powers.builder.power_levels.find(l => points >= l.min && (l.max === null || points <= l.max)).power_level;
}

export const isCaster = (D, c, level = c.level) => (roleSteps(D, c, level).caster || 0) >= 1;

// Anyone with a Cast or Channel skill at rank 2+ casts Cantrips for free.
export function isPractitioner(D, c, level = c.level) {
  return ['cast-attack', 'cast-defend', 'cast-utility', 'channel'].some(s => skillRank(D, c, s, level) >= 2);
}

// { points, powerLevel (what it was built at), effectiveLevel (with Entity Blessing, max 5), mana, discounted }
export function powerSummary(D, c, p) {
  const points = powerPoints(D, p);
  const powerLevel = powerLevelFor(D, points);
  const effectiveLevel = Math.min(5, powerLevel + (p.entityBlessing ? 1 : 0));
  let mana;
  let discounted = false;
  if (powerLevel === 0) {
    mana = isPractitioner(D, c) ? 0 : 1;
  } else {
    const caster = isCaster(D, c);
    mana = powerCost(powerLevel, tierFor(D, c.level).power_level, caster);
    discounted = caster && mana < powerLevel;
  }
  return { points, powerLevel, effectiveLevel, mana, discounted };
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

// Armor, shield, Defender Steps and Ward items (all DR counts). See bodyDR for how DR is used.
export function armorInfo(D, c, level = c.level) {
  const armor = D.gear.armor.find(a => a.id === c.armor);
  const shield = D.gear.shields.find(s => s.id === c.shield);
  const steps = roleSteps(D, c, level).defender || 0;
  const parts = [];
  if (armor?.dr) parts.push([armor.name, armor.dr]);
  if (shield?.dr) parts.push([shield.name, shield.dr]);
  if (steps >= 1) parts.push(['Defender', steps >= 4 ? 2 : 1]);
  for (const it of c.items || []) {
    if (it.template === 'ward' && it.appliesTo === 'dr' && it.rating > 0) parts.push([it.name || 'Ward', it.rating]);
  }
  const ascetic = (roleSteps(D, c, level).ascetic || 0) >= 1;
  return {
    armor, shield, parts, dr: sum(parts.map(p => p[1])),
    // Ascetic gains no benefit (and no penalty) from armor.
    agilityPenalty: ascetic ? 0 : Math.min(0, armor?.agility_penalty || 0),
  };
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
