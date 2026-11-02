// The saved character: what the player chose, never what is calculated from it. clean() fills in missing fields
// and drops unknown ids, so characters saved by older versions (or edited by hand) still load.
import { migrate } from './migrate.js';

export const VERSION = 3;

export function newCharacter() {
  return {
    version: VERSION,
    name: '', player: '', concept: '', level: 1,
    genres: [],                 // Genre ids switched on for the campaign
    base: { str: 3, tou: 2, agi: 2, int: 2, wil: 2, acu: 2, bel: 3, mor: 2, ser: 2 },  // 20 Build Points
    primaryDomain: '',          // only used to break a tie in Build Points
    governing: '',              // the governing Ability Score (higher cap)
    aptitude: '', aptitudeSkills: [],   // aptitudeSkills: the two picks for Jack-of-All-Trades
    origin: '', originChoice: '',
    focus: [],                  // the 6 chosen Focus Skills
    overlapPicks: [],           // +1 skill for each bonus skill that was already a Focus Skill
    role: '',                   // the free Role; a further Role sits in a Feat slot
    specialties: [],            // [{ id, level }] — the free one; any further Specialty sits in a Feat slot
    abilityIncreases: {},       // even level -> Ability Score id
    skillPoints: {},            // level -> [skill ids], 6 per level from Level 2
    bonusFeat: '',              // a Stepped Feat taken instead of the free Specialty
    feats: {},                  // Feat level -> Feat id, "specialty:<id>" or "role:<id>"
    capstone: '', capstoneNote: '',     // Level 17: a free Gated Feat and a scene-level capability
    signature: { offensive: '' },
    powerSources: [],           // declared beyond Physical and the Focus Skill defaults
    powers: [],                 // Powers made or listed in the Powers tab (see the Powers section of rules.js)
    weapons: [],                // [{ name, quality, kind: 'melee' | 'ranged', effect, notes }]
    implements: [],             // [{ name, quality, notes }] — a caster's focus
    armor: null,                // { type, name } — see rules.js armorStats
    shield: '',                 // id in data/gear.json shields
    items: [],                  // [{ name, template, rating, appliesTo, descriptors, genre, notes }]
    wealth: null, reputation: null,     // null = the starting default
    languages: '', gear: '', notes: '',
    play: { marked: { stamina: 0, mana: 0, resolve: 0 }, conditions: [],
            trackers: { corruption: 0, fear: 0, morale: 0, sanity: 0 } },
  };
}

const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
const str = (x, d = '') => (typeof x === 'string' ? x : d);
const int = (x, d, lo, hi) => (Number.isInteger(x) ? Math.min(hi, Math.max(lo, x)) : d);

// Keep entries whose key is a level 1-20 and whose value passes `ok`.
function levelMap(x, ok) {
  const out = {};
  if (!isObj(x)) return out;
  for (const [k, v] of Object.entries(x)) {
    const lv = Number(k);
    if (Number.isInteger(lv) && lv >= 1 && lv <= 20 && ok(v)) out[lv] = v;
  }
  return out;
}

export function newPower() {
  return { name: '', source: '', reach: 'near', targets: 'one', duration: 'instant', impact: 'none', force: 0, effect: '', notes: '' };
}

// One Power: a listed spell, or a made Power whose unknown upgrade ids fall back to the free option.
export function cleanPower(D, raw) {
  if (D.spellsById.has(raw.spell)) return { spell: raw.spell, notes: str(raw.notes).slice(0, 500) };
  const u = D.powers.upgrades;
  const p = newPower();
  const pick = (list, id, d) => (list.some(o => o.id === id) ? id : d);
  p.name = str(raw.name).slice(0, 80);
  p.source = D.sourcesById.has(raw.source) ? raw.source : '';
  p.reach = pick(u.reach, raw.reach, 'near');
  p.targets = pick(u.targets, raw.targets, 'one');
  p.duration = pick(u.duration, raw.duration, 'instant');
  p.impact = pick(u.impact, raw.impact, 'none');
  p.force = int(raw.force, 0, 0, 4);
  p.effect = D.effectsById.has(raw.effect) ? raw.effect : '';
  p.notes = str(raw.notes).slice(0, 500);
  return p;
}

