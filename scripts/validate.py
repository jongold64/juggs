"""Check the JUGGS data files after an edit.

    python scripts/validate.py data

Checks that every file parses, ids are unique and well formed, and every reference (skills, abilities, roles,
feats, genres, ...) points at something that exists. Prints errors and a count of open flags; exits with status 1
if there are errors.
"""
import json
import re
import sys
from pathlib import Path

ID_RE = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
POOLS = {'stamina', 'mana', 'resolve'}


class Checker:
    def __init__(self, folder):
        self.folder = Path(folder)
        self.errors = []
        self.flags = 0

    def err(self, where, msg):
        self.errors.append(f'{where}: {msg}')

    def load(self, name):
        path = self.folder / name
        if not path.exists():
            self.err(name, 'file missing')
            return None
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except json.JSONDecodeError as e:
            self.err(name, f'not valid JSON ({e})')
            return None

    def records(self, where, recs, required=('id', 'name')):
        """Check a list of records; return {id: record}."""
        out = {}
        if not isinstance(recs, list):
            self.err(where, 'expected a list')
            return out
        for i, r in enumerate(recs):
            if not isinstance(r, dict):
                self.err(where, f'item {i} is not an object')
                continue
            rid = r.get('id')
            for key in required:
                if key not in r:
                    self.err(f'{where} {rid or i}', f'missing "{key}"')
            if rid is None:
                continue
            if not ID_RE.match(str(rid)):
                self.err(where, f'bad id {rid!r} (use lower-case words joined by hyphens)')
            if rid in out:
                self.err(where, f'duplicate id {rid!r}')
            out[rid] = r
            flags = r.get('flags', [])
            if not isinstance(flags, list):
                self.err(f'{where} {rid}', '"flags" must be a list')
            else:
                self.flags += len(flags)
        return out

    def ref(self, where, value, known, kind):
        values = value if isinstance(value, list) else [value]
        for v in values:
            if v not in known:
                self.err(where, f'unknown {kind} {v!r}')

    def requires(self, where, clauses, ctx):
        if not isinstance(clauses, list):
            self.err(where, '"requires" must be a list')
            return
        for c in clauses:
            self.clause(where, c, ctx)

    def clause(self, where, c, ctx):
        if not isinstance(c, dict) or not c:
            self.err(where, f'bad requirement {c!r}')
            return
        known = {
            'ability': ('abilities', 'Ability Score'), 'skill': ('skills', 'skill'), 'focus': ('skills', 'skill'),
            'role': ('roles', 'Role'), 'feat': ('feats', 'Feat'), 'genre': ('genres', 'Genre'),
            'specialty': ('specialties', 'Specialty'),
        }
        for key, val in c.items():
            if key in known:
                table, kind = known[key]
                self.ref(where, val, ctx[table], kind)
            elif key == 'any':
                for sub in val:
                    self.clause(where, sub, ctx)
            elif key == 'specialty_category':
                self.ref(where, val, {'combat', 'magical', 'spiritual', 'social'}, 'Specialty category')
            elif key == 'specialty_ability':
                self.ref(where, val, {'ability1', 'ability2', 'ability3'}, 'Specialty ability')
            elif key in ('min', 'rank_min', 'step', 'power_level_min', 'reputation_min'):
                if not isinstance(val, int):
                    self.err(where, f'"{key}" must be a whole number')
            elif key in ('all', 'text', 'note'):
                pass
            else:
                self.err(where, f'unknown requirement key {key!r}')


