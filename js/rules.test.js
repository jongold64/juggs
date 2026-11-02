// Checks for rules.js and character.js, using the real data files. Open tests.html through the local server.
import { loadData } from './data.js';
import { newCharacter, clean } from './character.js';
import * as R from './rules.js';
import { weirdResult } from './weird.js';

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
  sizes(R.pools(D, make({ level: 5, role: 'defender' })).stamina.bands), [7, 5, 4, 1]);
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
check('Other Ability cap stays 5', R.abilityCap(D, make({ governing: 'str' }), 'int', 20), 5);
check('Other two Scores in the governing Domain cap at 6 from Veteran',
  [R.abilityCap(D, make({ governing: 'str' }), 'tou', 8), R.abilityCap(D, make({ governing: 'str' }), 'tou', 9)], [5, 6]);
check('Domain Mastery: below 4 gives nothing', R.domainMastery(D, spread), { body: 0, mind: 0, spirit: 0 });
const allAt = n => Object.fromEntries(R.ABILITIES.map(a => [a, n]));
check('Domain Mastery +1 at all 4+', R.domainMastery(D, allAt(4)).body, 1);
check('Domain Mastery +2 at all 6+', R.domainMastery(D, allAt(6)).mind, 2);

// Skills
const focus = ['combat-melee', 'endure', 'athletics', 'analyze', 'observe', 'evasion'];
const fighter = make({ base: spread, focus });
check('Focus Skill starts at 2', R.skillRank(D, fighter, 'endure'), 2);
check('Other skill starts at 1', R.skillRank(D, fighter, 'stealth'), 1);
check('Aptitude bonus skill becomes Focus', R.focusInfo(D, make({ focus, aptitude: 'savage' })).focus.has('survive'), true);
check('Overlap with a Focus Skill is recorded', R.focusInfo(D, make({ focus, aptitude: 'savage' })).overlaps.length, 1);
check('Overlap +1 goes to the picked skill',
  R.skillRank(D, make({ focus, aptitude: 'savage', overlapPicks: ['stealth'] }), 'stealth'), 2);
check('Skill points add ranks', R.skillRank(D, make({ level: 2, focus, skillPoints: { 2: ['endure'] } }), 'endure'), 3);
check('Skill total = Ability + rank + Domain Mastery', R.skillTotal(D, fighter, 'combat-melee'), 4 + 2);
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

// Roles
check('Nine Roles and twenty-one Archetypes', [D.roles.length, D.archetypes.length], [9, 21]);
check('Archetype Signatures are Effects or Maneuvers', D.archetypes.every(x => D.effectsById.has(x.signature_effect) || D.maneuversById.has(x.signature_effect)), true);
check('Starting Role is Step 1', R.roleSteps(D, make({ role: 'warrior' })), { warrior: 1 });
check('A Role has the Steps its tier has reached', R.roleSteps(D, make({ level: 13, role: 'warrior' })), { warrior: 4 });
check('A further Role sits in a Feat slot at the current tier',
  R.roleSteps(D, make({ level: 9, role: 'warrior', feats: { 7: 'role:defender' } })), { warrior: 3, defender: 3 });
