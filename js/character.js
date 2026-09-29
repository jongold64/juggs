// The saved character: what the player chose, never what is calculated from it. clean() fills in missing fields
// and drops unknown ids, so characters saved by older versions (or edited by hand) still load.

export const VERSION = 1;

export function newCharacter() {
  return {
    version: VERSION,
    name: '', player: '', concept: '', level: 1,
    genres: [],                 // Genre ids switched on for the campaign
    base: { str: 3, tou: 2, agi: 2, int: 2, wil: 2, acu: 2, bel: 3, mor: 2, ser: 2 },  // 20 Build Points
    primaryDomain: '',          // only used to break a tie in Build Points
    governing: '',              // the governing Ability Score (higher cap)
    aptitude: '', aptitudeSkills: [],   // aptitudeSkills: the two picks for Polymath
    origin: '', originChoice: '',
    focus: [],                  // the 6 chosen Focus Skills
    overlapPicks: [],           // +1 skill for each bonus skill that was already a Focus Skill
    role: '',                   // starting Role (Step 1 at Level 1)
    roleAdvances: {},           // tier-change level -> Role id (advance it, or start it at Step 1)
    specialties: [],            // [{ id, level }] — the first at Level 1, a second from Level 5
    abilityIncreases: {},       // even level -> Ability Score id
    skillPoints: {},            // level -> [skill ids], 6 per level from Level 2
    feats: {},                  // Feat level -> Feat id
    featChoices: {},            // Feat level -> Specialty id, for the "Specialty: Ability 2/3/Mastery" Feats
    signature: { offensive: '', utility: '' },
    powerSources: [],           // declared beyond Physical and the Focus Skill defaults
    powers: [],                 // Powers built in the Powers tab (see rules.js powerSummary for the fields)
    wealth: null, reputation: null,     // null = the starting default
    languages: '', gear: '', notes: '',
    play: { marked: { stamina: 0, mana: 0, resolve: 0 }, conditions: [], boonTokens: 0,
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
  return { name: '', source: '', range: 'close', targets: 'single', duration: 'instant', effect: '', summon: '',
           conditions: [], focusItem: false, entityBlessing: false, notes: '' };
}

// One Power: unknown option ids fall back to the free option.
export function cleanPower(D, raw) {
  const b = D.powers.builder;
  const p = newPower();
  const pick = (list, id, d) => (list.some(o => o.id === id) ? id : d);
  p.name = str(raw.name).slice(0, 80);
  p.source = D.sourcesById.has(raw.source) ? raw.source : '';
  p.range = pick(b.range, raw.range, 'close');
  p.targets = pick(b.targets, raw.targets, 'single');
  p.duration = pick(b.duration, raw.duration, 'instant');
  p.effect = D.effectsById.has(raw.effect) ? raw.effect : '';
  p.summon = pick(b.summons, raw.summon, '');
  p.conditions = Array.isArray(raw.conditions)
    ? [...new Set(raw.conditions.filter(x => D.conditionsById.has(x)))].slice(0, b.max_conditions) : [];
  p.focusItem = raw.focusItem === true;
  p.entityBlessing = raw.entityBlessing === true;
  p.notes = str(raw.notes).slice(0, 500);
  // A Player Book example Power added at one of its levels.
  const ex = D.powers.examples.find(e => e.id === raw.example);
  if (ex && ex.levels.some(l => l.level === raw.exampleLevel)) {
    p.example = ex.id;
    p.exampleLevel = raw.exampleLevel;
  }
  return p;
}

export function clean(D, raw) {
  const d = newCharacter();
  if (!isObj(raw)) return d;
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
  c.roleAdvances = levelMap(raw.roleAdvances, r => has(D.rolesById, r));
  c.specialties = Array.isArray(raw.specialties)
    ? raw.specialties.filter(s => isObj(s) && has(D.specialtiesById, s.id))
      .map(s => ({ id: s.id, level: int(s.level, 1, 1, 20) })).slice(0, 2)
    : [];
  c.abilityIncreases = levelMap(raw.abilityIncreases, a => has(D.abilitiesById, a));
  c.skillPoints = levelMap(raw.skillPoints, v => Array.isArray(v));
  for (const lv of Object.keys(c.skillPoints)) {
    c.skillPoints[lv] = c.skillPoints[lv].map(s => (has(D.skillsById, s) ? s : '')).slice(0, 6);
  }
  c.feats = levelMap(raw.feats, f => has(D.featsById, f));
  c.featChoices = levelMap(raw.featChoices, s => has(D.specialtiesById, s));
  if (isObj(raw.signature)) {
    for (const k of ['offensive', 'utility']) c.signature[k] = has(D.effectsById, raw.signature[k]) ? raw.signature[k] : '';
  }
  c.powerSources = Array.isArray(raw.powerSources) ? raw.powerSources.filter(s => has(D.sourcesById, s)) : [];
  c.powers = Array.isArray(raw.powers) ? raw.powers.filter(isObj).map(p => cleanPower(D, p)).slice(0, 100) : [];
  c.wealth = raw.wealth === null ? null : int(raw.wealth, null, 1, 8);
  c.reputation = raw.reputation === null ? null : int(raw.reputation, null, 0, 5);
  c.languages = str(raw.languages); c.gear = str(raw.gear); c.notes = str(raw.notes);
  if (isObj(raw.play)) {
    const p = raw.play;
    if (isObj(p.marked)) for (const k of Object.keys(d.play.marked)) c.play.marked[k] = int(p.marked[k], 0, 0, 40);
    c.play.conditions = Array.isArray(p.conditions) ? p.conditions.filter(x => has(D.conditionsById, x)) : [];
    c.play.boonTokens = int(p.boonTokens, 0, 0, 99);
    if (isObj(p.trackers)) {
      for (const k of Object.keys(d.play.trackers)) c.play.trackers[k] = int(p.trackers[k], 0, 0, 5);
    }
  }
  return c;
}