def main(folder):
    ck = Checker(folder)
    core = ck.load('core.json')
    abil = ck.load('abilities.json')
    ctx = {}
    ctx['abilities'] = ck.records('abilities.json abilities', (abil or {}).get('abilities', []))
    ctx['domains'] = ck.records('abilities.json domains', (abil or {}).get('domains', []))
    ctx['genres'] = ck.records('genres.json', ck.load('genres.json') or [])
    skills = ck.records('skills.json', ck.load('skills.json') or [])
    ctx['skills'] = skills
    ctx['roles'] = ck.records('roles.json', ck.load('roles.json') or [])
    ctx['feats'] = ck.records('feats.json', ck.load('feats.json') or [])
    ctx['specialties'] = ck.records('specialties.json', ck.load('specialties.json') or [])
    aptitudes = ck.records('aptitudes.json', ck.load('aptitudes.json') or [])
    origins = ck.records('origins.json', ck.load('origins.json') or [])
    presets = ck.records('presets.json', ck.load('presets.json') or [], required=('id',))
    effects = ck.records('effects.json', ck.load('effects.json') or [])
    conditions = ck.records('conditions.json', ck.load('conditions.json') or [])
    maneuvers = ck.records('maneuvers.json', ck.load('maneuvers.json') or [])
    aff = ck.load('afflictions.json') or {}
    ck.records('afflictions.json', aff.get('afflictions', []))
    powers = ck.load('powers.json') or {}
    sources = ck.records('powers.json sources', powers.get('sources', []))
    ck.records('powers.json examples', powers.get('examples', []))
    abilities, domains = ctx['abilities'], ctx['domains']
    ability_or_primary = set(abilities) | {'primary_attack'}

    for d in domains.values():
        ck.ref(f'domain {d["id"]}', d.get('pool'), POOLS, 'pool')
        ck.ref(f'domain {d["id"]}', d.get('abilities', []), abilities, 'Ability Score')
    for a in abilities.values():
        ck.ref(f'ability {a["id"]}', a.get('domain'), domains, 'Domain')

    for s in skills.values():
        w = f'skills.json {s["id"]}'
        ck.ref(w, s.get('governing', []), ability_or_primary, 'Ability Score')
        ck.ref(w, s.get('genres', []), ctx['genres'], 'Genre')
        if s.get('category') not in ('body', 'mind', 'spirit', 'social', None):
            ck.err(w, f'unknown category {s.get("category")!r}')
    for g in ctx['genres'].values():
        w = f'genres.json {g["id"]}'
        ck.ref(w, g.get('skills', []), skills, 'skill')
        ck.ref(w, g.get('requires', []), ctx['genres'], 'Genre')
        for sid in g.get('skills', []):
            if sid in skills and g['id'] not in skills[sid].get('genres', []):
                ck.err(w, f'lists skill {sid!r}, but the skill does not list this Genre')

    for r in ctx['roles'].values():
        w = f'roles.json {r["id"]}'
        ck.requires(w, r.get('requires', []), ctx)
        steps = r.get('steps', [])
        if [s.get('step') for s in steps] != [1, 2, 3, 4, 5]:
            ck.err(w, 'steps must be numbered 1-5 in order')
    for f in ctx['feats'].values():
        w = f'feats.json {f["id"]}'
        if f.get('rank') not in ('A', 'B', 'C', 'D'):
            ck.err(w, f'unknown Rank {f.get("rank")!r} (use A, B, C or D)')
        ck.requires(w, f.get('requires', []), ctx)
    for s in ctx['specialties'].values():
        w = f'specialties.json {s["id"]}'
        ck.ref(w, s.get('governing', []), abilities, 'Ability Score')
        ck.ref(w, s.get('pool'), POOLS, 'pool')
        ck.ref(w, s.get('bonus_skills', []), skills, 'skill')
        if len(s.get('bonus_skills', [])) != 2:
            ck.err(w, 'needs exactly 2 bonus skills')
        syn = s.get('synergy') or {}
        if 'requires' in syn:
            ck.clause(w + ' synergy', syn['requires'], ctx)
    for a in aptitudes.values():
        w = f'aptitudes.json {a["id"]}'
        ck.ref(w, list(a.get('ability_bonuses', {})), abilities, 'Ability Score')
        bs = a.get('bonus_skills')
        if isinstance(bs, list):
            ck.ref(w, bs, skills, 'skill')
        wealth = a.get('starting_wealth')
        if not isinstance(wealth, int) or not 1 <= wealth <= 8:
            ck.err(w, 'starting_wealth must be 1-8')
    for o in origins.values():
        if o.get('kind') not in ('lineage', 'circumstance'):
            ck.err(f'origins.json {o["id"]}', 'kind must be lineage or circumstance')
    for p in presets.values():
        w = f'presets.json {p["id"]}'
        ck.ref(w, p.get('role'), ctx['roles'], 'Role')
        ck.ref(w, p.get('specialty'), ctx['specialties'], 'Specialty')
        ck.ref(w, p.get('aptitude'), aptitudes, 'Aptitude')
        ck.ref(w, p.get('signature_effect'), effects, 'Effect')
        ck.ref(w, p.get('power_sources') or [], sources, 'Power Source')
        ck.ref(w, p.get('focus_skills', []), skills, 'skill')
    for e in effects.values():
        w = f'effects.json {e["id"]}'
        ck.ref(w, e.get('pools') or [], POOLS, 'pool')
        for pools in (e.get('pools_in_sources') or {}).values():
            ck.ref(w, pools, POOLS, 'pool')
    for c in conditions.values():
        w = f'conditions.json {c["id"]}'
        if c.get('domain') is not None:
            ck.ref(w, c['domain'], domains, 'Domain')
        if c.get('ability') is not None:
            ck.ref(w, c['ability'], abilities, 'Ability Score')
    for m in maneuvers.values():
        cost = m.get('cost', {})
        if 'pool' in cost:
            ck.ref(f'maneuvers.json {m["id"]}', cost['pool'], POOLS, 'pool')
    builder = powers.get('builder', {})
    for key in ('range', 'targets', 'duration', 'summons'):
        for o in ck.records(f'powers.json builder {key}', builder.get(key, [])).values():
            if not isinstance(o.get('points'), int):
                ck.err(f'powers.json builder {key} {o["id"]}', '"points" must be a whole number')
    for m in ck.records('powers.json builder modifiers', builder.get('modifiers', [])).values():
        ck.ref(f'powers.json modifier {m["id"]}', m.get('sources', []), sources, 'Power Source')
    levels = builder.get('power_levels', [])
    for a, b in zip(levels, levels[1:]):
        if a.get('max') is None or b.get('min') != a['max'] + 1:
            ck.err('powers.json builder power_levels', 'point bands must follow on with no gaps')

    for s in sources.values():
        w = f'powers.json source {s["id"]}'
        ck.ref(w, s.get('abilities') or [], abilities, 'Ability Score')
        if s.get('basic_cast_pool') is not None:
            ck.ref(w, s['basic_cast_pool'], POOLS, 'pool')
        ck.ref(w, s.get('default_from_focus', []), skills, 'skill')

    gear = ck.load('gear.json') or {}
    quality = ck.records('gear.json quality', gear.get('quality', []))
    for key in ('weapons', 'period_equipment', 'armor_categories', 'armor', 'shields'):
        recs = ck.records(f'gear.json {key}', gear.get(key, []))
        for r in recs.values():
            if r.get('quality') is not None:
                ck.ref(f'gear.json {key} {r["id"]}', r['quality'], quality, 'quality')

    items = ck.load('items.json') or {}
    templates = ck.records('items.json templates', items.get('templates', []))
    ck.records('items.json descriptors', items.get('descriptors', []))
    for key in ('universal_items', 'genre_items'):
        for r in ck.records(f'items.json {key}', items.get(key, [])).values():
            w = f'items.json {key} {r["id"]}'
            ck.ref(w, r.get('template'), templates, 'template')
            ck.ref(w, r.get('genre', []) or [], ctx['genres'], 'Genre')
            ck.ref(w, list(r.get('names', {})), ctx['genres'], 'Genre')

    veh = ck.load('vehicles.json') or {}
    ck.records('vehicles.json conditions', veh.get('conditions', []))
    for st in ck.records('vehicles.json stations', veh.get('stations', [])).values():
        roll = st.get('roll')
        if roll:
            ck.ref(f'vehicles.json station {st["id"]}', roll['ability'], abilities, 'Ability Score')
            ck.ref(f'vehicles.json station {st["id"]}', roll['skill'], skills, 'skill')
    ck.records('vehicles.json actions', veh.get('actions', []))
    for v in ck.records('vehicles.json catalog', veh.get('catalog', [])).values():
        w = f'vehicles.json {v["id"]}'
        ck.ref(w, v.get('genres', []), ctx['genres'], 'Genre')
        if not 0 <= v.get('frame', -1) <= 5:
            ck.err(w, 'frame must be 0-5')
    ck.flags += len(veh.get('flags', []))

    for c in ck.records('concepts.json', ck.load('concepts.json') or [], required=('id',)).values():
        ck.ref(f'concepts.json {c["id"]}', c.get('role'), ctx['roles'], 'Role')

    if core:
        tiers = core.get('tiers', [])
        levels = [lv for t in tiers for lv in range(t['levels'][0], t['levels'][1] + 1)]
        if levels != list(range(1, 21)):
            ck.err('core.json tiers', 'tiers must cover levels 1-20 in order with no gaps')
        bands = core.get('pools', {}).get('bands', [])
        if sum(b.get('boxes', 0) for b in bands) != core.get('pools', {}).get('start'):
            ck.err('core.json pools', 'band sizes must add up to the starting pool size')
        for lv in core.get('advancement', {}).get('feat_levels', []):
            if not 1 <= lv <= 20:
                ck.err('core.json advancement', f'feat level {lv} out of range')

    for e in ck.errors:
        print('ERROR', e)
    print(f'{len(ck.errors)} errors, {ck.flags} open flags.')
    return 1 if ck.errors else 0


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1]))