check('Not before its slot', R.roleSteps(D, make({ level: 5, role: 'warrior', feats: { 7: 'role:defender' } })), { warrior: 2 });
check('Old Role advancement: same Role just drops', clean(D, { level: 9, role: 'warrior', roleAdvances: { 5: 'warrior', 9: 'warrior' } }).feats, {});
check('Old second Role takes an open slot', clean(D, { level: 9, role: 'warrior', roleAdvances: { 5: 'defender' } }).feats, { 7: 'role:defender' });
check('Cut Role becomes its core Role', clean(D, { role: 'investigator' }).role, 'expert');
check('Artificer becomes Expert', clean(D, { role: 'artificer' }).role, 'expert');
check('Cut Role keeps its Feat', (x => [x.role, x.feats[1]])(clean(D, { role: 'hunter' })), ['scout', 'marked-prey']);
check('No open slot: it goes in the notes', /battle-fury/.test(clean(D, { role: 'berserker', feats: { 1: 'toughened' } }).notes), true);
check('A second clean changes nothing', (x => clean(D, x))(clean(D, { level: 9, role: 'hunter', roleAdvances: { 5: 'defender' } })).feats, clean(D, { level: 9, role: 'hunter', roleAdvances: { 5: 'defender' } }).feats);
check('Old Element Source becomes Nature', clean(D, { powerSources: ['element'] }).powerSources, ['nature']);
check('Second Stepped Feat instead of a free Specialty', R.featsTaken(D, make({ bonusFeat: 'toughened' })), ['toughened']);
check('Not alongside a free Specialty', make({ bonusFeat: 'toughened', specialties: [{ id: 'striker', level: 1 }] }).bonusFeat, '');
check('It must be Stepped', make({ bonusFeat: 'ghost' }).bonusFeat, '');
check('Frenzy replaces the Berserker Feat', [D.featsById.has('frenzy'), D.featsById.has('berserker')], [true, false]);
check('Feat requiring a Role', R.checkRequirements(D.featsById.get('combat-triage').requires, R.requirementContext(D, make({ role: 'medic', focus: ['survive'] }), 1)).ok, true);

// Requirements
const ctx = R.requirementContext(D, make({ base: spread, focus, level: 7, role: 'warrior', feats: { 1: 'toughened' } }), 7);
check('Ability requirement met', R.checkClause({ ability: ['str'], min: 3 }, ctx), true);
check('Ability requirement failed', R.checkClause({ ability: ['int'], min: 3 }, ctx), false);
check('Either Ability', R.checkClause({ ability: ['int', 'str'], min: 4 }, ctx), true);
check('Focus Skill requirement', R.checkClause({ focus: ['endure'], all: false }, ctx), true);
check('Both Focus Skills', R.checkClause({ focus: ['endure', 'stealth'], all: true }, ctx), false);
check('Earlier Feat counts', R.checkClause({ feat: ['toughened'] }, ctx), true);
check('Seasoned tier at Level 7', R.checkClause({ power_level_min: 2 }, ctx), true);
check('Role Step', R.checkClause({ role: ['warrior'], step: 1 }, ctx), true);
check('Words cannot be checked', R.checkClause({ text: 'any two Mastery Feats' }, ctx), null);
check('Any-of with one true', R.checkClause({ any: [{ ability: ['int'], min: 5 }, { power_level_min: 2 }] }, ctx), true);
check('A Feat taken at this level does not count for itself',
  R.requirementContext(D, make({ feats: { 1: 'toughened' } }), 1).feats.has('toughened'), false);

// Feat slots
const gated = D.feats.find(f => f.kind === 'gated');
const stepped = D.feats.find(f => f.kind === 'stepped');
check('Book counts: 88 Stepped and 49 Gated Feats', [D.feats.filter(f => f.kind === 'stepped').length, D.feats.filter(f => f.kind === 'gated').length], [88, 49]);
check('Stepped Feats fit Level 1', R.slotAccepts(D, 1, stepped), true);
check('Gated Feats wait for Level 11', [R.slotAccepts(D, 7, gated), R.slotAccepts(D, 11, gated)], [false, true]);
check('A Stepped Feat shows its Steps by level', R.stepsAt(stepped, 9).length, 3);
check('Toughened grows by tier', [1, 5, 13].map(level => R.pools(D, make({ level: level, feats: { 1: 'toughened' } })).mana.size - R.pools(D, make({ level })).mana.size), [1, 2, 3]);
const oldSave = { level: 9, specialties: [{ id: 'striker', level: 1 }, { id: 'empath', level: 5 }],
  feats: { 1: 'toughened', 3: 'specialty-ability-2', 7: 'surge-discipline-1' }, featChoices: { 3: 'striker' } };
