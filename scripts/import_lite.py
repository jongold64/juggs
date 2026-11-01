"""Import Feats, Specialties and spells from the Lite books into the data files.

    python scripts/import_lite.py "<folder with the books>" <data folder>

The books are still changing, so this can be run again; try it on a copy of data/ and compare by hand. It replaces
data/feats.json, and the "spells" and "sources" lists in data/powers.json. In data/specialties.json it replaces what the books give
(Steps, summary, synergy text, Fallout) and keeps what they do not (bonus skills, category, synergy requirement).
Requirements it cannot read are kept as words, which the builder shows as "check by hand".
"""
import json
import re
import sys
from pathlib import Path

from docx_reader import read_blocks

ABILITY = {'Strength': 'str', 'Toughness': 'tou', 'Agility': 'agi', 'Intellect': 'int', 'Willpower': 'wil',
           'Acuity': 'acu', 'Belief': 'bel', 'Morale': 'mor', 'Serenity': 'ser'}
TIERS = {'Novice': 1, 'Seasoned': 2, 'Veteran': 3, 'Heroic': 4, 'Legendary': 5}
DOMAINS = {'Universal Feats': 'universal', 'Body Feats': 'body', 'Mind Feats': 'mind', 'Spirit Feats': 'spirit',
           'Social Feats': 'social', 'Universal': 'universal', 'Body': 'body', 'Mind': 'mind', 'Spirit': 'spirit',
           'Social': 'social', 'Specialty Masteries': 'mastery', 'Cross-Specialty Feats': 'cross',
           'Stepped Magic Feats': 'magic', 'Gated Magic Feats': 'magic'}


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower().replace('’', '').replace("'", '')).strip('-')


def split_table_text(text):
    """'Words. At the table: more words.' -> ('Words.', 'more words.')"""
    head, sep, tail = text.partition('At the table:')
    return head.strip(), tail.strip() if sep else ''


class Reader:
    """Turns the words of a "Requires:" line into requirement clauses."""

    def __init__(self, feats, specialties, roles, skills):
        self.feats = feats            # name -> id
        self.specialties = specialties
        self.roles = roles
        self.skills = skills

    def one(self, part):
        part = part.strip().rstrip('.')
        if part in ('', 'None'):
            return []
        m = re.fullmatch(r'(Novice|Seasoned|Veteran|Heroic|Legendary) tier(?: or above|\+)?', part)
        if m:
            return [{'power_level_min': TIERS[m[1]]}]
        if part in ('Magic Overlay', 'Magic Genre'):
            return [{'genre': ['magic']}]
        if part == 'Weird Magic Overlay':
            return [{'genre': ['weird-magic']}]
        m = re.fullmatch(r'(.+?) Role(?: at (Novice|Seasoned|Veteran|Heroic|Legendary) tier)?', part)
        if m and all(n in self.roles for n in m[1].split(' or ')):
            clause = [{'role': [self.roles[n] for n in m[1].split(' or ')], 'step': 1}]
            return clause + ([{'power_level_min': TIERS[m[2]]}] if m[2] else [])
        m = re.fullmatch(r'((?:\w+ \d\+)(?: or \w+ \d\+)*)', part)
        if m:
            bits = re.findall(r'(\w+) (\d)\+', part)
            if all(b[0] in ABILITY for b in bits) and len({b[1] for b in bits}) == 1:
                return [{'ability': [ABILITY[b[0]] for b in bits], 'min': int(bits[0][1])}]
        m = re.fullmatch(r'(.+?) (\d)\+', part)
        if m and m[1] in self.skills:
            return [{'skill': self.skills[m[1]], 'rank_min': int(m[2])}]
        m = re.fullmatch(r'(.+?) as a Focus Skill', part)
        if m and m[1] in self.skills:
            return [{'focus': [self.skills[m[1]]], 'all': False}]
        m = re.fullmatch(r'(.+?) at (Novice|Seasoned|Veteran|Heroic|Legendary) tier(?: or above)?', part)
        if m and m[1] in self.specialties:
            return [{'specialty': [self.specialties[m[1]]]}, {'power_level_min': TIERS[m[2]]}]
        if m and m[1] in self.feats:
            return [{'feat': [self.feats[m[1]]]}, {'power_level_min': TIERS[m[2]]}]
        m = re.fullmatch(r'An? (Combat|Magical|Spiritual|Social) Specialty and an? (Combat|Magical|Spiritual|Social) Specialty', part)
        if m:
            return [{'specialty_category': m[1].lower()}, {'specialty_category': m[2].lower()}]
        if all(n in self.feats for n in part.split(' or ')):
            return [{'feat': [self.feats[n] for n in part.split(' or ')]}]
        return None

    def read(self, text):
        out = []
        for part in re.split(r',\s*', text):
            got = self.one(part)
            if got is None:   # anything unread: keep the whole line as words, so nothing is half-checked
                return [{'text': text}]
            out += got
        return out


