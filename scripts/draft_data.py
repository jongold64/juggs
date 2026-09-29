"""Draft the JUGGS rules data from the source documents, once.

    python scripts/draft_data.py <source folder> <output folder>

After the first draft the files in data/ are edited directly, so this script refuses to write into a folder that
already holds JSON. To compare a new draft with the current data, draft into a scratch folder.

Rulings from docs/DECISIONS.md are applied here. Anything that could not be read cleanly, or that the author still
has to decide, goes into the record's "flags" list and into _report.md in the output folder.
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

from docx_reader import read_blocks, section

# ---------------------------------------------------------------------------------------------------------------
# Constants and hand-entered facts
# ---------------------------------------------------------------------------------------------------------------

ABILITY_IDS = {
    'strength': 'str', 'toughness': 'tou', 'agility': 'agi',
    'intellect': 'int', 'willpower': 'wil', 'acuity': 'acu',
    'belief': 'bel', 'morale': 'mor', 'serenity': 'ser',
}
ABILITY_NAMES = '|'.join(n.capitalize() for n in ABILITY_IDS)
DOMAINS = [
    {'id': 'body', 'name': 'Body', 'pool': 'stamina', 'abilities': ['str', 'tou', 'agi']},
    {'id': 'mind', 'name': 'Mind', 'pool': 'mana', 'abilities': ['int', 'wil', 'acu']},
    {'id': 'spirit', 'name': 'Spirit', 'pool': 'resolve', 'abilities': ['bel', 'mor', 'ser']},
]
POOLS = {'stamina': 'Stamina', 'mana': 'Mana', 'resolve': 'Resolve'}
SLOTS = ['attack', 'defend', 'deflect']

TIERS = [  # name, power level, first level
    ('novice', 'Novice', 1, 1), ('seasoned', 'Seasoned', 2, 5), ('veteran', 'Veteran', 3, 9),
    ('heroic', 'Heroic', 4, 13), ('legendary', 'Legendary', 5, 17),
]
TIER_BY_NAME = {t[1].lower(): t for t in TIERS}
STEP_TIER_WORDS = {'level 1': 1, 'novice': 1, 'seasoned': 5, 'veteran': 9, 'heroic': 13, 'legendary': 17}

GENRE_NAMES = {  # every spelling used in the sources -> genre id
    'fantasy': 'fantasy', 'magic / powers': 'magic', 'magic and powers': 'magic', 'horror': 'horror',
    'cthulhu': 'cthulhu', 'weird magic': 'weird-magic', 'modern': 'modern', 'espionage': 'espionage',
    'james bond / espionage': 'espionage', 'james bond': 'espionage', 'cyberpunk': 'cyberpunk',
    'steampunk': 'steampunk', 'transhumanist': 'transhumanist', 'superhero': 'superhero',
    'interstellar': 'interstellar', 'space opera': 'space-opera', 'post-apoc': 'post-apocalyptic',
    'post-apocalyptic': 'post-apocalyptic', 'psionics': 'psionics', 'weird west / pulp': 'weird-west',
    'weird west / renaissance / pulp': 'weird-west', 'dark renaissance': 'dark-renaissance',
    'wuxia': 'wuxia', 'wuxia / martial arts': 'wuxia', 'mythic': 'mythic', 'mythic / demigods': 'mythic',
}

# The same skill spelled differently in two tables of the Book of Genres.
SKILL_ALIASES = {'Survival (Hostile Worlds)': 'Survival (Hostile)'}
SKILL_CATEGORY = {'shoot': 'body'}  # DECISIONS.md

# Heal is a skill (DECISIONS.md). The Player Book has no entry for it; the text is from JUGGS_SRD_Updated.html.
HEAL_SKILL = {
    'id': 'heal', 'name': 'Heal', 'category': 'spirit', 'governing': ['bel', 'ser'], 'genres': ['magic'],
    'description': 'Supernatural or empathic healing; restoring pool boxes.',
    'flags': ['Domain and Genre to be confirmed: the SRD lists Heal among Mind skills (governing Belief / '
              'Serenity); drafted as Spirit, in the Magic Genre like Channel.'],
}

# Role prerequisites as checkable data (from the "Prerequisite:" lines, with Overlay read as Genre).
ROLE_REQUIRES = {
    'artificer': [{'ability': ['int'], 'min': 2}],
    'caster': [{'genre': ['magic']},
               {'any': [{'skill': s, 'rank_min': 2} for s in ('cast-attack', 'cast-defend', 'cast-utility')]},
               {'ability': ['int', 'bel'], 'min': 2}],
    'channeler': [{'genre': ['magic']},
                  {'any': [{'skill': 'channel', 'rank_min': 2}, {'skill': 'heal', 'rank_min': 2}]}],
    'weird': [{'genre': ['magic']}, {'genre': ['weird-magic']}],
    'psion': [{'genre': ['psionics']}, {'ability': ['wil'], 'min': 2}],
    'shaper': [{'genre': ['magic']}],
    'netrunner': [{'genre': ['cyberpunk', 'transhumanist', 'interstellar', 'space-opera']},
                  {'ability': ['int'], 'min': 2}],
}
ROLE_FLAGS = {
    'shaper': ['Prerequisite also says "Any element-based Effects available in the Genre" (not checkable).'],
    'netrunner': ['Prerequisite also says "Hack skill must be available".'],
}

# Specialty bonus skills: the Player Book does not list them; these come from JUGGS_SRD_Updated.html
# ("Specialty Bonus Skills").
SPECIALTY_BONUS_SKILLS = {
    'striker': ['combat-melee', 'athletics'], 'duelist': ['combat-melee', 'evasion'],
    'guardian': ['endure', 'combat-maneuver'], 'skirmisher': ['evasion', 'combat-ranged'],
    'brawler': ['athletics', 'combat-maneuver'], 'conduit': ['cast-attack', 'concentrate'],
    'theorist': ['cast-utility', 'knowledge'], 'shaper': ['cast-attack', 'survive'],
    'invoker': ['cast-attack', 'channel'], 'anchor': ['channel', 'endure'], 'empath': ['observe', 'persuade'],
    'warden': ['channel', 'lead'], 'seeker': ['observe', 'survive'], 'orator': ['persuade', 'inspire'],
    'infiltrator': ['stealth', 'deceive'], 'broker': ['trade', 'network'], 'confidant': ['persuade', 'network'],
}

ORIGIN_CHOICES = {
    'forgeborn': {'name': 'Substrate', 'text': 'Sets one resistance and one vulnerability.', 'options': None},
    'drakeblood': {'name': 'Resisted Effect', 'options': ['fire', 'cold', 'electric', 'acid']},
    'augmented': {'name': 'Package', 'options': ['Optical (+1 Observe)', 'Neural (+1 Tactics)',
                                                  'Skeletal (+1 Endure)', 'Combat (+1 to one Combat skill)']},
}
REPUTATION_START = {'highborn': 2, 'noble': 2}  # origin / aptitude id -> starting Reputation

# Power Sources (DECISIONS.md). Physical is universal.
POWER_SOURCES = [
    {'id': 'physical', 'name': 'Physical', 'universal': True, 'abilities': None, 'basic_cast_pool': None,
     'rules': None},
    {'id': 'arcane', 'name': 'Arcane', 'abilities': ['int', 'bel'], 'basic_cast_pool': 'mana', 'rules': 'arcane',
     'default_from_focus': ['cast-attack', 'cast-defend', 'cast-utility']},
    {'id': 'divine', 'name': 'Divine', 'abilities': ['bel', 'mor'], 'basic_cast_pool': 'resolve', 'rules': 'divine'},
    {'id': 'element', 'name': 'Element', 'abilities': None, 'basic_cast_pool': None, 'rules': None,
     'flags': ['Details to be decided.']},
    {'id': 'nature', 'name': 'Nature', 'abilities': None, 'basic_cast_pool': None, 'rules': None,
     'flags': ['Details to be decided.']},
    {'id': 'psionic', 'name': 'Psionic', 'abilities': ['wil'], 'basic_cast_pool': 'mana', 'rules': 'psionic'},
    {'id': 'spirit', 'name': 'Spirit', 'abilities': ['bel', 'ser'], 'basic_cast_pool': 'resolve',
     'rules': 'spiritual', 'default_from_focus': ['channel']},
    {'id': 'void', 'name': 'Void', 'abilities': None, 'basic_cast_pool': None, 'rules': None,
     'flags': ['Details to be decided.']},
    {'id': 'weird', 'name': 'Weird', 'abilities': ['int', 'acu'], 'basic_cast_pool': None, 'rules': 'weird',
     'basic_cast_note': "GM's call based on the effect described; the Weird Table still fires."},
]
POWER_SOURCE_NAMES = {  # Suggested Build wording -> declared sources beyond Physical
    'physical': [], 'arcane': ['arcane'], 'psionic': ['psionic'], 'weird': ['weird'],
    'physical + spiritual': ['spirit'], 'spiritual / divine': ['spirit'],
}

# Suppressed comes from JUGGS_SRD_Updated.html; the Player Book does not define it.
EXTRA_CONDITIONS = [
    {'id': 'suppressed', 'name': 'Suppressed', 'positive': False, 'domain': None, 'ability': None,
     'effect': "Names one Power Source (e.g. Suppressed (Arcane)). Abilities drawing from that source cannot be "
               "used.",
     'removed': 'End of scene; a Restoration event, Dispel (Cast DC 14), or a Full Rest.',
     'source_doc': 'JUGGS_SRD_Updated.html', 'choice': 'power_source'},
]


# ---------------------------------------------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------------------------------------------

REPORT = []


def slug(name):
    s = name.lower().replace('’', '').replace("'", '')
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')


def flag(rec, msg):
    rec.setdefault('flags', []).append(msg)


def ability_ids(text):
    """'Strength / Agility', 'Belief or Intellect' -> ['str', 'agi'] etc. Unknown words are ignored."""
    return [ABILITY_IDS[w.lower()] for w in re.findall(ABILITY_NAMES, text)]


def split_label(text, label):
    """'Label: rest' -> rest (or None)."""
    m = re.match(rf'^{re.escape(label)}\s*:?\s*(.*)$', text, re.S)
    return m.group(1).strip() if m else None


def split_at_table(text):
    """Split 'rules text At the table: notes' into (rules, notes)."""
    m = re.split(r'\s*At the table:\s*', text, maxsplit=1)
    return (m[0].strip(), m[1].strip() if len(m) > 1 else None)


def table_after(blocks, first_cell):
    for b in blocks:
        if b.kind == 't' and b.rows and b.rows[0][0].startswith(first_cell):
            return b.rows
    raise KeyError(f'table not found: {first_cell!r}')


def tier_level(word):
    w = word.strip().lower()
    for k, v in STEP_TIER_WORDS.items():
        if w.startswith(k):
            return v
    return None


# ---------------------------------------------------------------------------------------------------------------
# Abilities and skills
# ---------------------------------------------------------------------------------------------------------------

def draft_abilities(pb):
    how = section(pb, 'How Skills Work', 2)
    desc = {}
    for b in how:
        m = re.match(rf'^({ABILITY_NAMES}) \((Attack|Defend|Deflect)\):\s*(.*)$', b.text)
        if m:
            desc[ABILITY_IDS[m.group(1).lower()]] = m.group(3)
    abilities = []
    for d in DOMAINS:
        for slot, aid in zip(SLOTS, d['abilities']):
            name = next(k for k, v in ABILITY_IDS.items() if v == aid).capitalize()
            abilities.append({'id': aid, 'name': name, 'domain': d['id'], 'slot': slot,
                              'description': desc.get(aid, '')})
    return {'domains': DOMAINS, 'abilities': abilities}


def draft_skills(pb, genres_doc):
    table = table_after(section(pb, 'Complete Skill List', 3), 'Skill')
    pb_rows = {r[0]: r for r in table[1:]}
    skills, order = {}, []

    def add(rec):
        if rec['id'] not in skills:
            order.append(rec['id'])
        skills[rec['id']] = rec

    # Universal skills: the paragraphs under "Full Skill List".
    category = None
    for b in section(pb, 'Full Skill List', 2):
        if b.heading:
            category = b.text.split()[0].lower()  # body / mind / spirit / social
            continue
        m = re.match(r'^(.+?) \[([^\]]+)\]\s*:?\s*(.*)$', b.text)
        if not m:
            continue
        name, gov, text = m.group(1).strip(), m.group(2), m.group(3).strip()
        rec = {'id': slug(name), 'name': name, 'category': category,
               'governing': ['primary_attack'] if 'Governing Ability*' in gov else ability_ids(gov),
               'genres': [], 'description': text}
        if name in pb_rows:
            rec['category'] = pb_rows[name][1].lower()
        add(rec)

    lang = skills['language']
    lang['description'] = 'Languages. Every character gets 2 additional languages at creation.'
    flag(lang, 'Description rewritten from DECISIONS.md (the "per BP" wording is removed); needs author text.')
    skills['survive']['notes'] = 'First Aid is part of Survive.'
    skills['luck']['gm_only'] = True

    # Genre skills: Book of Genres list table, the per-genre tables, and the Player Book's Fantasy rows.
    list_rows = table_after(section(genres_doc, 'Genre Skill List', 2), 'Skill')[1:]
    shared = {r[0]: r for r in table_after(section(genres_doc, 'Shared Genre Skills', 2), 'Skill')[1:]}
    genre_tables = {}
    start = next(i for i, b in enumerate(genres_doc) if b.text == 'Genre List')
    current = None
    for b in genres_doc[start + 1:]:
        if b.heading == 1:
            if b.text == 'System Mechanics':
                break
            current = GENRE_NAMES.get(b.text.lower())
        elif b.kind == 't' and current and b.rows[0][0] == 'Skill':
            genre_tables[current] = b.rows[1:]

    def genre_skill(name):
        name = SKILL_ALIASES.get(name, name)
        sid = slug(name)
        if sid not in skills:
            add({'id': sid, 'name': name, 'category': None, 'governing': [], 'genres': [], 'description': ''})
        return skills[sid]

    for r in list_rows:
        name, dom, gov, gl = r[0], r[1], r[2], r[3]
        if not dom:  # a category row
            continue
        if name == 'Abjure':  # DECISIONS.md: Abjure is an ability, not a skill
            continue
        rec = genre_skill(name)
        rec['category'] = dom.lower()
        rec['governing'] = ability_ids(gov)
        for g in re.split(r',\s*', gl):
            gid = GENRE_NAMES.get(g.strip().lower())
            if gid is None:
                REPORT.append(f'Skill {name}: unknown genre name {g!r}')
            elif gid not in rec['genres']:
                rec['genres'].append(gid)
    for gid, rows in genre_tables.items():
        for r in rows:
            name, gov, notes, definition = r[0], r[1], r[2], r[3]
            if name == 'Abjure' or name in ('Concentrate',):
                continue
            rec = genre_skill(name)
            if not rec['description']:
                rec['description'] = definition
            if not rec['governing']:
                rec['governing'] = ability_ids(gov)
            if gid not in rec['genres']:
                rec['genres'].append(gid)
            if notes and notes not in ('Shared', '—') and not notes.startswith(('Shared', 'New')):
                rec.setdefault('relation', notes)
    for name, r in shared.items():
        rec = skills.get(slug(name))
        if rec:
            rec['description'] = r[3]
            if r[2] and r[2] != '—':
                rec['relation'] = r[2]
    for name, r in pb_rows.items():  # Player Book rows for Fantasy skills (Craft, Lore, ...)
        rec = skills.get(slug(name))
        if rec and rec['genres'] and rec['category'] is None:
            rec['category'] = r[1].lower()
            if not rec['governing']:
                rec['governing'] = ability_ids(r[2])

    for sid in ('sanity-check',):
        if sid in skills:
            skills[sid]['gm_only'] = True
    for sid, cat in SKILL_CATEGORY.items():
        skills[sid]['category'] = cat
    add(dict(HEAL_SKILL))
    for rec in skills.values():
        if rec['genres'] and 'fantasy' in rec['genres'] and not rec['description']:
            flag(rec, 'No description found.')
        if not rec['governing']:
            flag(rec, 'Governing Ability not found.')
        if rec['category'] is None:
            flag(rec, 'Domain not found.')
    return [skills[i] for i in order]


# ---------------------------------------------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------------------------------------------

def parse_prereq(text, feat_ids, skill_ids, role_ids):
    """Turn a prerequisite line into a list of checkable clauses. Clauses that cannot be read are kept as
    {"text": ...}."""
    text = text.strip().rstrip('.')
    if not text or text.lower() in ('none', 'no prerequisite'):
        return []
    parts = [p.strip() for p in re.split(r',\s*', text) if p.strip()]
    return [parse_clause(p, feat_ids, skill_ids, role_ids) for p in parts]


def skill_ref(name, skill_ids):
    sid = slug(re.sub(r' skill$', '', name.strip()))
    if sid == 'abjure':
        return 'channel'
    return sid if sid in skill_ids else None


def parse_clause(c, feat_ids, skill_ids, role_ids):
    m = re.fullmatch(r'PL\s?(\d)\+', c)
    if m:
        return {'power_level_min': int(m.group(1))}
    m = re.match(r'^(Seasoned|Veteran|Heroic|Legendary) tier', c)
    if m:
        return {'power_level_min': TIER_BY_NAME[m.group(1).lower()][2]}
    m = re.fullmatch(rf'((?:{ABILITY_NAMES})(?: or (?:{ABILITY_NAMES}))*) (\d)\+', c)
    if m:
        return {'ability': ability_ids(m.group(1)), 'min': int(m.group(2))}
    m = re.fullmatch(r'(.+?) rank (\d)\+', c)
    if m and skill_ref(m.group(1), skill_ids):
        return {'skill': skill_ref(m.group(1), skill_ids), 'rank_min': int(m.group(2))}
    m = re.fullmatch(r'(.+?) (both )?as (?:a )?Focus Skills?', c)
    if m:
        names = re.split(r' and | or ', m.group(1))
        refs = [skill_ref(n, skill_ids) for n in names]
        if all(refs):
            out = {'focus': refs, 'all': ' and ' in m.group(1)}
            if 'abjure' in [slug(n) for n in names]:
                out['note'] = 'Abjure replaced by Channel (DECISIONS.md)'
            return out
    m = re.fullmatch(r'(.+?) Role Step (\d)', c)
    if m:
        refs = [slug(n) for n in m.group(1).split(' or ')]
        if all(r in role_ids for r in refs):
            return {'role': refs, 'step': int(m.group(2))}
    m = re.fullmatch(r'Reputation (\d)\+', c)
    if m:
        return {'reputation_min': int(m.group(1))}
    if re.fullmatch(r'Magic Overlay active', c):
        return {'genre': ['magic']}
    m = re.fullmatch(r'(\w+) Fighting Style', c)  # the old name for a Specialty
    if m:
        return {'specialty': [slug(m.group(1))]}
    m = re.fullmatch(r'Active (Combat|Magical|Spiritual|Social) Specialty', c)
    if m:
        return {'specialty_category': m.group(1).lower()}
    name = re.sub(r'\s*\((Basic|Advanced|Mastery|Legendary)\)$', '', c)
    if feat_id(name) in feat_ids:
        return {'feat': [feat_id(name)]}
    m = re.fullmatch(r'Surge Discipline (I{1,3}|IV)', name)
    if m:
        return {'feat': [feat_id(f'Surge Discipline ({m.group(1)})')]}
    if ' or ' in c:
        alts = [parse_clause(a, feat_ids, skill_ids, role_ids) for a in c.split(' or ')]
        if all('text' not in a for a in alts):
            feats = [a['feat'][0] for a in alts if list(a) == ['feat']]
            if len(feats) == len(alts):
                return {'feat': feats}
            return {'any': alts}
    return {'text': c}


# ---------------------------------------------------------------------------------------------------------------
# Roles, presets
# ---------------------------------------------------------------------------------------------------------------

def draft_roles(pb, skill_ids):
    overview = {r[0].replace(' Role', ''): r for r in table_after(section(pb, 'All 22 Roles', 2), 'Role')[1:]}
    # The full Role entries follow the Suggested Builds tables, to the end of Chapter 5.
    ch5 = section(pb, 'Chapter 5', 1)
    sec = ch5[next(i for i, b in enumerate(ch5) if b.heading and b.text == 'All 22 Roles'):]
    roles, cur = [], None
    for b in sec:
        if b.kind == 'p':
            m = re.fullmatch(r'(.+?) Role \[ (EXISTING|NEW) \]', b.text)
            if m:
                name = m.group(1)
                ov = overview[name]
                cur = {'id': slug(name), 'name': name, 'category': ov[2].lower(), 'identity': ov[3],
                       'summary': None, 'prerequisite_text': None, 'requires': ROLE_REQUIRES.get(slug(name), []),
                       'suggested_aptitudes_text': None, 'steps': [], 'design_note': None}
                for f in ROLE_FLAGS.get(cur['id'], []):
                    flag(cur, f)
                roles.append(cur)
                continue
            if cur is None:
                continue
            for label, key in (('Prerequisite', 'prerequisite_text'), ('Suggested Aptitudes', 'suggested_aptitudes_text'),
                               ('Design note', 'design_note')):
                v = split_label(b.text, label)
                if v is not None:
                    cur[key] = v
                    break
            else:
                if cur['summary'] is None and not b.text.isupper():
                    cur['summary'] = b.text
        elif b.kind == 't' and cur and b.rows[0][0] == 'Step' and not cur['steps']:
            for r in b.rows[1:]:
                n = int(re.search(r'\d', r[0]).group())
                cur['steps'].append({'step': n, 'level': tier_level(r[1]), 'text': r[2]})
    for r in roles:
        if len(r['steps']) != 5:
            flag(r, f'Expected 5 steps, found {len(r["steps"])}.')
        if r['id'] == 'weird':
            r['notes'] = 'Step 1 grants Corruption 1 (Weird results add to Corruption; no separate Tainted track).'
    return roles


def draft_presets(pb, skill_ids, role_ids, spec_ids, apt_ids):
    sec = section(pb, 'Suggested Builds', 2)
    builds = table_after(sec, 'Role')
    focus = {r[0]: r[1] for r in table_after(section(pb, 'Focus Skills by Suggested Build', 3), 'Role')[1:]}
    why = {r[0]: r[1] for r in table_after(section(pb, 'Why These Pairings', 3), 'Role')[1:]}
    presets = []
    for r in builds[1:]:
        if not r[1]:
            continue
        role, spec, apt, src, sig = r
        rec = {'id': slug(role), 'role': slug(role), 'specialty': slug(spec), 'aptitude': slug(apt),
               'power_sources': POWER_SOURCE_NAMES.get(src.lower()), 'signature_effect': slug(sig),
               'focus_skills': [], 'reasoning': why.get(role)}
        if rec['power_sources'] is None:
            flag(rec, f'Unknown Power Source {src!r}.')
        elif src.lower() == 'spiritual / divine':
            flag(rec, 'Book says "Spiritual / Divine"; drafted as Spirit.')
        for n in re.split(r'\s*·\s*', focus.get(role, '')):
            sid = skill_ref(n, skill_ids)
            if sid is None:
                flag(rec, f'Unknown Focus Skill {n!r}.')
            elif sid in rec['focus_skills']:
                flag(rec, f'{n} replaced by Channel, which is already listed; sixth Focus Skill to be decided.')
            else:
                if slug(n) == 'abjure':
                    flag(rec, 'Abjure replaced by Channel (DECISIONS.md).')
                rec['focus_skills'].append(sid)
        for key, ids in (('role', role_ids), ('specialty', spec_ids), ('aptitude', apt_ids)):
            if rec[key] not in ids:
                flag(rec, f'Unknown {key} {rec[key]!r}.')
        presets.append(rec)
    return presets


# ---------------------------------------------------------------------------------------------------------------
# Aptitudes, origins
# ---------------------------------------------------------------------------------------------------------------

def draft_aptitudes(pb, skill_ids):
    wealth = {}
    for b in section(pb, 'Wealth', 2):
        for tier, names in re.findall(r'Tier (\d) \([^)]*\): ([^.]+)\.', b.text):
            for n in names.split(','):
                wealth[slug(n.strip())] = int(tier)
    apts, cur, category = [], None, None
    for b in section(pb, 'Full Aptitude Entries', 2):
        if b.heading == 3:
            category = b.text
        elif b.heading == 4:
            cur = {'id': slug(b.text), 'name': b.text, 'category': category, 'description': None,
                   'ability_bonuses': {}, 'bonus_skills': [], 'signature_ability': None, 'genres_text': None,
                   'starting_wealth': None}
            apts.append(cur)
        elif cur and b.kind == 'p':
            v = split_label(b.text, 'Ability bonuses')
            if v is not None:
                head = re.match(rf'^((?:(?:{ABILITY_NAMES}) \+1,? ?){{3}})', v)
                for aid in ability_ids(head.group(1) if head else v)[:3]:
                    cur['ability_bonuses'][aid] = 1
                cur['ability_notes'] = v[head.end():].strip() if head else None
                continue
            v = split_label(b.text, 'Bonus Skills')
            if v is not None:
                if 'player choice' in v.lower():
                    cur['bonus_skills'] = {'choose': 2}
                else:
                    for n in v.split(','):
                        sid = skill_ref(n.strip(), skill_ids)
                        if sid:
                            cur['bonus_skills'].append(sid)
                        else:
                            flag(cur, f'Unknown bonus skill {n.strip()!r}.')
                continue
            v = split_label(b.text, 'Signature Ability')
            if v is not None:
                cur['signature_ability'] = v
                continue
            v = split_label(b.text, 'Genres')
            if v is not None:
                cur['genres_text'] = v
                continue
            if cur['description'] is None:
                cur['description'] = b.text
    for a in apts:
        a['starting_wealth'] = wealth.get(a['id'], 3)
        if a['id'] not in wealth:
            a['starting_wealth_note'] = 'No default in Ch 9; Struggling (DECISIONS.md).'
        if a['id'] in REPUTATION_START:
            a['starting_reputation'] = REPUTATION_START[a['id']]
        if len(a['ability_bonuses']) != 3:
            flag(a, f'Expected 3 Ability bonuses, found {len(a["ability_bonuses"])}.')
    return apts


def draft_origins(pb):
    rows = table_after(section(pb, 'Origins (Optional)', 2), 'Origin')[1:]
    notes = {r[0]: r[1] for r in table_after(section(pb, 'Origin Notes', 2), 'Origin')[1:]}
    out = []
    for i, (name, analog, trait) in enumerate(rows):
        rec = {'id': slug(name), 'name': name, 'kind': 'lineage' if i < 15 else 'circumstance',
               'analogs': [a.strip() for a in analog.split('·')], 'trait': trait, 'notes': notes.get(name)}
        if rec['id'] == 'standard':
            rec['trait'] = None
            rec['old_trait'] = trait
            flag(rec, 'Trait to be decided (Origins no longer give Focus Skills).')
        if rec['id'] in ORIGIN_CHOICES:
            rec['choice'] = ORIGIN_CHOICES[rec['id']]
        if rec['id'] in REPUTATION_START:
            rec['starting_reputation'] = REPUTATION_START[rec['id']]
        out.append(rec)
    if len(out) != 25:
        REPORT.append(f'Origins: expected 25, found {len(out)}')
    return out


# ---------------------------------------------------------------------------------------------------------------
# Specialties
# ---------------------------------------------------------------------------------------------------------------

def draft_specialties(pb):
    sec = section(pb, 'Chapter 6: Specialties', 1)
    out, cur, category = [], None, None
    for b in sec:
        if b.kind == 'p' and b.text.endswith('SPECIALTIES') and b.text.isupper():
            category = b.text.split()[0].lower()
        elif b.kind == 't' and '·' in b.rows[0][0]:
            name, gov, pool = [x.strip() for x in b.rows[0][0].split('·')]
            cur = {'id': slug(name), 'name': name, 'category': category, 'governing': ability_ids(gov),
                   'pool': pool.lower(), 'bonus_skills': SPECIALTY_BONUS_SKILLS.get(slug(name), []),
                   'summary': None, 'synergy': None, 'fallout': None, 'abilities': {}}
            for label, text in b.rows[1:]:
                key = {'Ability 1': 'ability1', 'Ability 2': 'ability2', 'Ability 3': 'ability3',
                       'Mastery Enhancement': 'mastery'}.get(label)
                if key is None:
                    flag(cur, f'Unknown row {label!r}.')
                    continue
                rules, at_table = split_at_table(text)
                cur['abilities'][key] = {'text': rules, 'at_the_table': at_table}
            out.append(cur)
        elif b.kind == 'p' and cur:
            if b.text.startswith('Fallout'):
                cur['fallout'] = re.sub(r'^Fallout \([^)]*\):\s*', '', b.text)
            elif 'Synergy:' in b.text and cur['summary'] is None:
                summary, syn = b.text.split('Synergy:', 1)
                cur['summary'] = summary.strip()
                cond, _, effect = syn.partition('—')
                cur['synergy'] = {'condition_text': cond.strip(), 'effect': effect.strip()}
                m = re.match(rf'^({ABILITY_NAMES}|[A-Z][a-z]+)\s*(?:≥|>=)\s*(\d)', cond.strip())
                if m:
                    key = m.group(1)
                    if key.lower() in ABILITY_IDS:
                        cur['synergy']['requires'] = {'ability': [ABILITY_IDS[key.lower()]], 'min': int(m.group(2))}
                    else:
                        cur['synergy']['requires'] = {'skill': slug(key), 'rank_min': int(m.group(2))}
    for s in out:
        if len(s['abilities']) != 4:
            flag(s, f'Expected 4 ability rows, found {len(s["abilities"])}.')
    if len(out) != 17:
        REPORT.append(f'Specialties: expected 17, found {len(out)}')
    return out


# ---------------------------------------------------------------------------------------------------------------
# Feats
# ---------------------------------------------------------------------------------------------------------------

FEAT_TIERS = ('Basic', 'Advanced', 'Mastery', 'Legendary')
SPECIALTY_UNLOCKS = {'specialty-ability-2': 3, 'specialty-ability-3': 7, 'specialty-mastery-enhancement': 11}


def feat_name(raw):
    name = raw.replace('[CROSS-DOMAIN]', '').replace('✦', '').strip()
    return re.sub(r'\s+', ' ', name)


def feat_id(name):
    m = re.fullmatch(r'Surge Discipline \((I{1,3}|IV)\)', name)
    if m:
        return 'surge-discipline-' + str(['I', 'II', 'III', 'IV'].index(m.group(1)) + 1)
    return slug(name)


def draft_feats(pb, skill_ids, role_ids):
    sec = section(pb, 'Chapter 6b: Feats', 1)
    hierarchy = table_after(sec, 'Domain')
    feats, order = {}, []
    for r in hierarchy[1:]:
        dom, tier, name, prereq, cross = (r + [''] * 5)[:5]
        if not tier:
            continue
        name = feat_name(name)
        fid = feat_id(name)
        if fid in SPECIALTY_UNLOCKS:
            if fid in feats:
                feats[fid]['domains'].append(dom.lower())
                continue
            name = name  # one generic record per unlock
        rec = {'id': fid, 'name': name, 'domain': dom.lower(), 'tier': tier, 'prerequisite_text': prereq,
               'cross_domain': cross == '✦', 'text': None, 'at_the_table': None}
        if fid in SPECIALTY_UNLOCKS:
            rec['domain'] = 'any'
            rec['domains'] = [dom.lower()]
            rec['prerequisite_text'] = re.sub(r'Active \w+ Specialty', 'An active Specialty', prereq)
            rec['available_from_level'] = SPECIALTY_UNLOCKS[fid]
            rec['unlocks'] = {'specialty-ability-2': 'ability2', 'specialty-ability-3': 'ability3',
                              'specialty-mastery-enhancement': 'mastery'}[fid]
        if fid.startswith('surge-discipline'):
            rec['series'] = 'surge-discipline'
        if fid == 'linguist':
            rec['repeatable'] = True
        if fid in feats:
            REPORT.append(f'Feat listed twice in the hierarchy: {name}')
            continue
        feats[fid] = rec
        order.append(fid)

    # Detailed entries, style 1: a small [name, tier] table, then Prereq / text / At the table paragraphs.
    details, cur = {}, None
    stop = False
    for b in sec:
        if b.kind == 'p' and b.text == 'Design Summary':
            stop = True
        if stop:
            break
        if b.kind == 't' and len(b.rows[0]) == 2 and b.rows[0][1] in FEAT_TIERS:
            cur = {'name': feat_name(b.rows[0][0]), 'text': [], 'at_the_table': None, 'prereq': None}
            if len(b.rows) > 1:
                cur['prereq'] = split_label(b.rows[1][0], 'Prereq')
            details.setdefault(feat_id(cur['name']), []).append(cur)
        elif b.kind == 'p' and cur:
            if b.text in ('Basic Tier', 'Advanced Tier', 'Mastery Tier', 'Legendary Tier') or 'FEATS —' in b.text:
                cur = None
                continue
            v = split_label(b.text, 'Prereq')
            if v is not None:
                cur['prereq'] = v
                continue
            v = split_label(b.text, 'At the table')
            if v is not None:
                cur['at_the_table'] = v
                continue
            cur['text'].append(b.text)

    # Style 2: "#### Name (Tier)" headings with a "Prerequisites:" paragraph.
    cur = None
    for b in sec:
        if b.heading == 4:
            m = re.fullmatch(r'(.+?) \((Basic|Advanced|Mastery|Legendary)\)', b.text)
            if m:
                cur = {'name': feat_name(m.group(1)), 'text': [], 'at_the_table': None, 'prereq': None}
                details.setdefault(feat_id(cur['name']), []).append(cur)
                continue
        if b.heading:
            cur = None
            continue
        if cur and b.kind == 'p':
            v = split_label(b.text, 'Prerequisites')
            if v is not None:
                cur['prereq'] = v
            else:
                cur['text'].append(b.text)

    # Style 3: Surge Discipline paragraphs.
    for b in section(pb, 'Surge Discipline', 2):
        m = re.match(r'^Surge Discipline \((I{1,3}|IV)\) — Prerequisites?: (.+?(?:\(Level \d+\+?(?: or higher)?\)))\s*(.*)$',
                     b.text)
        if m:
            fid = feat_id(f'Surge Discipline ({m.group(1)})')
            details.setdefault(fid, []).append({'name': fid, 'prereq': m.group(2), 'text': [m.group(3)],
                                                'at_the_table': None})

    for fid, entries in details.items():
        rec = feats.get(fid)
        if rec is None:
            REPORT.append(f'Feat text with no hierarchy row: {entries[0]["name"]}')
            continue
        e = entries[0]
        rec['text'] = '\n\n'.join(t for t in e['text'] if t) or None
        rec['at_the_table'] = e['at_the_table']
        if e['prereq'] and fid not in SPECIALTY_UNLOCKS and e['prereq'].strip() != rec['prerequisite_text'].strip():
            rec['prerequisite_text_detail'] = e['prereq']
    for fid in order:
        rec = feats[fid]
        if rec['text'] is None:
            flag(rec, 'No rules text found.')
        if fid.startswith('surge-discipline'):
            rec['summary'] = ('Reduce the pool cost of any Surge. Fallout severity still keys off boxes '
                              'committed. A Surge always costs at least 1 box.')

    feat_ids = set(order)
    for fid in order:
        rec = feats[fid]
        if fid in SPECIALTY_UNLOCKS:
            rec['requires'] = [{'specialty_ability': {'specialty-ability-2': 'ability1',
                                                      'specialty-ability-3': 'ability2',
                                                      'specialty-mastery-enhancement': 'ability3'}[fid]}]
            continue
        rec['requires'] = parse_prereq(rec['prerequisite_text'], feat_ids, skill_ids, role_ids)
        if any('text' in c for c in rec['requires']):
            flag(rec, 'Part of the prerequisite is not machine-readable.')
        if any(c.get('note', '').startswith('Abjure') for c in rec['requires']):
            flag(rec, 'Prerequisite named Abjure as a skill; drafted as Channel (DECISIONS.md).')
    return [feats[f] for f in order]


# ---------------------------------------------------------------------------------------------------------------
# Effects, conditions, afflictions
# ---------------------------------------------------------------------------------------------------------------

POOL_WORDS = {'stamina': 'stamina', 'mana': 'mana', 'resolve': 'resolve', 'mind': 'mana'}


def draft_effects(pb):
    by_pool = {r[0]: r for r in table_after(section(pb, 'Effect types by pool', 3), 'Effect')[1:]}
    out = []
    for b in section(pb, 'Effects', 2):
        if b.kind != 't' or b.rows[0][0] != 'Cost':
            continue
        head = b.rows[0][1]
        m = re.match(r'^(\w+) \[([^\]]+)\] — (.*)$', head)
        name = m.group(1)
        pools = [POOL_WORDS[p.strip().lower()] for p in m.group(2).split('/')]
        # DECISIONS.md: which pools can pay for each Effect is to be decided; both readings are kept.
        rec = {'id': slug(name), 'name': name, 'pools': None,
               'pools_in_sources': {'chapter_1': pools, 'effect_types_table': []}, 'use': m.group(3),
               'primary_condition': None, 'intensity': []}
        flag(rec, 'Pools to be decided (Chapter 1 and the "Effect types by pool" table disagree).')
        if 'Mind' in m.group(2):
            flag(rec, 'Chapter 1 lists "Mind" as a pool; read as Mana.')
        for cost, text in b.rows[1:]:
            rec['intensity'].append({'boxes': cost.replace(' boxes', '').replace(' box', ''), 'text': text})
        row = by_pool.get(name)
        if row:
            rec['pools_in_sources']['effect_types_table'] = [POOL_WORDS[p.strip().lower()]
                                                            for p in row[1].split(',')]
            rec['primary_condition'] = row[2]
        out.append(rec)
    return out


def draft_conditions(pb):
    out = {}

    def parse(b, positive):
        m = re.match(r'^(?P<name>[A-Z][A-Za-z() ]+?):?\s*\[(?P<dom>[^\]]+)\]\s*(?P<rest>.*)$', b.text, re.S)
        if not m:
            return
        name = m.group('name').strip()
        dom = m.group('dom')
        rest = m.group('rest')
        rec = {'id': slug(name), 'name': name, 'positive': positive, 'domain': None, 'ability': None,
               'effect': None, 'source': None, 'removed': None}
        dm = re.match(r'^(Body|Mind|Spirit|All Domains)(?: — (.+))?$', dom.strip())
        if dm:
            rec['domain'] = None if dm.group(1) == 'All Domains' else dm.group(1).lower()
            ab = ability_ids(dm.group(2) or '')
            rec['ability'] = ab[0] if ab else None
        parts = re.split(r'\s*(Source|Removed):\s*', rest)
        rec['effect'] = parts[0].strip()
        for key, val in zip(parts[1::2], parts[2::2]):
            rec[key.lower()] = val.strip()
        m2 = re.search(r'\s*Note: (.*)$', rec['removed'] or '', re.S)
        if m2:
            rec['removed'] = rec['removed'][:m2.start()].strip()
            rec['notes'] = m2.group(1)
        if rec['id'] in out and not positive:
            return
        out[rec['id']] = rec

    for b in section(pb, 'Conditions', 3):
        if b.kind == 'p':
            parse(b, False)
    for b in section(pb, 'Positive Conditions', 3):
        if b.kind == 'p':
            parse(b, True)
    for r in table_after(section(pb, 'Conditions - full reference', 3), 'Condition')[1:]:
        cid = slug(r[0])
        if cid not in out:
            out[cid] = {'id': cid, 'name': r[0], 'positive': False,
                        'domain': {'body': 'body', 'mind': 'mind', 'spirit': 'spirit'}.get(r[1].lower()),
                        'ability': None, 'effect': r[2], 'source': None, 'removed': None,
                        'source_doc': 'Player Book, Conditions - full reference'}
    for rec in EXTRA_CONDITIONS:
        out.setdefault(rec['id'], dict(rec))
    return list(out.values())


def draft_afflictions(pb):
    sec = section(pb, 'Afflictions', 1)
    overview = {r[0]: r for r in table_after(sec, 'Affliction')[1:]}
    out, cur = [], None
    for b in sec:
        if b.heading == 2:
            cur = None
            if b.text in overview:
                ov = overview[b.text]
                cur = {'id': slug(b.text), 'name': b.text, 'domain': ov[1].lower(), 'contracted_by': ov[2],
                       'incubation': None, 'cure': None, 'stages': []}
                out.append(cur)
        elif cur and b.kind == 'p':
            for label in ('Incubation', 'Cure'):
                v = split_label(b.text, label)
                if v is not None:
                    cur[label.lower()] = v
        elif cur and b.kind == 't' and b.rows[0][0] == 'Stage':
            for stage, gives, takes in b.rows[1:]:
                n, _, name = stage.partition('·')
                cur['stages'].append({'stage': int(n.strip()), 'name': name.strip(), 'gives': gives,
                                      'takes': takes})
    rules = [b.text for b in section(pb, 'Running Afflictions', 2) if b.kind == 'p']
    return {'rules': rules, 'afflictions': out}


# ---------------------------------------------------------------------------------------------------------------
# Powers
# ---------------------------------------------------------------------------------------------------------------

def draft_powers(pb):
    levels = []
    for r in table_after(section(pb, 'Power Levels', 2), 'Level')[1:]:
        levels.append({'level': int(r[0].lstrip('L')), 'base_mana': int(r[1]), 'targets': r[2], 'range': r[3],
                       'duration': r[4], 'damage_heal': r[5], 'scope': r[6]})
    cons = table_after(section(pb, 'Power construction - point budget', 3), 'Component')[1:]
    components, comp = [], None
    for c, opt, pts in cons:
        if c:
            comp = {'component': c, 'options': []}
            components.append(comp)
        comp['options'].append({'option': opt, 'points': pts})
    budget = [{'points': r[0], 'power_level': r[1], 'base_mana': r[2]}
              for r in table_after(section(pb, 'Power construction - point budget', 3), 'Total points')[1:]]
    setting = [b.text for b in section(pb, 'Setting the Power Level', 3) if b.kind == 'p']

    examples, cur, group = [], None, None
    for b in section(pb, 'Full Power List', 1):
        if b.heading == 2:
            group = b.text
            cur = None
        elif b.heading == 3:
            cur = {'id': slug(b.text), 'name': b.text, 'group': group, 'source_text': None, 'ability_text': None,
                   'effect_text': None, 'description': None, 'levels': [], 'surge': []}
            examples.append(cur)
        elif cur and b.kind == 'p':
            m = re.match(r'^Source: (.+?) Ability: (.+?) Effect: (.+)$', b.text)
            if m:
                cur['source_text'], cur['ability_text'], cur['effect_text'] = m.groups()
                cur['description'] = None  # drop text that came before the Source line
                continue
            m = re.match(r'^L(\d) (\d)M · (.+?)(?: → (.*))?$', b.text)
            if m:
                cur['levels'].append({'level': int(m.group(1)), 'mana': int(m.group(2)), 'profile': m.group(3),
                                      'result': m.group(4)})
                continue
            m = re.match(r'^(\d(?:–\d)?) box(?:es)?: (.*)$', b.text)
            if m:
                cur['surge'].append({'boxes': m.group(1), 'text': m.group(2)})
                continue
            if cur['description'] is None:
                cur['description'] = b.text
    examples = [e for e in examples if e['source_text']]  # drops stray headings inside the list
    for e in examples:
        del e['group']  # the group headings are unreliable (Dominate sits under Healing Powers)
        if e['id'] == 'boon-and-bane-severity-summary':
            e['id'], e['name'] = 'untitled-psionic-power', 'Untitled Psionic power'
            flag(e, 'The Player Book has no heading for this Power: the "Boon and Bane Severity Summary" heading '
                    'sits in its place. Needs a name.')
        if not e['levels']:
            flag(e, 'No Power Level lines in the Player Book.')
    return {
        'cost_rule': 'Casters only: Mana cost = the Power\'s Power Level - the character\'s tier Power Level '
                     '(Novice 1 ... Legendary 5), minimum 1. Non-Casters pay the base Mana. Surge is paid in '
                     'full. Basic Cast is free. (DECISIONS.md)',
        'power_levels': levels, 'construction': {'components': components, 'points_to_power_level': budget},
        'setting_the_power_level': setting, 'sources': POWER_SOURCES, 'examples': examples,
    }


# ---------------------------------------------------------------------------------------------------------------
# Core rules tables
# ---------------------------------------------------------------------------------------------------------------

def draft_core(pb):
    boon_menu = [{'id': slug(r[0]), 'name': r[0], 'effect': r[1]}
                 for r in table_after(section(pb, 'The Boon Menu', 3), 'Boon')[1:]]
    boon_choices = {r[0].lower(): (r[2], r[3]) for r in table_after(section(pb, 'The Boon Menu', 3), 'Tier')[1:]}
    bane = {r[0].lower(): r[2] for r in table_after(section(pb, 'Bane Severity', 3), 'Tier')[1:]}
    surge_rows = table_after(section(pb, 'Calculating Without the Tools', 1), 'Boxes')[1:]
    mastery_rows = table_after(section(pb, 'Skill Mastery - effective DC', 3), 'Skill rank')[1:]
    object_dc = table_after(section(pb, 'Skill Mastery - effective DC', 3), 'Object quality')[1:]
    wealth = table_after(section(pb, 'Wealth', 2), 'Tier')[1:]
    quality = table_after(section(pb, 'Weapons and Implements', 2), 'Quality')[1:]

    words = {'One': 1, 'Two': 2, 'Three': 3}
    thresholds = {'natural 20': 20, '19-20': 19, '17-20': 17, '15-20': 15, '13-20': 13}
    tiers = []
    for (tid, name, pl, first), focus_cap, other_cap, gov_cap, surge_max, free_cost in zip(
            TIERS, (3, 4, 5, 6, 7), (2, 3, 4, 5, 6), (5, 7, 9, 11, 13), (3, 4, 5, 6, 7), (0, 1, 2, 3, 'all')):
        bc = boon_choices[tid]
        tiers.append({
            'id': tid, 'name': name, 'power_level': pl, 'levels': [first, first + 3],
            'actions': pl, 'reactions': pl,
            'boon_threshold': thresholds[bc[0].lower().replace('–', '-')], 'boon_choices': words[bc[1]],
            'surge_max': surge_max, 'focus_skill_cap': focus_cap, 'other_skill_cap': other_cap,
            'governing_ability_cap': gov_cap, 'other_ability_cap': 5,
            'mastery_floor_free_up_to': free_cost, 'bane': bane[tid],
        })
    return {
        'tiers': tiers,
        'creation': {
            'build_points': 20, 'ability_min': 1, 'ability_max': 4, 'ability_max_with_bonuses': 5,
            'focus_skills': 6, 'focus_skill_start': 2, 'other_skill_start': 1, 'extra_languages': 2,
            'starting_wealth': 3, 'starting_reputation': 1, 'level': 1,
            'aptitude_ability_bonus': 1, 'aptitude_bonus_skills': 2, 'specialty_bonus_skills': 2,
            'bonus_skill_overlap': 'If a bonus skill is already a Focus Skill, +1 to any other skill instead.',
        },
        'advancement': {
            'skill_points': {'from_level': 2, 'per_level': 6, 'one_per_skill_per_level': True},
            'ability_increase_levels': list(range(2, 21, 2)),
            'pool_increase_levels': [4, 8, 12, 16, 20],
            'tier_change_levels': [5, 9, 13, 17],
            'role_advancement': 'At each tier change: advance a Role you hold by one Step, or begin a new Role '
                                'at Step 1.',
            'focus_skill_swap': 'At each tier change you may replace one Focus Skill with another.',
            'feat_levels': [1, 3, 7, 11, 15, 17, 19],
            'first_feat_tier': 'Basic',
            'capstone': {'level': 17, 'text': None, 'flags': ['To be decided (DECISIONS.md).']},
            'second_specialty_level': 5,
            'governing_ability': 'Any of the nine. Can be changed once per tier with GM approval.',
        },
        'pools': {
            'start': 15,
            'bands': [{'id': 'healthy', 'name': 'Healthy', 'boxes': 5, 'penalty': 0},
                      {'id': 'hurt', 'name': 'Hurt', 'boxes': 5, 'penalty': -1},
                      {'id': 'injured', 'name': 'Injured', 'boxes': 4, 'penalty': -2},
                      {'id': 'broken', 'name': 'Broken', 'boxes': 1, 'penalty': None,
                       'effect': 'Incapacitated'}],
            'growth_order': ['healthy', 'hurt', 'injured'],
            'scars': {'stamina': 'Wound Scar', 'mana': 'Obsession Scar', 'resolve': 'Soul Scar'},
        },
        'domain_mastery': [{'name': 'Basic', 'all_at_least': 2, 'bonus': 1},
                           {'name': 'Expert', 'all_at_least': 4, 'bonus': 2},
                           {'name': 'Superior', 'all_at_least': 6, 'bonus': 3}],
        'initiative': {
            'roll': 'd20 + the primary Domain\'s Deflect Ability (+ Reputation when opponents know the character)',
            'methods': [
                {'id': 'roll', 'name': 'Roll', 'text': 'd20 + primary Domain Deflect Ability. Ties: higher Deflect '
                                                     'Ability, then roll again.'},
                {'id': 'pick-your-place', 'name': 'Pick Your Place',
                 'text': 'Pick from 30, 26, 22, 18, 14, 10, continuing down in fours. No duplicates.'},
                {'id': 'roll-and-swap', 'name': 'Roll and Swap',
                 'text': 'Everyone rolls as normal, then the table swaps numbers freely.'},
            ],
        },
        'deflect': '10 + the Domain\'s Deflect Ability (Agility, Acuity, Serenity), plus armor/shield DR where it '
                   'applies.',
        'boon_menu': boon_menu,
        'surge': [{'boxes': int(r[0]), 'roll_bonus': r[1], 'effect_intensity': r[2], 'fallout': r[3]}
                  for r in surge_rows],
        'effects_rule': 'The Surge level sets an Effect\'s strength (Surge 2 = 1-box intensity). No separate '
                        'Effect cost. A non-Signature Effect is -1 to the roll.',
        'costs_rule': 'Basic Attack, Basic Cast and Basic Press are free. Anything added costs at least 1 box. '
                      'Maneuvers: Mastery Floor by tier. Surge: not reduced except by Surge Discipline.',
        'skill_mastery': [{'rank': r[0], 'dc_reduction': r[1]} for r in mastery_rows],
        'object_dc': [{'quality': r[0], 'dc': int(r[1])} for r in object_dc],
        'wealth_tiers': [{'tier': int(r[0]), 'name': r[1], 'cash_on_hand': r[2], 'gear_ceiling': r[3],
                          'daily_life': r[4]} for r in wealth],
        'quality': [{'name': r[0], 'bonus': int(r[1].lstrip('+')), 'weapon': r[2], 'implement': r[3]}
                    for r in quality],
        'reputation': {'min': 0, 'max': 5, 'start': 1},
    }


# ---------------------------------------------------------------------------------------------------------------
# Genres, maneuvers
# ---------------------------------------------------------------------------------------------------------------

def draft_genres(genres_doc, skills):
    start = next(i for i, b in enumerate(genres_doc) if b.text == 'Genre List')
    out, cur = [], None
    for b in genres_doc[start + 1:]:
        if b.heading == 1:
            if b.text == 'System Mechanics':
                break
            cur = {'id': GENRE_NAMES[b.text.lower()], 'name': b.text, 'description': [], 'notes': [],
                   'skills': [s['id'] for s in skills if GENRE_NAMES[b.text.lower()] in s['genres']]}
            out.append(cur)
        elif cur and b.kind == 'p':
            (cur['notes'] if b.text.startswith('★') else cur['description']).append(b.text.lstrip('★ ').strip())
    for g in out:
        g['description'] = '\n\n'.join(g['description'])
    requires = {'weird-magic': ['magic'], 'cthulhu': ['horror']}
    for g in out:
        if g['id'] in requires:
            g['requires'] = requires[g['id']]
    return out


def draft_maneuvers(srd2_path):
    soup = BeautifulSoup(Path(srd2_path).read_text(encoding='utf-8'), 'html.parser')
    h = soup.find(lambda t: t.name in ('h2', 'h3') and t.get_text(strip=True) == 'Combat Maneuvers Reference')
    out = []
    for tr in h.find_next('table').find('tbody').find_all('tr'):
        name, cost, effect = [td.get_text(' ', strip=True) for td in tr.find_all('td')]
        if name == 'Press':  # DECISIONS.md: Press is the social attack
            continue
        rec = {'id': slug(name), 'name': name, 'cost_text': cost, 'effect': effect}
        m = re.fullmatch(r'(\d) (Stamina|Reaction)', cost)
        if m:
            rec['cost'] = {'boxes' if m.group(2) == 'Stamina' else 'reactions': int(m.group(1))}
            if m.group(2) == 'Stamina':
                rec['cost']['pool'] = 'stamina'
        if name == 'Counter':
            rec['notes'] = 'Overlaps the Duelist Specialty\'s Riposte. Kept for now (DECISIONS.md).'
        out.append(rec)
    return out


# ---------------------------------------------------------------------------------------------------------------
# Gear (Player Book Ch 9, with armor and shields from the SRD, which the Player Book leaves out)
# ---------------------------------------------------------------------------------------------------------------

def html_table(soup, heading, level=None):
    tags = (level,) if level else ('h1', 'h2', 'h3')
    h = soup.find(lambda t: t.name in tags and t.get_text(strip=True) == heading)
    if h is None:
        raise KeyError(f'SRD heading not found: {heading!r}')
    table = h.find_next('table')
    head = [th.get_text(' ', strip=True) for th in table.find('thead').find_all('th')]
    rows = [[td.get_text(' ', strip=True) for td in tr.find_all('td')] for tr in table.find('tbody').find_all('tr')]
    return head, rows


def bonus(text):
    m = re.search(r'([+-]?\d+)', text.replace('−', '-'))
    return int(m.group(1)) if m else None


def draft_gear(pb, srd):
    quality = []
    for b in section(pb, 'Gear Quality', 2):
        m = re.match(r'^(\w+) \[Weapons: ([^|]+)\| Armor: ([^|]+)\| Wealth: ([^\]]+)\]\s*(.*)$', b.text)
        if m:
            tier = re.search(r'Tier (\d)', m.group(4))
            quality.append({'id': slug(m.group(1)), 'name': m.group(1), 'weapon_bonus': bonus(m.group(2)),
                            'armor_dr': m.group(3).strip(), 'min_wealth_tier': int(tier.group(1)) if tier else 1,
                            'examples': m.group(5)})

    period = []
    kind = None
    for b in section(pb, 'Period Equipment', 2):
        if b.heading == 3:
            kind = {'Melee Weapons': 'melee', 'Ranged Weapons': 'ranged',
                    'Clerical and Religious Equipment': 'religious'}.get(b.text)
            continue
        m = re.match(r'^(.+?) \(([^)]*)\):\s*(.*)$', b.text)
        if kind and m:
            q = re.match(r'^(Improvised|Light|Standard|Quality|Masterwork|Legendary) ([+-]\d)', m.group(2))
            rec = {'id': slug(m.group(1)), 'name': m.group(1), 'kind': kind, 'tech_level': 4,
                   'quality': slug(q.group(1)) if q else None, 'bonus': int(q.group(2)) if q else None,
                   'text': m.group(3)}
            if kind == 'religious' and not q:
                rec['quality_text'] = m.group(2)
            period.append(rec)
        elif kind == 'religious' and b.text.startswith(('Crucifix', 'Silver-coated')):
            name, _, text = b.text.partition(':')
            period.append({'id': slug(name), 'name': name, 'kind': kind, 'tech_level': 4, 'quality': None,
                           'bonus': None, 'text': text.strip()})

    _, srd_weapons = html_table(srd, 'Weapons', 'h1')
    weapons = []
    for name, b, typ, rng, props in srd_weapons:
        rec = {'id': slug(re.sub(r'\(.*?\)', '', name)), 'name': name, 'bonus': bonus(b), 'type': typ, 'range': rng,
               'properties': props, 'source_doc': 'JUGGS_SRD_Updated.html'}
        tl = re.search(r'TL (\d+)', name + ' ' + props)
        if tl:
            rec['min_tech_level'] = int(tl.group(1))
        if 'Brawler Role' in props:
            flag(rec, '"Brawler Role" — Brawler is a Specialty.')
        weapons.append(rec)
    period_ids = {p['id'] for p in period}
    weapons = [w for w in weapons if w['id'] not in period_ids]

    categories = []
    for p in srd.find(lambda t: t.name == 'h1' and t.get_text(strip=True) == 'Armor & Shields').find_next_siblings(
            'p', limit=6):
        m = re.match(r'^(.+?) \(DR \+?([^)]*)\):\s*(.*)$', p.get_text(' ', strip=True))
        if m:
            categories.append({'id': slug(m.group(1)), 'name': m.group(1), 'dr': m.group(2).replace('+', ''),
                               'text': m.group(3)})
    _, armor_rows = html_table(srd, 'Armor Reference', 'h2')
    armor = [{'id': slug(re.sub(r'\(.*?\)', '', a)), 'name': a, 'dr': bonus(dr), 'agility_penalty': bonus(pen),
              'tech_level': tl, 'notes': notes} for a, dr, pen, tl, notes in armor_rows]
    _, tl4_rows = html_table(srd, 'TL 4 Armor', 'h2')
    known = {a['id'] for a in armor}
    for a, dr, pen, notes in tl4_rows:
        if slug(a) not in known:
            armor.append({'id': slug(a), 'name': a, 'dr': bonus(dr), 'agility_penalty': bonus(pen), 'tech_level': '4',
                          'notes': notes})
    _, shield_rows = html_table(srd, 'Shields', 'h2')
    shields = [{'id': slug(s), 'name': s, 'dr': bonus(dr), 'benefit': ben, 'tech_level': tl}
               for s, dr, ben, tl in shield_rows]
    REPORT.append('Gear: the SRD "TL 4 Weapons" table disagrees with the Player Book Period Equipment (e.g. '
                  'Flintlock pistol +3 / reload 1 vs Standard +2 / reload 2); the Player Book version is used.')

    tl_rows = table_after(section(pb, 'Chapter 9: Gear', 1), 'TL')[1:]
    tech_levels = [{'level': int(r[0].split()[1]), 'name': r[1], 'era': r[2], 'technology': r[3], 'warfare': r[4],
                    'reference': r[5]} for r in tl_rows]
    return {
        'rules': {
            'weapons': 'Weapons add +0 to +5 to Attack rolls. Melee uses Strength, ranged uses Agility, unless the '
                       'fiction supports another Ability Score. Items stack with weapon quality (DECISIONS.md).',
            'armor': 'Armor and shields give DR against Stamina damage only. Light: no Agility penalty; Medium -1; '
                     'Heavy -2; Powered/Legendary: none.',
        },
        'quality': quality, 'weapons': weapons, 'period_equipment': period, 'armor_categories': categories,
        'armor': armor, 'shields': shields, 'tech_levels': tech_levels,
    }


# ---------------------------------------------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------------------------------------------

ITEM_GENRES = dict(GENRE_NAMES, **{'weird west': 'weird-west'})


def draft_items(doc):
    templates = []
    for b in section(doc, 'The Templates', 1):
        if b.heading == 2:
            cur = {'id': slug(b.text), 'name': b.text, 'summary': None, 'grants': None, 'rating': None,
                   'examples': None}
            templates.append(cur)
        elif b.kind == 'p':
            cur['summary'] = b.text
        elif b.kind == 't':
            for k, v in b.rows[1:]:
                cur[k.lower()] = v
    for t in templates:
        t['has_rating'] = t['id'] in ('enhancement', 'ward', 'reservoir')
    descriptors = []
    for b in section(doc, 'Descriptors', 1):
        if b.heading == 2:
            group = slug(b.text.split('—')[0])
        elif b.kind == 't':
            for name, effect in b.rows[1:]:
                descriptors.append({'id': slug(name), 'name': name, 'group': group, 'effect': effect})
    universal, cur = [], None
    for b in section(doc, 'Universal Items', 1):
        if b.heading == 3:
            cur = {'id': slug(b.text), 'name': b.text, 'template': None, 'rating_text': None, 'names': {}}
            universal.append(cur)
        elif cur and b.kind == 't':
            cur['template'], cur['rating_text'] = slug(b.rows[1][0]), b.rows[1][1]
        elif cur and b.kind == 'p':
            for part in b.text.split('·'):
                g, _, name = part.partition(':')
                gid = ITEM_GENRES.get(g.strip().lower())
                if gid is None:
                    flag(cur, f'Unknown genre {g.strip()!r}.')
                else:
                    cur['names'][gid] = name.strip()
    genre_items = []
    for b in section(doc, 'Genre-Specific Items', 1):
        if b.heading == 2:
            gid = ITEM_GENRES.get(b.text.lower())
        elif b.kind == 't':
            for name, template, text in b.rows[1:]:
                genre_items.append({'id': f'{gid}-{slug(name)}', 'name': name, 'genre': gid,
                                    'template': slug(template), 'text': text})
    building = [b.text for b in section(doc, 'Building Anything Else', 1) if b.kind == 'p']
    building_table = [{'question': q, 'decides': d}
                      for q, d in table_after(section(doc, 'Building Anything Else', 1), 'Question')[1:]]
    return {
        'rules': 'An item is a Template, a Rating (1-5 for Enhancement, Ward and Reservoir; DECISIONS.md) and any '
                 'number of Descriptors. Descriptors never change the Rating. Items stack with weapon quality.',
        'templates': templates, 'descriptors': descriptors, 'universal_items': universal,
        'genre_items': genre_items, 'building': {'text': building, 'questions': building_table},
    }


# ---------------------------------------------------------------------------------------------------------------
# Vehicles
# ---------------------------------------------------------------------------------------------------------------

VEHICLE_SETTINGS = {
    'Fantasy / Historical': ['fantasy'], 'Modern / Espionage': ['modern', 'espionage'],
    'Cyberpunk / Transhumanist': ['cyberpunk', 'transhumanist'], 'Steampunk': ['steampunk'],
    'Interstellar / Space Opera': ['interstellar', 'space-opera'], 'Post-Apocalyptic': ['post-apocalyptic'],
    'Mech': [],
}


def draft_vehicles(doc):
    def rows(heading, first):
        return table_after(section(doc, heading), first)[1:]

    stats = [{'id': slug(s), 'name': s, 'range': r, 'text': t} for s, r, t in rows('THE FIVE NUMBERS', 'Stat')]
    frames = [{'frame': int(f), 'class': c, 'examples': e, 'structure': None if s in ('-', '—') else int(s),
               'armor': a} for f, c, e, s, a in rows('Frame and Scale', 'Frame')]
    scale = [{'difference': d, 'result': r} for d, r in rows('THE SCALE RULE', 'Frame difference')]
    conditions = [{'id': slug(c), 'name': c, 'effect': e} for c, e in rows('VEHICLE CONDITIONS', 'Condition')]
    stations = []
    for st, skill, text in rows('CREW STATIONS', 'Station'):
        rec = {'id': slug(st), 'name': st, 'skill_text': skill, 'roll': None, 'text': text}
        roll = {'pilot': ['acu', 'pilot'], 'engineer': ['int', 'operate'], 'commander': ['int', 'tactics'],
                'sensors': ['acu', 'observe'], 'gunner': ['agi', 'combat-ranged']}.get(rec['id'])
        if roll:
            rec['roll'] = {'ability': roll[0], 'skill': roll[1]}
        if rec['id'] == 'gunner':
            rec['skill_text'] = 'Agility + Combat (Ranged) (DECISIONS.md; the book says "Gunnery skill")'
        stations.append(rec)
    actions = [{'id': slug(a), 'name': a, 'station': s, 'effect': e} for a, s, e in rows('VEHICLE ACTIONS', 'Action')]
    heat = [{'heat': h, 'band': b, 'effect': e} for h, b, e in rows('HEAT', 'Heat')]
    locations = [{'d6': int(d), 'location': l, 'result': r} for d, l, r in rows('HIT LOCATIONS', 'd6')]
    catalog = []
    for b in section(doc, 'Vehicle Catalog', 1):
        if b.heading == 2:
            setting = b.text
        elif b.kind == 't':
            for name, frame, handling, speed, armor, notes in b.rows[1:]:
                catalog.append({'id': slug(name), 'name': name, 'setting': setting,
                                'genres': VEHICLE_SETTINGS.get(setting, []), 'frame': int(frame),
                                'handling': bonus(handling), 'speed': int(speed), 'armor': int(armor),
                                'structure': int(frame) * 5, 'notes': notes})
    for v in catalog:
        if v['setting'] not in VEHICLE_SETTINGS:
            flag(v, f'Unknown setting {v["setting"]!r}.')
        if 'Heat rules apply' in v['notes'] or v['setting'] == 'Mech':
            v['heat'] = True
    building = [{'decision': d, 'how': h} for d, h in rows('Building a Vehicle', 'Decision')]
    return {
        'rules': {
            'structure': 'Structure = Frame x 5 unless the entry says otherwise. It works like Stamina.',
            'surge': 'A vehicle\'s Surge ceiling is its Frame. Surge generates Heat in vehicles that track it.',
            'crew': 'Every crew member acts on their own initiative using their own Actions.',
        },
        'flags': ['Structure "threshold bands apply the same penalties" as a character pool, but Structure runs '
                  '5-25 boxes; how the bands split is to be decided.'],
        'stats': stats, 'frames': frames, 'scale_rule': scale, 'conditions': conditions, 'stations': stations,
        'actions': actions, 'heat': heat, 'hit_locations': locations, 'catalog': catalog, 'building': building,
    }


# ---------------------------------------------------------------------------------------------------------------
# Concepts and backstories (Book of Descriptions, Book of Backstories)
# ---------------------------------------------------------------------------------------------------------------

def draft_concepts(desc_doc, back_doc, role_ids):
    def by_role(doc, one_paragraph):
        out = {}
        role = setting = None
        for b in doc:
            if b.heading == 1:
                m = re.fullmatch(r'The (.+)', b.text)
                role = slug(m.group(1)) if m and slug(m.group(1)) in role_ids else None
                setting = None
            elif role and b.heading == 2:
                setting = b.text
                out.setdefault(role, []).append({'setting': setting, 'text': []})
            elif role and setting and b.kind == 'p':
                out[role][-1]['text'].append(b.text.strip('“”'))
        for entries in out.values():
            for e in entries:
                e['text'] = e['text'][0] if one_paragraph else '\n\n'.join(e['text'])
        return out

    concepts = by_role(desc_doc, True)
    backstories = by_role(back_doc, False)
    out = []
    for rid in sorted(set(concepts) | set(backstories), key=list(role_ids).index):
        out.append({'id': rid, 'role': rid, 'concepts': concepts.get(rid, []),
                    'backstories': [dict(e, title=e['setting'].split('·', 1)[-1].strip(),
                                         setting=e['setting'].split('·', 1)[0].strip())
                                    for e in backstories.get(rid, [])]})
    for rec in out:
        if len(rec['concepts']) != 3 or len(rec['backstories']) != 3:
            flag(rec, f'Expected 3 concepts and 3 backstories, found {len(rec["concepts"])} and '
                      f'{len(rec["backstories"])}.')
    missing = set(role_ids) - {r['id'] for r in out}
    if missing:
        REPORT.append(f'Concepts: no entries for {sorted(missing)}')
    return out


# ---------------------------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------------------------

def main(src, out):
    src, out = Path(src), Path(out)
    if out.exists() and any(out.glob('*.json')):
        sys.exit(f'{out} already holds JSON files. Draft into an empty scratch folder instead.')
    out.mkdir(parents=True, exist_ok=True)
    pb = read_blocks(src / 'JUGGS_Player_Book.docx')
    genres_doc = read_blocks(src / 'JUGGS_Book_of_Genres.docx')

    abilities = draft_abilities(pb)
    skills = draft_skills(pb, genres_doc)
    skill_ids = {s['id'] for s in skills}
    roles = draft_roles(pb, skill_ids)
    role_ids = {r['id'] for r in roles}
    aptitudes = draft_aptitudes(pb, skill_ids)
    specialties = draft_specialties(pb)
    files = {
        'core.json': draft_core(pb),
        'abilities.json': abilities,
        'skills.json': skills,
        'genres.json': draft_genres(genres_doc, skills),
        'roles.json': roles,
        'presets.json': draft_presets(pb, skill_ids, role_ids, {s['id'] for s in specialties},
                                      {a['id'] for a in aptitudes}),
        'aptitudes.json': aptitudes,
        'origins.json': draft_origins(pb),
        'specialties.json': specialties,
        'feats.json': draft_feats(pb, skill_ids, role_ids),
        'effects.json': draft_effects(pb),
        'conditions.json': draft_conditions(pb),
        'afflictions.json': draft_afflictions(pb),
        'powers.json': draft_powers(pb),
        'maneuvers.json': draft_maneuvers(src / 'Downloaded' / 'JUGGS_SRD_2.html'),
        'gear.json': draft_gear(pb, BeautifulSoup((src / 'JUGGS_SRD_Updated.html').read_text(encoding='utf-8'),
                                                  'html.parser')),
        'items.json': draft_items(read_blocks(src / 'JUGGS_Items.docx')),
        'vehicles.json': draft_vehicles(read_blocks(src / 'JUGGS_Vehicles.docx')),
        'concepts.json': draft_concepts(read_blocks(src / 'JUGGS_Book_of_Descriptions.docx'),
                                        read_blocks(src / 'JUGGS_Book_of_Backstories.docx'),
                                        [r['id'] for r in roles]),
    }
    lines = [f'# Draft report ({date.today()})', '', '## Counts', '']
    flagged = []
    for name, data in files.items():
        (out / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        lists = {'records': data} if isinstance(data, list) else {
            k: v for k, v in data.items() if isinstance(v, list) and v and isinstance(v[0], dict) and 'id' in v[0]}
        lines.append(f'- {name}: ' + ', '.join(f'{len(v)} {k}' for k, v in lists.items()))
        if isinstance(data, dict):
            flagged += [f'- {name}: {f}' for f in data.get('flags', [])]
        for rec in (r for v in lists.values() for r in v):
            for f in rec.get('flags', []):
                flagged.append(f'- {name} `{rec["id"]}`: {f}')
    lines += ['', '## Flags', ''] + (flagged or ['None.'])
    lines += ['', '## Other notes', ''] + ([f'- {r}' for r in REPORT] or ['None.'])
    (out / '_report.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