// What an item can apply to: Enhancements name a roll, Wards give DR (other Ward kinds are written in notes).
export function itemTargets(D) {
  return [
    { value: 'attack', label: 'Attack rolls' },
    { value: 'defend', label: 'Defend rolls (all)' },
    ...['body', 'mind', 'spirit'].map(d => ({ value: `defend:${d}`, label: `Defend (${d[0].toUpperCase()}${d.slice(1)})` })),
    { value: 'deflect', label: 'Deflect (all)' },
    ...['body', 'mind', 'spirit'].map(d => ({ value: `deflect:${d}`, label: `Deflect (${d[0].toUpperCase()}${d.slice(1)})` })),
    ...D.abilities.abilities.map(a => ({ value: `ability:${a.id}`, label: `${a.name} rolls` })),
    ...D.skills.map(s => ({ value: `skill:${s.id}`, label: s.name })),
  ];
}

// Worn armor: { type, name } or null. Older saves stored the id of a named armor, or a weight and a quality; those
// become the nearest type.
export function cleanArmor(D, raw) {
  if (typeof raw === 'string' && raw) {
    const old = D.gear.armor_examples.find(a => a.id === raw);
    if (!old || !old.dr) return null;
    const type = old.agility_penalty <= -2 ? 'heavy' : old.agility_penalty === -1 ? 'medium'
      : old.dr >= 5 ? 'legendary' : old.dr >= 4 ? 'powered' : 'light';
    return { type, name: old.name.replace(/\s*\(.*\)$/, '') };
  }
  if (!isObj(raw)) return null;
  const type = raw.type ?? (raw.quality === 'legendary' ? 'legendary' : raw.quality === 'masterwork' ? 'powered' : raw.weight);
  if (!D.gear.armor_types.some(t => t.id === type)) return null;
  return { type, name: str(raw.name).slice(0, 80) };
}

export function newItem() {
  return { name: '', template: 'enhancement', rating: 1, appliesTo: '', descriptors: [], genre: '', notes: '' };
}

export function cleanItem(D, raw) {
  const it = newItem();
  it.name = str(raw.name).slice(0, 80);
  it.template = D.items.templates.some(t => t.id === raw.template) ? raw.template : 'enhancement';
  const rated = D.items.templates.find(t => t.id === it.template).has_rating;
  it.rating = rated ? int(raw.rating, 1, 1, 5) : null;
  const targets = it.template === 'ward' ? ['dr'] : it.template === 'enhancement' ? itemTargets(D).map(t => t.value) : [];
  it.appliesTo = targets.includes(raw.appliesTo) ? raw.appliesTo : (it.template === 'ward' ? 'dr' : '');
  it.descriptors = Array.isArray(raw.descriptors)
    ? [...new Set(raw.descriptors.filter(d => D.items.descriptors.some(x => x.id === d)))] : [];
  it.genre = D.genresById.has(raw.genre) ? raw.genre : '';
  it.notes = str(raw.notes).slice(0, 500);
  return it;
}