def feats_from(blocks, magic):
    """All Feats in one book: [{name, kind, domain, prerequisite_text, text, at_the_table, steps}]."""
    out = []
    kind = domain = cur = None
    for b in blocks:
        if b.heading == 1:
            cur = None
            kind = {'Stepped Feats': 'stepped', 'Gated Feats': 'gated'}.get(b.text, kind if b.text == 'Magic Feats' else None)
            if b.text == 'Magic Feats':
                kind = 'magic'
            continue
        if kind is None:
            continue
        if b.heading == 2:
            cur = None
            if b.text in DOMAINS:
                domain = DOMAINS[b.text]
                this_kind = kind
                if kind == 'magic':
                    this_kind = 'stepped' if b.text.startswith('Stepped') else 'gated'
                if b.text in ('Specialty Masteries', 'Cross-Specialty Feats'):
                    this_kind = 'gated'
                section_kind = this_kind
            continue
        if b.heading == 3:
            cur = {'id': slug(b.text), 'name': b.text, 'kind': section_kind, 'domain': domain, 'magic': magic,
                   'prerequisite_text': 'None', 'text': '', 'at_the_table': '', 'steps': []}
            out.append(cur)
            continue
        if not cur:
            continue
        if b.kind == 't':
            if b.rows and b.rows[0][0] == 'Tier':
                for row in b.rows[1:]:
                    cur['steps'].append({'tier': row[0], 'level': int(row[1]), 'text': row[2]})
            continue
        if b.text.startswith('Requires:'):
            cur['prerequisite_text'] = b.text[len('Requires:'):].strip()
        elif b.text.startswith('At the table:'):
            cur['at_the_table'] = b.text[len('At the table:'):].strip()
        elif b.text:
            cur['text'] = f"{cur['text']}\n{b.text}".strip()
    return out


def specialties_from(blocks):
    """Specialty tables: { name: {steps, summary, synergy_text, fallout} }."""
    out = {}
    cur = None
    for b in blocks:
        if b.kind == 't' and b.rows and ' · ' in b.rows[0][0] and b.rows[1][0].startswith('Novice'):
            name = b.rows[0][0].split(' · ')[0]
            steps = []
            for row in b.rows[1:]:
                m = re.fullmatch(r'(\w+) \(Level (\d+)\)', row[0])
                text, table = split_table_text(row[1])
                steps.append({'tier': m[1], 'level': int(m[2]), 'text': text, 'at_the_table': table})
            cur = out[name] = {'steps': steps, 'summary': '', 'synergy': None, 'fallout': ''}
        elif cur and b.kind == 'p':
            if b.text.startswith('Fallout'):
                cur['fallout'] = b.text.split(':', 1)[1].strip()
                cur = None
            elif b.text:
                summary, _, synergy = b.text.partition('Synergy:')
                cur['summary'] = summary.strip()
                cond, _, effect = synergy.partition('—')
                cur['synergy'] = (cond.strip(), effect.strip())
    return out


def spells_from(blocks):
    out = []
    active = False
    cur = None
    for b in blocks:
        if b.heading == 2:
            active = b.text == 'Spells A to Z'
            continue
        if not active:
            continue
        if b.heading == 3:
            cur = {'id': slug(b.text), 'name': b.text, 'sources_text': '', 'effect_text': '', 'pace': '', 'reskin': '', 'steps': []}
            out.append(cur)
        elif cur and b.kind == 't':
            for row in b.rows[1:]:
                reach, targets, duration = [x.strip() for x in row[2].split(' · ', 2)]
                cur['steps'].append({'level': int(row[0]), 'pl': int(row[1]), 'reach': reach, 'targets': targets,
                                     'duration': duration, 'text': row[3]})
        elif cur and b.text and not cur['pace']:
            parts = [x.strip() for x in b.text.split(' · ')]
            for p in parts:
                if p in ('Quick', 'Steady', 'Measured', 'Slow', 'Epic'):
                    cur['pace'] = p
                elif p.startswith('Reskin:'):
                    cur['reskin'] = p[len('Reskin:'):].strip()
            before = parts[:[i for i, p in enumerate(parts) if p == cur['pace']][0]]
            cur['sources_text'] = before[0] if before else ''
            cur['effect_text'] = before[1] if len(before) > 1 else ''
    return out


