// Old ids in saved characters and what they are called now. clean() in character.js runs these first, so characters
// saved before the Lite rules still load. Anything with no new home is simply dropped by clean().

export const SKILLS = { pilot: 'operate', language: 'knowledge', tactics: 'analyze', inspire: 'lead', resist: 'concentrate',
                        heal: 'channel' };
export const SPECIALTIES = { skirmisher: 'sharpshooter', shaper: 'weaver', empath: 'martyr', infiltrator: 'chameleon' };
export const APTITUDES = { duelist: 'weapon-master', polymath: 'jack-of-all-trades' };

const rename = (map, id) => map[id] ?? id;
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);

// A merged skill can land on one already in the list: keep the first and empty the slot, so the point or pick is free
// to spend again.
function renameSkills(list) {
  const seen = new Set();
  return list.map(s => {
    const id = rename(SKILLS, s);
    if (id && seen.has(id)) return '';
    seen.add(id);
    return id;
  });
}

export function migrate(raw) {
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
  c.aptitude = rename(APTITUDES, c.aptitude);
  if (Array.isArray(c.specialties)) {
    c.specialties = c.specialties.map(s => (isObj(s) ? { ...s, id: rename(SPECIALTIES, s.id) } : s));
  }
  if (isObj(c.featChoices)) {
    c.featChoices = Object.fromEntries(Object.entries(c.featChoices).map(([lv, s]) => [lv, rename(SPECIALTIES, s)]));
  }
  if (typeof c.originChoice === 'string') c.originChoice = c.originChoice.replace('(+1 Tactics)', '(+1 Analyze)');
  return c;
}
