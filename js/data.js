// Loads data/*.json once and adds lookup maps (D.skillsById and so on). Every module gets the same object.

const FILES = ['core', 'abilities', 'skills', 'genres', 'roles', 'presets', 'aptitudes', 'origins', 'specialties',
               'feats', 'effects', 'conditions', 'powers', 'maneuvers', 'concepts'];

export function prepare(raw) {
  const D = { ...raw };
  const index = list => new Map(list.map(x => [x.id, x]));
  D.abilitiesById = index(raw.abilities.abilities);
  D.domainsById = index(raw.abilities.domains);
  for (const name of ['skills', 'genres', 'roles', 'presets', 'aptitudes', 'origins', 'specialties', 'feats',
                      'effects', 'conditions', 'maneuvers', 'concepts']) {
    D[`${name}ById`] = index(raw[name]);
  }
  D.sourcesById = index(raw.powers.sources);
  return D;
}

export async function loadData(base = 'data/') {
  const entries = await Promise.all(FILES.map(async f => {
    const r = await fetch(`${base}${f}.json`);
    if (!r.ok) throw new Error(`Could not load ${f}.json (${r.status})`);
    return [f, await r.json()];
  }));
  return prepare(Object.fromEntries(entries));
}
