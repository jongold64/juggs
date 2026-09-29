// Checks for rules.js and character.js, using the real data files. Open tests.html through the local server.
import { loadData } from './data.js';
import { newCharacter, clean } from './character.js';
import * as R from './rules.js';

const results = [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, actual, expected) {
  results.push({ name, pass: same(actual, expected), actual, expected });
}

const D = await loadData('data/');
const make = (changes = {}) => clean(D, { ...newCharacter(), ...changes });

// Tiers
check('Level 1 is Novice', R.tierFor(D, 1).id, 'novice');
check('Level 9 is Veteran', R.tierFor(D, 9).id, 'veteran');
check('Level 20 is Legendary', R.tierFor(D, 20).id, 'legendary');
check('Veteran Surge maximum is 5', R.tierFor(D, 9).surge_max, 5);
check('Heroic Boon threshold is 15', R.tierFor(D, 13).boon_threshold, 15);

// Pools: extra boxes go Healthy, Hurt, Injured, repeating; Broken is the last box.
const sizes = bands => bands.map(b => b.boxes);
check('15-box pool bands', sizes(R.poolBands(D, 0)), [5, 5, 4, 1]);
check('16-box pool bands', sizes(R.poolBands(D, 1)), [6, 5, 4, 1]);
check('18-box pool bands', sizes(R.poolBands(D, 3)), [6, 6, 5, 1]);
check('20-box pool bands', sizes(R.poolBands(D, 5)), [7, 7, 5, 1]);
check('Broken is box 20 at 20 boxes', R.poolBands(D, 5)[3].from, 20);
check('Pool size at Level 1', R.pools(D, make()).stamina.size, 15);
check('Pool size at Level 4', R.pools(D, make({ level: 4 })).mana.size, 16);
check('Pool size at Level 20', R.pools(D, make({ level: 20 })).resolve.size, 20);
check('Toughened adds a box to each pool', R.pools(D, make({ feats: { 1: 'toughened' } })).mana.size, 16);
check('Legendary Endurance: +2 Stamina at the end of Injured',
  sizes(R.pools(D, make({ level: 11, feats: { 11: 'legendary-endurance' } })).stamina.bands), [6, 6, 6, 1]);
check('Defender Step 2 adds a Healthy Stamina box',
  sizes(R.pools(D, make({ level: 5, role: 'defender', roleAdvances: { 5: 'defender' } })).stamina.bands), [7, 5, 4, 1]);
check('Band for 12 marked boxes of 15', R.bandAt(R.poolBands(D, 0), 12).id, 'injured');

// Ability Scores
const spread = { str: 4, tou: 3, agi: 3, int: 2, wil: 2, acu: 2, bel: 1, mor: 1, ser: 2 };
check('BP spent', R.bpSpent(spread), 20);
check('Primary Domain from Build Points', R.primaryDomain(make({ base: spread })), 'body');
check('Tie goes to the chosen Domain',
  R.primaryDomain(make({ base: { str: 3, tou: 2, agi: 2, int: 3, wil: 2, acu: 2, bel: 2, mor: 2, ser: 2 },
                         primaryDomain: 'mind' })), 'mind');
check('Aptitude bonuses add to scores', R.abilityScores(D, make({ base: spread, aptitude: 'soldier' })).str, 5);
check('No creation problems for a valid spread', R.creationProblems(D, make({ base: spread })), []);
check('Aptitude can push a Score to 5 but not 6',
  R.creationProblems(D, make({ base: { ...spread, str: 5, tou: 2 }, aptitude: 'soldier' })).length > 0, true);
check('Even-level increases count', R.abilityScores(D, make({ level: 4, base: spread,
  abilityIncreases: { 2: 'int', 4: 'int' } })).int, 4);
check('Increase at an odd level is ignored', R.abilityScores(D, make({ level: 3, base: spread,
  abilityIncreases: { 3: 'int' } })).int, 2);