check('Old unlock Feats drop and a second Specialty takes the open slot', clean(D, oldSave).feats, { 1: 'toughened', 3: 'specialty:martyr', 7: 'surge-discipline' });
check('The slot Specialty counts as held', R.specialtiesHeld(D, clean(D, oldSave)).map(s => s.id), ['striker', 'martyr']);
check('Its bonus skills arrive with the slot', R.bonusSkills(D, clean(D, oldSave)).some(b => b.from === 'Martyr'), true);
const noRoom = clean(D, { level: 5, specialties: [{ id: 'striker', level: 1 }, { id: 'guardian', level: 5 }], feats: { 1: 'toughened', 3: 'fleet' } });
check('No open slot: the Specialty stays, with a warning', [R.specialtiesHeld(D, noRoom).length, R.featProblems(D, noRoom).length], [2, 1]);
check('An old Gated Feat below Level 11 stays, with a warning', R.featProblems(D, clean(D, { level: 7, feats: { 7: 'ghost' } })).length, 1);
check('Two old Surge Disciplines become one Feat', clean(D, { level: 7, feats: { 1: 'surge-discipline-1', 3: 'surge-discipline-2' } }).feats, { 1: 'surge-discipline' });
check('Capstone is a Gated Feat, from Level 17', [clean(D, { capstone: 'toughened' }).capstone, R.featsTaken(D, make({ level: 17, capstone: gated.id })).includes(gated.id), R.featsTaken(D, make({ level: 16, capstone: gated.id })).includes(gated.id)], ['', true, false]);

// Costs and standing
check('Level Discount: none at Level 5', R.powerCost(D, 3, 5, true), 3);
check('Level Discount: PL 3 at Level 9 is 2', R.powerCost(D, 3, 9, true), 2);
check('Level Discount: PL 5 at Level 18 is 2', R.powerCost(D, 5, 18, true), 2);
check('Level Discount never below 1', R.powerCost(D, 2, 18, true), 1);
check('No discount pays the full Power Level', R.powerCost(D, 3, 18, false), 3);
check('Casters and Channelers have the Level Discount',
  ['caster', 'channeler', 'warrior'].map(role => R.hasLevelDiscount(D, make({ role }))), [true, true, false]);
check('Hit Cap is 5 + tier number', D.core.tiers.map(t => t.hit_cap), [6, 7, 8, 9, 10]);
check('Surge raises the Hit Cap', R.hitCap(D, 9, 3), 11);
check('Deflect tier bonus', D.core.tiers.map(t => t.deflect_bonus), [0, 2, 4, 6, 8]);
check('Deflect adds the tier bonus', R.deflectFor(D, make({ base: spread, level: 9 }), 'mind'), 10 + 2 + 4);
check('Cash on Hand is Wealth Tier × multiplier', [1, 3, 8].map(w => R.cashOnHand(D, w)), [1, 24, 2048]);
check('Boon Menu has no Tempo at Novice', R.boonMenu(D, 1).some(b => b.id === 'tempo'), false);
check('Boon choices by tier', D.core.tiers.map(t => t.boon_choices), [1, 1, 2, 2, 3]);
check('Bane Menu choices by tier', D.core.tiers.map(t => t.bane_choices), [0, 1, 2, 2, 3]);
check('Novice pays Maneuver cost', R.maneuverCost(D, 1, 1), 1);
check('Seasoned: 1-cost Maneuver free', R.maneuverCost(D, 5, 1), 0);
check('Seasoned: 2-cost Maneuver full', R.maneuverCost(D, 5, 2), 2);
check('Legendary: all Maneuvers free', R.maneuverCost(D, 17, 3), 0);
check('Deflect = 10 + Domain Deflect Score', R.deflect(spread, 'mind'), 12);
check('Initiative bonus: Agility + Body Mastery', R.initiativeBonus(D, make({ base: spread })), 3);
check('Starting Wealth defaults to Struggling', R.startingWealth(D, make()), 3);
check('Noble starts Wealthy', R.startingWealth(D, make({ aptitude: 'noble' })), 6);
check('Noble starts at Reputation 2', R.reputation(D, make({ aptitude: 'noble' })), 2);
check('Physical is always a Power Source', R.powerSources(D, make()), ['physical']);
check('Channel Focus defaults to Spirit',
  R.powerSources(D, make({ genres: ['magic'], focus: ['channel'] })).includes('spirit'), true);