export function clean(D, raw) {
  const d = newCharacter();
  if (!isObj(raw)) return d;
  raw = migrate(raw, D.core.advancement.feat_levels);
  const has = (map, id) => typeof id === 'string' && map.has(id);
  const c = d;
  c.name = str(raw.name); c.player = str(raw.player); c.concept = str(raw.concept);
  c.level = int(raw.level, 1, 1, 20);
  c.genres = Array.isArray(raw.genres) ? [...new Set(raw.genres.filter(g => has(D.genresById, g)))] : [];
  if (isObj(raw.base)) for (const a of Object.keys(d.base)) c.base[a] = int(raw.base[a], d.base[a], 0, 20);
  c.primaryDomain = ['body', 'mind', 'spirit'].includes(raw.primaryDomain) ? raw.primaryDomain : '';
  c.governing = has(D.abilitiesById, raw.governing) ? raw.governing : '';
  c.aptitude = has(D.aptitudesById, raw.aptitude) ? raw.aptitude : '';
  c.aptitudeSkills = Array.isArray(raw.aptitudeSkills) ? raw.aptitudeSkills.map(s => (has(D.skillsById, s) ? s : '')).slice(0, 2) : [];
  c.origin = has(D.originsById, raw.origin) ? raw.origin : '';
  c.originChoice = str(raw.originChoice);
  c.focus = Array.isArray(raw.focus) ? raw.focus.map(s => (has(D.skillsById, s) ? s : '')).slice(0, 6) : [];
  c.overlapPicks = Array.isArray(raw.overlapPicks) ? raw.overlapPicks.map(s => (has(D.skillsById, s) ? s : '')) : [];
  c.role = has(D.rolesById, raw.role) ? raw.role : '';
  c.specialties = Array.isArray(raw.specialties)
    ? raw.specialties.filter(s => isObj(s) && has(D.specialtiesById, s.id))
      .map(s => ({ id: s.id, level: int(s.level, 1, 1, 20) })).slice(0, 2)
    : [];
  c.abilityIncreases = levelMap(raw.abilityIncreases, a => has(D.abilitiesById, a));
  c.skillPoints = levelMap(raw.skillPoints, v => Array.isArray(v));
  for (const lv of Object.keys(c.skillPoints)) {
    c.skillPoints[lv] = c.skillPoints[lv].map(s => (has(D.skillsById, s) ? s : '')).slice(0, 6);
  }
  c.feats = levelMap(raw.feats, f => has(D.featsById, f)
    || (typeof f === 'string' && f.startsWith('specialty:') && has(D.specialtiesById, f.slice(10)))
    || (typeof f === 'string' && f.startsWith('role:') && has(D.rolesById, f.slice(5))));
  c.bonusFeat = !c.specialties.length && D.featsById.get(raw.bonusFeat)?.kind === 'stepped' ? raw.bonusFeat : '';
  c.capstone = D.featsById.get(raw.capstone)?.kind === 'gated' ? raw.capstone : '';
  c.capstoneNote = str(raw.capstoneNote).slice(0, 500);
  if (isObj(raw.signature)) {
    const sig = raw.signature.offensive;   // an Effect id or a Maneuver id
    c.signature.offensive = has(D.effectsById, sig) || has(D.maneuversById, sig) ? sig : '';
  }
  c.powerSources = Array.isArray(raw.powerSources) ? raw.powerSources.filter(s => has(D.sourcesById, s)) : [];
  c.powers = Array.isArray(raw.powers) ? raw.powers.filter(isObj).map(p => cleanPower(D, p)).slice(0, 100) : [];
  const quality = q => (D.gear.quality.some(x => x.id === q) ? q : 'standard');
  c.weapons = Array.isArray(raw.weapons) ? raw.weapons.filter(isObj).slice(0, 30).map(w => ({
    name: str(w.name).slice(0, 80), quality: quality(w.quality), kind: w.kind === 'ranged' ? 'ranged' : 'melee',
    effect: D.effectsById.has(w.effect) ? w.effect : '', notes: str(w.notes).slice(0, 300),
  })) : [];
  c.implements = Array.isArray(raw.implements) ? raw.implements.filter(isObj).slice(0, 10).map(w => ({
    name: str(w.name).slice(0, 80), quality: quality(w.quality), notes: str(w.notes).slice(0, 300),
  })) : [];
  c.armor = cleanArmor(D, raw.armor);
  c.shield = D.gear.shields.some(s => s.id === raw.shield) ? raw.shield : '';
  c.items = Array.isArray(raw.items) ? raw.items.filter(isObj).slice(0, 60).map(it => cleanItem(D, it)) : [];
  c.wealth = raw.wealth === null ? null : int(raw.wealth, null, 1, 8);
  c.reputation = raw.reputation === null ? null : int(raw.reputation, null, 0, 5);
  c.languages = str(raw.languages); c.gear = str(raw.gear); c.notes = str(raw.notes);
  if (isObj(raw.play)) {
    const p = raw.play;
    if (isObj(p.marked)) for (const k of Object.keys(d.play.marked)) c.play.marked[k] = int(p.marked[k], 0, 0, 40);
    c.play.conditions = Array.isArray(p.conditions) ? p.conditions.filter(x => has(D.conditionsById, x)) : [];
    if (isObj(p.trackers)) {
      for (const k of Object.keys(d.play.trackers)) c.play.trackers[k] = int(p.trackers[k], 0, 0, 5);
    }
  }
  return c;
}