check('Governing Ability cap at Seasoned is 7', R.abilityCap(D, make({ governing: 'str' }), 'str', 5), 7);
check('Other Ability cap stays 5', R.abilityCap(D, make({ governing: 'str' }), 'tou', 20), 5);
check('Domain Mastery: all Body 2+ is +1, Spirit with a 1 is 0',
  R.domainMastery(D, spread), { body: 1, mind: 1, spirit: 0 });
check('Domain Mastery +2 at all 4+',
  R.domainMastery(D, { str: 4, tou: 4, agi: 5, int: 1, wil: 1, acu: 1, bel: 1, mor: 1, ser: 1 }).body, 2);

// Skills
const focus = ['combat-melee', 'endure', 'athletics', 'tactics', 'observe', 'evasion'];
const fighter = make({ base: spread, focus });
check('Focus Skill starts at 2', R.skillRank(D, fighter, 'endure'), 2);
check('Other skill starts at 1', R.skillRank(D, fighter, 'stealth'), 1);
check('Aptitude bonus skill becomes Focus', R.focusInfo(D, make({ focus, aptitude: 'savage' })).focus.has('survive'), true);
check('Overlap with a Focus Skill is recorded', R.focusInfo(D, make({ focus, aptitude: 'savage' })).overlaps.length, 1);
check('Overlap +1 goes to the picked skill',
  R.skillRank(D, make({ focus, aptitude: 'savage', overlapPicks: ['stealth'] }), 'stealth'), 2);
check('Skill points add ranks', R.skillRank(D, make({ level: 2, focus, skillPoints: { 2: ['endure'] } }), 'endure'), 3);
check('Skill total = Ability + rank + Domain Mastery', R.skillTotal(D, fighter, 'combat-melee'), 4 + 2 + 1);
check('Persuade uses the Primary Domain Attack Score', R.skillAbility(D, fighter, 'persuade', spread), 'str');
check('Novice Focus cap is 3', R.skillCap(D, fighter, 'endure', 1), 3);
check('Novice other cap is 2', R.skillCap(D, fighter, 'stealth', 1), 2);
check('Over-cap skill point is a problem',
  R.skillPointProblems(D, make({ level: 3, focus, skillPoints: { 2: ['stealth'], 3: ['stealth'] } })).length, 1);
check('Same skill twice in one level is a problem',
  R.skillPointProblems(D, make({ level: 2, focus, skillPoints: { 2: ['endure', 'endure'] } })).length > 0, true);
check('Genre skills hidden without their Genre', R.availableSkills(D, make()).some(s => s.id === 'channel'), false);
check('Magic Genre shows Channel', R.availableSkills(D, make({ genres: ['magic'] })).some(s => s.id === 'channel'), true);
check('Weird Magic needs Magic on too',
  R.availableSkills(D, make({ genres: ['weird-magic'] })).some(s => s.id === 'weird-control'), false);
check('Skill Mastery at rank 5 is 4', R.skillMastery(5), 4);

// Roles
check('Starting Role is Step 1', R.roleSteps(D, make({ role: 'warrior' })), { warrior: 1 });
check('Advancing at tier changes', R.roleSteps(D, make({ level: 13, role: 'warrior',
  roleAdvances: { 5: 'warrior', 9: 'berserker', 13: 'warrior' } })), { warrior: 3, berserker: 1 });
check('Advances above the level do not count',
  R.roleSteps(D, make({ level: 6, role: 'warrior', roleAdvances: { 5: 'warrior', 9: 'warrior' } })), { warrior: 2 });