// Powers
const made = (changes = {}) => ({ reach: 'near', targets: 'one', duration: 'instant', impact: 'none', force: 0, ...changes });
check('Plain Power is PL 1', R.madePowerLevel(D, made()), 1);
check('Book example: fly for the fight is PL 3', R.madePowerLevel(D, made({ duration: 'scene', impact: 'major' })), 3);
check('Book example: fire across the hall is PL 3', R.madePowerLevel(D, made({ reach: 'far', targets: 'several' })), 3);
check('Force adds +1 each', R.madePowerLevel(D, made({ force: 2 })), 3);
check('Above 5 is flagged and held at 5', (s => [s.powerLevel, s.over])(R.madePowerSummary(D, make(), made({ reach: 'anywhere', targets: 'everyone', duration: 'hours' }))), [5, true]);
check('Max usable Power Level', [1, 4, 20].map(R.maxPowerLevel), [2, 5, 5]);
check('No discount for a non-Caster', R.madePowerSummary(D, make({ level: 12 }), made({ force: 2 })).mana, 3);
check('Caster at Level 12 pays PL - 2', R.madePowerSummary(D, make({ level: 12, role: 'caster' }), made({ force: 2 })).mana, 1);
check('Channeler at Level 12 pays PL - 2', R.madePowerSummary(D, make({ level: 12, role: 'channeler' }), made({ force: 3 })).mana, 2);
check('Cantrip costs 1 Mana without Cast or Channel 2+', R.madePowerSummary(D, make(), made({ reach: 'touch' })).mana, 1);
const lowMagic = { ...spread, int: 1, bel: 1 };
check('Practitioner: Focus Cast with Ability 1 totals 3', R.isPractitioner(D, make({ base: lowMagic, genres: ['magic'], focus: ['cast-attack'] })), true);
check('Practitioner: non-Focus Cast with Ability 2 totals 3', R.isPractitioner(D, make({ base: { ...lowMagic, int: 2 }, genres: ['magic'] })), true);
check('Not a practitioner: rank 1 + Ability 1 totals 2', R.isPractitioner(D, make({ base: lowMagic, genres: ['magic'] })), false);
check('Not a practitioner without the Magic Genre', R.isPractitioner(D, make({ base: { ...lowMagic, int: 4 } })), false);
check('Cantrip is free for a practitioner', R.madePowerSummary(D, make({ base: lowMagic, genres: ['magic'], focus: ['cast-attack'] }), made({ reach: 'touch' })).mana, 0);
check('Cantrip costs 1 Mana below a total of 3', R.madePowerSummary(D, make({ base: lowMagic, genres: ['magic'] }), made({ reach: 'touch' })).mana, 1);
check('Near range is not a cantrip', R.madePowerSummary(D, make({ genres: ['magic'], focus: ['cast-attack'] }), made()).mana, 1);
const fireball = D.spellsById.get('fireball');
check('109 spells, 5 Steps each', [D.powers.spells.length, D.powers.spells.every(s => s.steps.length === 5)], [109, true]);
check('Measured pace unlocks at 1, 5, 9, 13, 17', fireball.steps.map(s => s.level), [1, 5, 9, 13, 17]);
check('Steps unlocked by level', R.stepsAt(fireball, 9).map(s => s.pl), [1, 2, 3]);
check('Standard Origin: +1 rank to each of two picked skills', [R.skillRank(D, make({ origin: 'standard', originPicks: ['trade', 'perform'] }), 'trade') - R.skillRank(D, make(), 'trade'),
  R.skillRank(D, make({ origin: 'standard', originPicks: ['trade', 'perform'] }), 'perform') - R.skillRank(D, make(), 'perform')], [1, 1]);