SOURCE_IDS = {'Arcane (Magic)': 'arcane', 'Divine (Miracles)': 'divine', 'Innate': 'innate', 'Psionic': 'psionic',
              'Spirit / Shamanic': 'spirit', 'Weird Science': 'weird-science', 'Alchemical': 'alchemical',
              'Blood Magic': 'blood-magic', 'Chi / Ki (Internal Discipline)': 'chi', 'Cybernetic': 'cybernetic',
              'Demonic / Pact-Bound': 'demonic', 'Nature / Primal': 'nature', 'Runic / Inscription': 'runic',
              'Void': 'void'}
BASIC_CAST = {'arcane': 'mana', 'psionic': 'mana', 'divine': 'resolve', 'spirit': 'resolve', 'innate': 'stamina', 'void': 'stamina'}


def sources_from(blocks):
    """The 14 Power Sources: [{id, name, abilities, pools_text, tier, text}], core ones first as in the book."""
    out = []
    active = False
    cur = None
    for b in blocks:
        if b.heading == 1:
            active = b.text == 'Power Sources'
            cur = None
        elif active and b.heading == 3 and b.text in SOURCE_IDS:
            sid = SOURCE_IDS[b.text]
            cur = {'id': sid, 'name': b.text.split(' (')[0], 'abilities': [], 'pools_text': '',
                   'tier': 'core' if len(out) < 6 else 'own Source' if sid == 'void' else 'expansion', 'basic_cast_pool': BASIC_CAST.get(sid), 'text': []}
            out.append(cur)
        elif active and b.heading:
            cur = None
        elif cur and b.kind == 'p' and b.text:
            if b.text.startswith('Ability:'):
                head = b.text.split(' | ')
                cur['abilities'] = [ABILITY[w] for w in re.findall(r'\w+', head[0]) if w in ABILITY]
                cur['pools_text'] = head[1].replace('Pools:', '').strip() if len(head) > 1 else ''
                cur['text'].append(' | '.join(head[2:]))
            else:
                cur['text'].append(b.text)
    return out


def main(books, data):
    books, data = Path(books), Path(data)
    load = lambda n: json.loads((data / f'{n}.json').read_text(encoding='utf-8'))
    feats_book = read_blocks(books / 'JUGGS_Book_of_Feats.docx')
    powers_book = read_blocks(books / 'JUGGS_Book_of_Powers.docx')

    feats = feats_from(feats_book, False) + feats_from(powers_book, True)
    specialties = load('specialties')
    reader = Reader({f['name']: f['id'] for f in feats}, {s['name']: s['id'] for s in specialties},
                    {r['name']: r['id'] for r in load('roles')}, {s['name']: s['id'] for s in load('skills')})
    for f in feats:
        f['requires'] = reader.read(f['prerequisite_text'])
    seen = set()
    for f in feats:
        if f['id'] in seen:
            sys.exit(f"Two Feats named {f['name']}")
        seen.add(f['id'])
    (data / 'feats.json').write_text(json.dumps(feats, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    found = {**specialties_from(feats_book), **specialties_from(powers_book)}
    for s in specialties:
        got = found.get(s['name'])
        if not got:
            sys.exit(f"Specialty {s['name']} is not in the books")
        s['steps'] = got['steps']
        s['summary'] = got['summary']
        s['fallout'] = got['fallout']
        if got['synergy']:
            s['synergy'] = {**s.get('synergy', {}), 'condition_text': got['synergy'][0], 'effect': got['synergy'][1]}
        s.pop('abilities', None)
    (data / 'specialties.json').write_text(json.dumps(specialties, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    powers = load('powers')
    powers['spells'] = spells_from(powers_book)
    # Physical (everyone) is not in the books' list.
    kept = {s['id']: s for s in powers['sources']}
    new = sources_from(powers_book)
    for s in new:
        s['default_from_focus'] = kept.get(s['id'], {}).get('default_from_focus', [])
    powers['sources'] = [kept['physical'], *new]
    (data / 'powers.json').write_text(json.dumps(powers, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    unread = [f['name'] for f in feats if any('text' in c for c in f['requires'])]
    kinds = {k: sum(1 for f in feats if f['kind'] == k) for k in ('stepped', 'gated')}
    print(f"{len(feats)} Feats {kinds}, {len(specialties)} Specialties, {len(powers['spells'])} spells.")
    print(f"{len(unread)} requirements kept as words: {', '.join(unread)}")


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
