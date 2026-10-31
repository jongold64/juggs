// Old ids in saved characters and what they are called now. clean() in character.js runs these first, so characters
// saved before the Lite rules still load. Anything with no new home is simply dropped by clean().

export const SKILLS = { pilot: 'operate', language: 'knowledge', tactics: 'analyze', inspire: 'lead', resist: 'concentrate',
                        heal: 'channel' };
export const SPECIALTIES = { skirmisher: 'sharpshooter', shaper: 'weaver', empath: 'martyr', infiltrator: 'chameleon' };
export const APTITUDES = { duelist: 'weapon-master', polymath: 'jack-of-all-trades' };

export const CONDITIONS = { dazed: 'stunned', routed: 'frightened', fascinated: 'charmed', exhausted: 'weakened',
                            enfeebled: 'weakened', sickened: 'weakened', concealed: 'hidden', invisible: 'hidden',
                            quickened: 'hasted', focused: 'inspired', rallied: 'inspired' };
export const EFFECTS = { gravity: 'force', concussive: 'sonic', nature: 'earth' };

// The Feats that bought Specialty Abilities are gone (they arrive by tier now); the four Surge Disciplines are one Feat.
const DROPPED_FEATS = new Set(['specialty-ability-2', 'specialty-ability-3', 'specialty-mastery-enhancement']);
const SURGE_DISCIPLINES = new Set(['surge-discipline-1', 'surge-discipline-2', 'surge-discipline-3', 'surge-discipline-4']);

export const SOURCES = { weird: 'weird-science' };
// Example Powers from the old Player Book list, now spells.
const EXAMPLE_SPELLS = { mend: 'mend-wounds', 'untitled-psionic-power': 'telepathy' };
const OLD_REACH = { close: 'touch', near: 'near', far: 'far', sight: 'distant', anywhere: 'anywhere' };
const OLD_TARGETS = { single: 'one', line: 'several', cone: 'several', burst: 'several', 'multi-3': 'several', 'multi-6': 'several' };
const OLD_DURATION = { instant: 'instant', rounds: 'scene', concentration: 'scene', minutes: 'scene', 'ten-minutes': 'hours', hours: 'hours' };

const rename = (map, id) => map[id] ?? id;
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);

// A merged skill can land on one already in the list: keep the first and empty the slot, so the point or pick is free
// to spend again.
function renameSkills(list) {
  if (!list.some(s => s in SKILLS)) return list;
  const seen = new Set();
  return list.map(s => {
    const id = rename(SKILLS, s);
    if (id && seen.has(id)) return '';
    seen.add(id);
    return id;
  });
}

// A Power from the old point-budget builder or example list. What the new table cannot hold goes in its notes.
function migratePower(p) {
  if (p.example) return { spell: rename(EXAMPLE_SPELLS, p.example), notes: p.notes || '' };
  if (p.range === undefined) return p;
  const conditions = (Array.isArray(p.conditions) ? p.conditions : []).map(x => rename(CONDITIONS, x));
  const old = [conditions.length ? `Conditions: ${conditions.join(', ')}` : '', p.summon ? `Summon: ${p.summon}` : '',
               p.focusItem ? 'Focus Item' : '', p.entityBlessing ? 'Entity Blessing' : ''].filter(Boolean).join('; ');
  return { name: p.name, source: rename(SOURCES, p.source), reach: OLD_REACH[p.range], targets: OLD_TARGETS[p.targets],
           duration: OLD_DURATION[p.duration], impact: conditions.length > 1 ? 'major' : 'none', force: 0,
           effect: rename(EFFECTS, p.effect), notes: [p.notes, old && `From the old builder: ${old}.`].filter(Boolean).join(' ') };
}

function migrateFeats(feats) {
  const out = {};
  let discipline = false;
  for (const lv of Object.keys(feats).sort((a, b) => a - b)) {
    const f = feats[lv];
    if (DROPPED_FEATS.has(f)) continue;
    if (SURGE_DISCIPLINES.has(f)) {
      if (!discipline) out[lv] = 'surge-discipline';
      discipline = true;
    } else out[lv] = f;
  }
  return out;
}

// A further Specialty now needs a Feat slot. An old free second Specialty takes the first open slot from the level it
// was taken, then any open slot; with none open it stays where it is and the builder warns.
function moveSpecialties(c, featLevels) {
  if (!Array.isArray(c.specialties) || c.specialties.length < 2 || !isObj(c.feats)) return;
  const level = Number.isInteger(c.level) ? c.level : 1;
  const kept = c.specialties.slice(0, 1);
  for (const s of c.specialties.slice(1)) {
    const open = featLevels.filter(lv => lv <= level && !c.feats[lv]);
    const slot = open.find(lv => lv >= (s?.level || 1)) ?? open[open.length - 1];
    if (slot && s?.id) c.feats[slot] = `specialty:${s.id}`; else kept.push(s);
  }
  c.specialties = kept;
}

export function migrate(raw, featLevels = []) {
  if (!isObj(raw)) return raw;
  const c = { ...raw };
  if (Array.isArray(c.focus)) c.focus = renameSkills(c.focus);
  if (Array.isArray(c.aptitudeSkills)) c.aptitudeSkills = renameSkills(c.aptitudeSkills);
  if (Array.isArray(c.overlapPicks)) c.overlapPicks = c.overlapPicks.map(s => rename(SKILLS, s));
  if (isObj(c.skillPoints)) {
    c.skillPoints = Object.fromEntries(Object.entries(c.skillPoints)
      .map(([lv, list]) => [lv, Array.isArray(list) ? renameSkills(list) : list]));
  }
  if (Array.isArray(c.items)) {
    c.items = c.items.map(it => (isObj(it) && typeof it.appliesTo === 'string' && it.appliesTo.startsWith('skill:')
      ? { ...it, appliesTo: `skill:${rename(SKILLS, it.appliesTo.slice(6))}` } : it));
  }
  if (isObj(c.play) && Array.isArray(c.play.conditions)) {
    c.play = { ...c.play, conditions: [...new Set(c.play.conditions.map(x => rename(CONDITIONS, x)))] };
  }
  if (isObj(c.signature)) {
    c.signature = { offensive: rename(EFFECTS, c.signature.offensive), utility: rename(EFFECTS, c.signature.utility) };
  }
  if (Array.isArray(c.weapons)) c.weapons = c.weapons.map(w => (isObj(w) ? { ...w, effect: rename(EFFECTS, w.effect) } : w));
  if (Array.isArray(c.powers)) {
    c.powers = c.powers.map(p => (isObj(p) ? migratePower(p) : p));
  }
  if (Array.isArray(c.powerSources)) c.powerSources = c.powerSources.map(s => rename(SOURCES, s));
  c.aptitude = rename(APTITUDES, c.aptitude);
  if (Array.isArray(c.specialties)) {
    c.specialties = c.specialties.map(s => (isObj(s) ? { ...s, id: rename(SPECIALTIES, s.id) } : s));
  }
  if (isObj(c.feats)) c.feats = migrateFeats(c.feats);
  moveSpecialties(c, featLevels);
  if (typeof c.originChoice === 'string') c.originChoice = c.originChoice.replace('(+1 Tactics)', '(+1 Analyze)');
  return c;
}