check('Other Origins keep no skill picks', clean(D, { origin: 'stoneborn', originPicks: ['trade'] }).originPicks, []);
check('A Maneuver can be the Signature', [clean(D, { signature: { offensive: 'knockdown' } }).signature.offensive, clean(D, { signature: { offensive: 'nonsense' } }).signature.offensive], ['knockdown', '']);
check('Signature DR is the tier number', [1, 5, 9, 13, 17].map(level => R.signatureDR(D, make({ level }))), [1, 2, 3, 4, 5]);
const caster1 = make({ genres: ['magic'], focus: ['cast-attack'] });
check('Near utility cantrip is free for a practitioner', R.spellStepSummary(D, caster1, D.spellsById.get('message').steps[0]).mana, 0);
check('Self cantrip is free for a practitioner', R.spellStepSummary(D, caster1, D.spellsById.get('disguise-self').steps[0]).mana, 0);
check('Near PL 1 attack is not a cantrip', R.spellStepSummary(D, caster1, D.spellsById.get('counterspell').steps[0]).mana, 1);
check('Spell Step Mana with the discount', R.spellStepSummary(D, make({ level: 9, role: 'caster' }), fireball.steps[2]).mana, 2);
check('Old example Power becomes its spell', clean(D, { powers: [{ name: 'Arcane Bolt', example: 'arcane-bolt', exampleLevel: 2 }] }).powers[0].spell, 'arcane-bolt');
check('Old Mend example becomes Mend Wounds', clean(D, { powers: [{ example: 'mend', exampleLevel: 1 }] }).powers[0].spell, 'mend-wounds');
const oldPower = clean(D, { powers: [{ name: 'Storm', source: 'weird', range: 'far', targets: 'multi-6', duration: 'rounds', effect: 'gravity',
  conditions: ['stunned', 'dazed'], summon: 'grunt', focusItem: true }] }).powers[0];
check('Old built Power maps to the upgrades', [oldPower.reach, oldPower.targets, oldPower.duration, oldPower.effect, oldPower.source],
  ['far', 'several', 'scene', 'force', 'weird-science']);
check('What the upgrades cannot hold goes in notes', /Summon: grunt/.test(oldPower.notes) && /Focus Item/.test(oldPower.notes), true);
check('A migrated Power survives a second clean', clean(D, { powers: [oldPower] }).powers[0], oldPower);
check('Power Sources: Physical + the 13 + Void', D.powers.sources.length, 15);
check('Old declared Weird becomes Weird Science', clean(D, { powerSources: ['weird', 'void'] }).powerSources, ['weird-science', 'void']);

// Gear and items
const warrior = make({ base: spread, focus, weapons: [{ name: 'Sword', quality: 'standard', kind: 'melee' }] });
check('Sword attack = Str 4 + Combat (Melee) 2 + Standard 2',
  R.weaponAttack(D, warrior, warrior.weapons[0]).total, 8);
const bow = { name: 'Bow', quality: 'quality', kind: 'ranged' };
check('Ranged uses Agility and Combat (Ranged)', R.weaponAttack(D, make({ base: spread, focus }), bow).total, 3 + 1 + 3);
check('Attack Enhancement stacks with quality', R.weaponAttack(D, make({ base: spread, focus,
  items: [{ name: 'Flame Tongue', template: 'enhancement', rating: 3, appliesTo: 'attack' }] }), warrior.weapons[0]).total, 11);
check('Only the highest Enhancement counts', R.enhancements(make({ items: [
  { template: 'enhancement', rating: 2, appliesTo: 'attack' }, { template: 'enhancement', rating: 4, appliesTo: 'attack' }] })).attack, 4);
check('Skill Enhancement adds to that skill', R.skillTotal(D, make({ base: spread, focus,
  items: [{ template: 'enhancement', rating: 2, appliesTo: 'skill:stealth' }] }), 'stealth') - R.skillTotal(D, make({ base: spread, focus }), 'stealth'), 2);
check('Armor DR', R.armorInfo(D, make({ armor: 'medium-armor', shield: 'buckler' })).dr, 3);
check('Medium armor: Agility rolls -1', R.armorInfo(D, make({ armor: 'medium-armor' })).agilityPenalty, -1);
check('Armor penalty lowers Agility skills', R.skillTotal(D, make({ base: spread, armor: 'heavy-armor' }), 'stealth')
  - R.skillTotal(D, make({ base: spread }), 'stealth'), -2);