// Requirements
const ctx = R.requirementContext(D, make({ base: spread, focus, level: 7, role: 'warrior', feats: { 1: 'toughened' } }), 7);
check('Ability requirement met', R.checkClause({ ability: ['str'], min: 3 }, ctx), true);
check('Ability requirement failed', R.checkClause({ ability: ['int'], min: 3 }, ctx), false);
check('Either Ability', R.checkClause({ ability: ['int', 'str'], min: 4 }, ctx), true);
check('Focus Skill requirement', R.checkClause({ focus: ['endure'], all: false }, ctx), true);
check('Both Focus Skills', R.checkClause({ focus: ['endure', 'stealth'], all: true }, ctx), false);
check('Earlier Feat counts', R.checkClause({ feat: ['toughened'] }, ctx), true);
check('Power Level 2 at Level 7', R.checkClause({ power_level_min: 2 }, ctx), true);
check('Role Step', R.checkClause({ role: ['warrior'], step: 1 }, ctx), true);
check('Words cannot be checked', R.checkClause({ text: 'any two Mastery Feats' }, ctx), null);
check('Any-of with one true', R.checkClause({ any: [{ ability: ['int'], min: 5 }, { power_level_min: 2 }] }, ctx), true);
check('Second Wind prerequisites met (Toughened)',
  R.checkRequirements(D.featsById.get('second-wind').requires, ctx).ok, true);
check('A Feat taken at this level does not count for itself',
  R.requirementContext(D, make({ feats: { 1: 'toughened' } }), 1).feats.has('toughened'), false);

// Feat slots
check('Level 1 slot takes Rank A', R.slotAccepts(D, 1, { rank: 'A' }), true);
check('Level 1 slot refuses Rank B', R.slotAccepts(D, 1, { rank: 'B' }), false);
check('Level 19 slot takes Rank D', R.slotAccepts(D, 19, { rank: 'D' }), true);
check('Level 11 slot takes a lower Rank', R.slotAccepts(D, 11, { rank: 'A' }), true);
check('Level 17 slot refuses Rank D', R.slotAccepts(D, 17, { rank: 'D' }), false);
check('Every Feat has a Rank', D.feats.every(f => ['A', 'B', 'C', 'D'].includes(f.rank)), true);

// Costs and standing
check('Caster Power cost: PL 3 at Novice is 2', R.powerCost(3, 1, true), 2);
check('Caster Power cost never below 1', R.powerCost(2, 5, true), 1);
check('Non-Caster pays the full Power Level', R.powerCost(3, 2, false), 3);
check('Novice pays Maneuver cost', R.maneuverCost(D, 1, 1), 1);
check('Seasoned: 1-cost Maneuver free', R.maneuverCost(D, 5, 1), 0);
check('Seasoned: 2-cost Maneuver full', R.maneuverCost(D, 5, 2), 2);
check('Legendary: all Maneuvers free', R.maneuverCost(D, 17, 3), 0);
check('Deflect = 10 + Domain Deflect Score', R.deflect(spread, 'mind'), 12);
check('Initiative bonus: Agility + Body Mastery', R.initiativeBonus(D, make({ base: spread })), 3 + 1);
check('Starting Wealth defaults to Struggling', R.startingWealth(D, make()), 3);
check('Noble starts Wealthy', R.startingWealth(D, make({ aptitude: 'noble' })), 6);
check('Noble starts at Reputation 2', R.reputation(D, make({ aptitude: 'noble' })), 2);
check('Physical is always a Power Source', R.powerSources(D, make()), ['physical']);
check('Channel Focus defaults to Spirit',
  R.powerSources(D, make({ genres: ['magic'], focus: ['channel'] })).includes('spirit'), true);

// Loading old or broken saves
check('Unknown ids are dropped', clean(D, { role: 'no-such-role', feats: { 3: 'nope', 1: 'toughened' } }).feats, { 1: 'toughened' });
check('Level is kept within 1-20', clean(D, { level: 40 }).level, 20);
check('Missing fields get defaults', clean(D, {}).play.trackers.corruption, 0);

// Report
const failed = results.filter(r => !r.pass);
const summary = document.getElementById('summary');
summary.className = failed.length ? 'fail' : 'pass';
summary.textContent = failed.length ? `${failed.length} of ${results.length} checks failed.` : `All ${results.length} checks passed.`;
document.getElementById('list').innerHTML = results.map(r => `<li class="${r.pass ? 'pass' : 'fail'}">${r.pass ? '✓' : '✗'} ${
  r.name}${r.pass ? '' : ` — got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)}`}</li>`).join('');