check('Ascetic ignores armor penalty', R.armorInfo(D, make({ role: 'ascetic', armor: 'heavy-armor' })).agilityPenalty, 0);
check('Defender Step 1 adds DR 1', R.armorInfo(D, make({ role: 'defender' })).dr, 1);
check('Ward item adds DR', R.armorInfo(D, make({ items: [{ template: 'ward', rating: 2, appliesTo: 'dr' }] })).dr, 2);
check('Deflect Enhancement raises Deflect', R.deflectFor(D, make({ base: spread,
  items: [{ template: 'enhancement', rating: 1, appliesTo: 'deflect' }] }), 'body'), 14);
const belt = make({ base: spread, level: 2, abilityIncreases: { 2: 'str' },
  items: [{ template: 'enhancement', rating: 2, appliesTo: 'ability:str' }] });
check('Ability Score Enhancement adds to the Score', R.abilityScores(D, belt).str, 4 + 1 + 2);
check('Item bonus does not count against the advancement cap', R.increaseProblems(D, belt), []);
check('Without the item, no Spirit Mastery', R.domainMastery(D, { ...allAt(4), bel: 3 }).spirit, 0);
check('Ability Score Enhancement counts for Domain Mastery', R.domainMastery(D, R.abilityScores(D, make({ base: { ...allAt(2), mor: 4, ser: 4 },
  items: [{ template: 'enhancement', rating: 2, appliesTo: 'ability:bel' }] }))).spirit, 1);
check('Legendary quality from Very Wealthy (Tier 7)', R.overWealth(D, make({ wealth: 7 }), 'legendary'), false);
const armored = make({ base: spread, armor: 'medium-armor', shield: 'buckler' });  // old save: DR 2 + 1, Agility -1
const wear = type => R.armorInfo(D, make({ armor: { type } }));
check('Armor DR 1 to 5 by type', ['light', 'medium', 'heavy', 'powered', 'legendary'].map(t => wear(t).dr), [1, 2, 3, 4, 5]);
check('Agility penalty by type', ['light', 'medium', 'heavy', 'powered', 'legendary'].map(t => wear(t).agilityPenalty), [0, -1, -2, 0, 0]);
check('Ascetic gets no DR from armor', R.armorInfo(D, make({ role: 'ascetic', armor: { type: 'heavy' } })).dr, 0);
check('Old saved armor id becomes a type', clean(D, { armor: 'heavy-armor' }).armor.type, 'heavy');
check('Old weight and quality become a type', clean(D, { armor: { weight: 'heavy', quality: 'standard' } }).armor.type, 'heavy');
check('Old Masterwork armor becomes Powered or Masterwork', clean(D, { armor: { weight: 'light', quality: 'masterwork' } }).armor.type, 'powered');
check('Old Legendary armor stays Legendary', clean(D, { armor: { weight: 'heavy', quality: 'legendary' } }).armor.type, 'legendary');
check('No armor', clean(D, { armor: { type: '' } }).armor, null);
check('DR no longer adds to the Defend roll', R.defendBonus(D, armored, 'body') - R.defendBonus(D, make({ base: spread }), 'body'), 0);
check('Armor no longer changes Body Deflect', R.deflectFor(D, armored, 'body'), R.deflectFor(D, make({ base: spread }), 'body'));
check('Enhanced armor can add to Spirit Deflect', R.deflectFor(D, make({ base: spread,
  items: [{ template: 'enhancement', rating: 2, appliesTo: 'deflect:spirit' }] }), 'spirit'), 14);
check('A Mind-only Enhancement leaves Body alone', R.deflectFor(D, make({ base: spread,
  items: [{ template: 'enhancement', rating: 2, appliesTo: 'deflect:mind' }] }), 'body'), 13);
check('Masterwork is above Struggling Wealth', R.overWealth(D, make(), 'masterwork'), true);
check('Standard is within Struggling Wealth', R.overWealth(D, make(), 'standard'), false);
check('Unknown weapon quality becomes Standard', clean(D, { weapons: [{ name: 'x', quality: 'nope' }] }).weapons[0].quality, 'standard');
check('Faculty items have no Rating', clean(D, { items: [{ template: 'faculty', rating: 3 }] }).items[0].rating, null);

// Role text
check('Roles use the current band names', JSON.stringify(D.roles).match(/Battered|Wounded range|Fresh range|Impaired/), null);
check('Channeler Step 1 has the Level Discount', /Level Discount/.test(D.rolesById.get('channeler').steps[0].text), true);

// Conditions and Effects
check('15 negative conditions (three ongoing, Removed as one) + 4 positive', [R.playConditions(D, false).length, R.playConditions(D, true).length], [19, 4]);
check('14 Effect types + Healing', D.effects.length, 15);
check('Old conditions merge', clean(D, { play: { conditions: ['dazed', 'stunned', 'exhausted', 'invisible', 'quickened'] } }).play.conditions, ['stunned', 'weakened', 'hidden', 'hasted']);
check('Conditions with no new home are dropped', clean(D, { play: { conditions: ['confused', 'petrified', 'doomed', 'blessed'] } }).play.conditions, []);
check('Old supplemental Effects map or clear', [clean(D, { signature: { offensive: 'gravity' } }).signature.offensive, clean(D, { signature: { offensive: 'shadow' } }).signature.offensive], ['force', '']);
check('Old weapon Effect maps', clean(D, { weapons: [{ name: 'x', effect: 'nature' }] }).weapons[0].effect, 'earth');

// Loading old or broken saves
check('Merged skills: 24 universal skills', D.skills.filter(s => !s.genres.length).length, 24);
check('Old Focus Skills are renamed', clean(D, { focus: ['pilot', 'tactics', 'resist'] }).focus, ['operate', 'analyze', 'concentrate']);
check('Two old skills merging empties a Focus slot', clean(D, { focus: ['operate', 'pilot'] }).focus, ['operate', '']);
check('Old skill points move, and a collision frees the point',
  clean(D, { skillPoints: { 2: ['inspire', 'lead', 'endure'] } }).skillPoints[2], ['lead', '', 'endure']);
check('The Heal skill becomes Channel', clean(D, { focus: ['heal'] }).focus, ['channel']);
check('Old Enhancement target is renamed', clean(D, { items: [{ template: 'enhancement', rating: 1, appliesTo: 'skill:pilot' }] }).items[0].appliesTo, 'skill:operate');
check('Old Specialty ids are renamed', clean(D, { specialties: [{ id: 'empath', level: 1 }] }).specialties[0].id, 'martyr');
check('Old Aptitude ids are renamed', [clean(D, { aptitude: 'duelist' }).aptitude, clean(D, { aptitude: 'polymath' }).aptitude], ['weapon-master', 'jack-of-all-trades']);
check('Pilot Aptitude now gives Operate and Observe', D.aptitudesById.get('pilot').bonus_skills, ['operate', 'observe']);
check('Unknown ids are dropped', clean(D, { role: 'no-such-role', feats: { 3: 'nope', 1: 'toughened' } }).feats, { 1: 'toughened' });
check('Level is kept within 1-20', clean(D, { level: 40 }).level, 20);
check('Missing fields get defaults', clean(D, {}).play.trackers.corruption, 0);

// Weird Table
const W = D.powers.weird;
const covers = rows => [...Array(20)].every((_, i) => rows.filter(r => i + 1 >= r.min && i + 1 <= r.max).length === 1);
check('Weird Table covers 1-20 once each', covers(W.table), true);
check('Weird Fallout covers 1-20 once each', covers(W.fallout), true);
check('Weird Drain covers 1-20 once each', covers(W.table.find(r => r.drain).drain), true);
check('Weird 1 is Backlash, 10 Drain, 20 Revelation', [1, 10, 20].map(n => weirdResult(W.table, n).name), ['Backlash', 'Drain', 'Revelation']);

// Report
const failed = results.filter(r => !r.pass);
const summary = document.getElementById('summary');
summary.className = failed.length ? 'fail' : 'pass';
summary.textContent = failed.length ? `${failed.length} of ${results.length} checks failed.` : `All ${results.length} checks passed.`;
document.getElementById('list').innerHTML = results.map(r => `<li class="${r.pass ? 'pass' : 'fail'}">${r.pass ? '✓' : '✗'} ${
  r.name}${r.pass ? '' : ` — got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)}`}</li>`).join('');
