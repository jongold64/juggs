# JUGGS Builder — Rules Decisions

The rules documents in `source/` disagree with each other in places. This file records how each conflict was
settled by the author (Jon). The builder and its data follow this file. When a new conflict turns up, ask the
author and add the answer here; do not guess.

Last updated: 2026-10-31.

## Lite rules (2026-10-31)

The builder follows the WIP Lite books. Rulings below that they replaced have been rewritten here. The rules have only
been simulated, not played, so most of these numbers live in `data/core.json` and are easy to change.

Asked of the author while updating the builder:

- **Deflect tier bonus**: +2 per tier (+0, +2, +4, +6, +8), including social Deflect.
- **Boon**: as the Lite book. Momentum is a Boon Menu pick, until the end of your next turn; one choice at Novice.
- **Power Sources**: Physical, the Book of Powers' 13, and **Void**. Element is absorbed (old saves: Nature / Primal). Old
  saves: Weird becomes Weird Science.
- **Level Discount**: Casters **and Channelers**. The Lite Channeler Role does not say so; the builder adds it to
  Step 1 and `core.json` `level_discount.roles` holds the list.
- **Armor Agility penalty**: applies to Agility rolls and no longer lowers Body Deflect.
- **Specialty bonus Focus Skills**: kept, on every Specialty held, although the Book of Feats entries omit them.
- **Fallout**: as printed. Casters at Surge 5+; Specialty Fallout and Weird Fallout at Surge 3+. One caster ladder
  (decided 2026-11-01): Major (5, +3 boxes), Severe (6, +4 and one Condition), Catastrophic (7, +5 and two Conditions),
  reducing a step at a time to none. Voidtouched crosses 2 extra Mana boxes on a Natural 1 on any Cast.
- **Basic Cast**: free for a practitioner, anyone whose Attack Ability plus Cast or Channel skill totals 3 or more
  (author's change; a Focus Skill always qualifies). A lower total costs 1 Mana minimum. Cantrips use the same test.
  Both books now say this. Caster Step 1's "Cantrips free (Cast 2+)" is left as written, since Cast 2+ always qualifies.

Builder choices for old saves and reference (the author did not object):

- A second Specialty in an old save takes the first open Feat slot; with none open it stays, with a warning.
- A Gated Feat below Level 11 in an old save stays, with a warning.
- The seven supernatural conditions stay as GM reference on Quick Rules, off the sheet.
- Armor Wealth ceilings carry over by DR: Light Tier 2, Medium 3, Heavy 5, Powered or Masterwork 6, Legendary 7.
- `js/migrate.js` holds every old id and where it went. Feats, Specialties, spells and Sources come from the books
  through `scripts/import_lite.py`, which can be run again when the text changes.

Book text the builder does not follow, for the author to fix:

- Chapter 1's "What Overage Does" still says an Effect becomes mechanical at Surge 2. The Effect Ladder wins.
- Knowledge still says "two additional languages per BP". Everyone gets 2 extra languages.
- Creation Step 3 still says Willpower for Mind Deflect and Initiative = primary Attack Ability.

The afflictions data is not shown in the app; it now includes the Doom Affliction (added 2026-11-01). Vehicles keep their
design, with Pilot and Tactics station rolls moved to Operate and Analyze. Gunners roll Combat (Ranged) (decided
2026-11-01).

## Sources

- The WIP books (with the second trim applied) win every conflict: `JUGGS_Player_Book_Lite.docx`, `JUGGS_Book_of_Feats.docx`,
  `JUGGS_Book_of_Powers.docx`, with their decisions files. After them: `source/JUGGS_Player_Book.docx`,
  `JUGGS_SRD_Updated.html`, then the dedicated books (`JUGGS_Items.docx`, `JUGGS_Vehicles.docx`,
  `JUGGS_Book_of_Genres.docx`), then older documents.
- `source/Downloaded/` and the world books (ALT.Earth, Pantara) are out of scope for version 1, except the
  Combat Maneuvers list (see below).
- The data files are drafted once from the Player Book by `scripts/draft_data.py`, then edited directly.
  `scripts/validate.py` checks them.

## Terminology

- Use **Genre** wherever the books say *Overlay*. Magic, Psionics, Weird Magic and Horror are Genres a campaign
  switches on, like Fantasy or Cyberpunk. A Role that requires the "Magic Overlay" requires the Magic Genre.
- Pool bands are **Healthy, Hurt, Injured, Broken**.

## Character creation

- The 20 Build Points go only to the nine Ability Scores (minimum 1, maximum 4 at creation; Aptitude bonuses can
  push a Score to 5).
- The player then picks **6 Focus Skills** (rank 2). Every other skill starts at rank 1.
- **Aptitude and Specialty bonus skills are extra Focus Skills**, on top of the 6, and use the Focus cap. If one
  overlaps a Focus Skill already chosen, +1 to any other skill instead.
- **Origins give no Focus Skills.** The Standard Origin's "two additional Focus Skills" trait is out of date; its
  trait is *to be decided*.
- **Origins**: the Player Book's 25, which change no Ability Scores. (The SRD's 26 with +1/−1 is wrong, and so is
  Creation Step 1's "apply its Ability bonus".)
- **Street Survivor** stays as both an Aptitude and an Origin for now.
- Every character gets **2 additional languages** at creation. The "two languages per BP" wording is removed.
- **Starting Wealth** is Tier 3 Struggling, unless the Aptitude sets a tier (Player Book Ch 9 Aptitude defaults).
  Trained by Nature and Temple Trained have no Ch 9 default, so they start at Struggling.
  The "move one tier for 1 BP" option is dropped (it may return as a Feat).
- The **governing Ability** can be any of the nine Ability Scores.
- **Presets**: the Suggested Builds only (one per Role).

## Advancement

- **Skills** (Player Book Ch 7): from Level 2, 6 skill points per level, each to a different skill. Level 1 gets
  none (its skills come from creation), so 114 points across twenty levels.
  Caps by tier — Focus Skills 3 / 4 / 5 / 6 / 7, other skills 2 / 3 / 4 / 5 / 6.
- **Specialties** are Stepped: their Abilities arrive at Levels 1, 5, 9, 13, 17. The first is free; any further one
  uses a Feat slot and gives its 2 bonus Focus Skills from that level.
- **Domain Mastery**: all three Scores at 4+ = +1, at 6+ = +2 (Basic dropped). Added to rolls (skills, Initiative,
  Defend), not to the fixed Deflect number. From Veteran, the other two Scores in the governing Ability's Domain cap
  at 6.
- **Feats** are **Stepped** (a Level 1 version that grows at 5, 9, 13, 17; requirements apply only when taken) or
  **Gated** (no Steps, a requirement, available from Level 11). Ranks A–D are gone.
- **Feat slots**: Levels 1, 3, 7, 11, 15, 17, 19.
- **Level 17 Capstone**: one free Gated Feat, ignoring its requirements other than tier, and a scene-level capability
  defined with the GM. It is on top of the Level 17 Feat slot.
- **Roles**: five Steps by tier, as Stepped Feats (see Second trim).

## Combat and defenses

- **Initiative**: d20 + the primary Domain's Deflect Ability. The builder also offers Pick Your Place and Roll and
  Swap.
- **Deflect** = 10 + the Domain's Deflect Ability (Agility, Acuity, Serenity) + the tier bonus. (Creation Step 3's
  "Willpower for Mind" is wrong.) Armor does not raise it.
- **Hit Cap**: one hit crosses at most 5 + tier number boxes (6 to 10), after armor. Each Surge box raises it for that
  hit. Healing has no cap. Minions ignore it.
- The sheet shows all defenses (three Deflects, Defend, Initiative) with a roll button on the ones that are rolled.
- **Surge maximum** is set by tier: 3 / 4 / 5 / 6 / 7 (not by the governing Ability).
- **Effects**: 14 types plus Healing, on one Effect Ladder paid in boxes (1, 2, 3, 4–5). Surge only adds to the roll.
  The Offensive Signature's 1-box rung is free on a Surge 2+ hit, by choice. Non-Signature type: −1 to the roll.
  Supplemental Effects are gone (old saves: Gravity to Force, Concussive to Sonic, Nature to Earth; others cleared).
- **Conditions**: 15 negative (Burning, Bleeding and Poisoned count as one) and 4 positive.

## Boons and Banes

- **Boon**: choose from the Boon Menu (Momentum, Recovery, Tempo from Seasoned, Clarity, Guard, Grace): one choice at
  Novice and Seasoned, two at Veteran and Heroic, three at Legendary, never the same twice.
- **Bane**: −2 to all rolls until the end of your next turn at every tier. From Seasoned the GM also picks from the
  Bane Menu (Complication, Left Open, Spent, Shaken, Exposed): one, two, two, three. A Natural 1 is no Bane while your Boon is active.

## Pools

- Pools start at 15 boxes: Healthy 1–5, Hurt 6–10, Injured 11–14, Broken 15.
- Extra boxes are added to **Healthy, then Hurt, then Injured**, repeating in that order. **Broken is always the
  last box.**

  | Pool size | Healthy | Hurt | Injured | Broken |
  |---|---|---|---|---|
  | 15 | 1–5 | 6–10 | 11–14 | 15 |
  | 16 | 1–6 | 7–11 | 12–15 | 16 |
  | 17 | 1–6 | 7–12 | 13–16 | 17 |
  | 18 | 1–6 | 7–12 | 13–17 | 18 |
  | 19 | 1–7 | 8–13 | 14–18 | 19 |
  | 20 | 1–7 | 8–14 | 15–19 | 20 |

- Band penalties (Hurt −1, Injured −2) apply **only to rolls in that pool's Domain**.
- **Pool Transfer**: once per encounter, a free action, from **any pool to any other**, at **2 boxes spent to restore
  1**, up to 5 restored.
- **Surge**: +1 to the roll and +1 Hit Cap per box, up to 3 / 4 / 5 / 6 / 7 by tier. **Big Surge** (3+): on a hit the
  target can only Deflect; a natural 1 crosses the same boxes again.
- **Effects**: pay from the pool the book's "Effect types by pool" table allows (Stamina for weapons, Mana for Powers,
  Resolve for Spirit and social actions).
- **Defender Step 2** ("Broken threshold +1") adds 1 box to **Healthy**.
- **Legendary Endurance** ("Broken at box 17, +2 max") adds 2 boxes at the **end of Injured**, moving Broken two
  boxes.

## Costs

- **Basic Attack, Basic Cast and Basic Press are free** — no pool is spent, the same as swinging a sword.
- Anything added (a Maneuver, a Signature or other Effect, Surge, a built Power) costs pool boxes, **minimum 1**.
- **Spell (Power) cost**: Mana = Power Level. Casters and Channelers subtract Character Level ÷ 6, rounded down,
  minimum 1. Surge and Effect boxes are never discounted.
- **Maneuvers** use the tier Mastery Floor: Seasoned makes 1-cost Maneuvers free, Veteran 2-cost, Heroic 3-cost,
  Legendary all.
- **Surge** is not reduced by the Mastery Floor. Surge Discipline is the only Surge discount.
- These stay **free** as written exceptions: Mastery Floor free Maneuvers, Caster Steps 4–5,
  Invoker's Total Output, Conduit's Overflow Conduit.

## Skills

- **24 universal skills.** Pilot → Operate, Language → Knowledge, Tactics → Analyze, Inspire → Lead, Resist →
  Concentrate. Legerdemain stays. Skill Mastery (lower DCs by rank) is gone.
- **Abjure is not a skill.** It is an ability available at a certain level. Until the text is rewritten, references
  to Abjure as a skill use **Channel** instead and are flagged for rewrite: the Abjurer's Authority prerequisite, the
  Channeler Suggested Build's Focus Skills, and the Book of Genres Magic skill list.
- **First Aid** is part of **Survive**, not a separate skill.
- **Heal is an action, not a skill.** Mundane healing uses Survive; magical healing uses Channel (old saves: Heal
  becomes Channel). Channel is available only when the Magic Genre is switched on.
- **Renames**: Specialties Skirmisher → Sharpshooter, Shaper → Weaver, Empath → Martyr, Infiltrator → Chameleon;
  Aptitudes Duelist → Weapon Master, Polymath → Jack-of-All-Trades (its Signature is once per encounter). Roles keep
  their names.
- **Shoot** (Modern and related Genres) is a **Body** skill.

## Power Sources

- **Physical** is the Power Source every character has.
- The others are the Book of Powers' 13 (Arcane, Divine, Innate, Psionic, Spirit / Shamanic, Weird Science, then the
  expansions Alchemical, Blood Magic, Chi / Ki, Cybernetic, Demonic / Pact-Bound, Nature / Primal, Runic / Inscription)
  plus **Void**, its own Source (rules under Second trim).
- Defaults from Focus Skills: **Cast → Arcane**, **Channel → Spirit**.

## Powers

- Casting is freeform: the character's list is a shortcut, not spells known. The point-budget Spell Builder, Focus Item,
  Entity Blessing, point-priced Summons and the supplemental Effects are gone.
- **Making a Power**: start at PL 1, +1 per upgrade (Reach, Targets, Duration, Impact, Force), maximum 5. Casters may use
  up to Character Level + 1. On a hit: overage or Power Level, whichever is higher, up to the Hit Cap.
- **109 spells** with five Steps each; a Step's Power Level is its cost, and any unlocked Step can be cast.
- Old saves: example Powers become the matching spell; built Powers map to the upgrades, and what they cannot hold goes
  in their notes.

## Weird Magic

- The Weird Table is rolled on a **d20** with ranged results (Book of Genres version). Weird Role references to
  results by number (1 Backlash, 4 Drain, 8 Revelation) mean the named results.
- Weird results add to **Corruption** (no separate Tainted track).
- **Weird Fallout replaces normal Fallout**: on a Weird Magic cast, a natural 1 while Surging 3+ uses the Weird
  Fallout table instead of the Surge table's Fallout.
- The Weird Table shows for every character when the Weird Magic Genre is on (not only Weird Role or Weird source).

## Gear and items

- **Items stack with weapon quality.**
- Item **Ratings** can be any number from 1 to 5, and values match the Rating: an Enhancement gives +Rating
  (+1 to +5), a Ward gives DR equal to its Rating (DR 1 to 5), a Reservoir holds Rating charges at PL Rating.
- Armor and shield tables come from the SRD (the Player Book's armor section stops after "Light").
- How the builder uses gear (interim — see Open):
  - Weapon attack = Strength (melee) or Agility (ranged) + Combat (Melee / Ranged) rank + Domain Mastery + quality
    bonus + Enhancements. Basic Cast with an implement = Intellect or Belief + Cast (Attack) or Channel + Mastery +
    implement quality.
  - An Enhancement names a roll: Attack, Defend, Deflect, or one skill — or an Ability Score, where it **adds to the
    Score itself** (so it counts for every roll with that Score and for Domain Mastery; the advancement caps apply to
    the Score without items). The highest Enhancement per target counts.
  - **Ward items stack** with armor and shield DR.
  - **Legendary** quality is available from Wealth Tier 7 (Very Wealthy), per the Gear Quality list.
  - **Armor is one of five types**: Light DR 1, Medium DR 2 (Agility −1), Heavy DR 3 (Agility −2), Powered or Masterwork
    DR 4, Legendary DR 5. The penalty applies to Agility rolls. Shields add DR with no penalty. The Ascetic gets no
    benefit and no penalty from armor. The SRD's named armors are kept as examples only.
  - DR = armor + shield + Defender (+1, +2 from Step 4) + Ward items, all counting. **DR comes off Stamina damage**,
    before the Hit Cap. It does not add to Defend or Deflect.
  - Gear above the Wealth ceiling (the Player Book's Gear Quality list) is allowed with a warning.

## Vehicles (structure)

- A **Motorcycle** has 7 Structure boxes: Healthy 2, Hurt 2, Injured 2, Broken 1.
- The rest of the vehicle design is **in progress** by the author. Leave vehicles alone until they say otherwise.
- Ward alternatives to DR keep their Items-book Ratings: halve one Effect type (1+), immunity to one Condition (3+),
  immunity to one Effect type (5).

## Combat Maneuvers

- Include the older list (from `source/Downloaded/JUGGS_SRD_2.html`) for now, minus duplicates.
- **Shove** stays (physical). The Maneuver called **Press** is dropped — Press is the social attack.
- **Counter** stays for now, although it overlaps the Duelist's Riposte.

## Vehicles

- Vehicles get their own tab once the character sheet is built.
- The Gunner station rolls **Agility + Combat (Ranged)**.

## Second trim

- **Healer Archetypes (decided 2026-11-02).** Cleric (Channeler, Martyr, Celebrant, Divine, Unshakeable Faith, Healing, Magic Genre),
  Shaman (Channeler, Anchor, Shaman, Spirit, Steady Presence, Healing, Magic Genre), Field Medic (Medic, Martyr, Healer, Rapid Recovery)
  and Combat Medic (Medic, Guardian, Soldier, Second Wind, Knockdown).
- **New Archetypes (decided 2026-11-02).** Fighter (Warrior, Guardian, Soldier, Weapon Specialist, Knockdown), Paladin (Defender,
  Warden, Celebrant, Divine, Channel Access, Radiant, Magic Genre), Rogue (Scout, Duelist, Criminal, Shadow Step, Feint) and Ranger
  (Scout, Sharpshooter, Trained by Nature, Steady Aim, Aimed Shot). An Archetype's Signature may be an Effect or a Maneuver.
- **Signature Maneuver (decided 2026-11-02).** Each character picks one Signature, an Effect or a Combat Maneuver. A Signature
  Maneuver is added free on a Surge 2+ hit (no Stamina, no extra roll; its own requirement applies), and no one can use it on you
  while you can act. Bosses stand up from Prone for free at the start of their turn. Expanded Signature may add a Maneuver (it works
  from Seasoned on). The Combat Maneuvers list is now printed in the Book of Feats.
- **One Signature Effect (decided 2026-11-02).** The optional Defensive / Utility Signature is cut. Expanded Signature, whose Novice Step
  already removes the -1 for one extra type, moves from the Book of Powers to the Book of Feats as a Universal Stepped Feat.
- **Signature DR (decided 2026-11-02).** Each Signature Effect type a character has gives DR equal to the tier number (1 to 5) against
  damage of that type, including its Condition's damage over time (Burning for Fire). It adds to armor DR.
- **Cantrips (decided 2026-11-02).** One definition, in the Book of Powers: PL 1 on one target or yourself, free for a practitioner
  (others pay normal Mana), no Surge. Attacks, heals and Conditions are Touch or Close and cross at least 1 box on a hit; utility tricks
  reach Near, and one that only senses may cover an area. Caster Role Step 1 drops "Cantrips free (Cast 2+)" (every Caster is already
  a practitioner).
- **Reputation stays out of combat (decided 2026-11-02).** It no longer adds to Initiative and has no combat effect; it remains a social rule.
- **Upper Hand (decided 2026-11-02).** Ties favor heroes on every opposed roll between a hero and an enemy: no boxes are crossed,
  but the hero gets the Upper Hand and the enemy takes -2 on its next roll. Rolls against a fixed DC are not opposed rolls.
- **Initiative variants (decided 2026-11-02, replaces parts of the next two entries).** The alternatives are called Variants, not Methods.
  Initiative Feats apply to the normal roll and to Sides, not to Pick Your Place (no claiming 30). Seize the Moment is used only when the
  scene calls for it, not every round.
- **Initiative ties and Seize the Moment (decided 2026-11-02).** Initiative ties between a hero and an enemy go to the hero. In Sides the GM
  adds the highest enemy's Deflect - 10 (replacing the tier bonus). Seize the Moment works with any method and puts the hero ahead of
  every enemy, even one that rolled higher. Under Pick Your Place, a hero with a Feat that adds to Initiative may claim 30 first.
  Standing rule still to word: ties between a hero and an enemy favor the hero on every opposed roll (what a won tie gives is open).
- **Initiative methods (decided 2026-11-02).** Roll and Swap is cut. Pick Your Place gains Seize the Moment: each round the table may agree
  one hero goes first, the rest follow in picked order from the top; the hero stays first while keeping the drama or a buff going.
  Heroes only. New method, Sides: the highest hero Initiative against the GM's d20 + the party's tier bonus; the winning side takes
  all its turns first, in any order; ties go to the heroes.
- **Stepped Feat Steps add up (decided 2026-11-02).** Each Step adds to the ones before it, unless it says "instead."
- **Pool Transfer becomes a Feat (decided 2026-11-02).** No longer a rule for everyone. A Universal Stepped Feat: once per encounter, on
  your turn, move any number of marked boxes one for one between pools, never marking a last box. Seasoned: also right after taking
  damage. Veteran: also clears one Condition of the unmarked pool's Domain. Heroic: twice per encounter. Legendary: may mark a last box.
- **Genre skills (decided 2026-11-01).** Raised with skill points under the same tier caps as other skills, not XP.
- **Combined Attack cut (decided 2026-11-01).** Extra Actions can no longer be spent on one attack, so its Effect, Maneuver,
  Pierce and Corner options are gone too. In simulation, two plain attacks out-damaged it even with no Hit Cap.
- **Material moved (decided 2026-11-01).** Afflictions are in the GM Guide; Investigation stays in the Player Book for players; Period Equipment and Tech Levels are in
  the Book of Genres. The Player Book keeps short pointers.
- **Wealth (decided 2026-11-01).** No BP cost: with GM approval a character may start one tier above or below their default. Cash on
  Hand = Wealth Tier × the multiplier. Chit conversion: one purchase covers as many lower-tier purchases as its multiplier
  divided by theirs.
- **Caster Step 2 is Shaped Casting (decided 2026-11-01).** Once per scene, add one upgrade to a Power without raising its Mana
  cost; its Level still rises, to at most 5. The general limit (Character Level + 1, maximum 5) stays.
- **Boon Tokens are gone (decided 2026-11-01).** A Natural 1 while one of your Boons is still active (until the end of your next
  turn after the Boon) is no Bane, only a roll of 1. Big Surge backlash and Fallout still apply.
- **New Warrior Steps (decided 2026-11-01).** Step 2 Battle-Hardened: a Natural 1 on an attack draws no Bane Menu pick, only the
  −2. Step 4 Relentless: once per round, 2 free Surge boxes on one attack, counting as Surge 2 for the Signature Effect. Step 5
  Unstoppable: once per round, after a hit, one Basic Attack at no Action cost.
- **Player Book cleanup (2026-11-01).** Repeated sections removed; the Opening Bane is now Left Open and the Press option of
  Combined Attack is now Corner, so no two rules share a name. Social Deflect uses the tier bonus everywhere, not Reputation.
- **Heal unmarks the overage (decided 2026-11-01).** Overage or Power Level, whichever is higher, with no cap. The
  fixed-amount Healing chart is gone. Cost is the Power's cost, less any Level Discount, minimum 1. Doom's "one rung
  lower" became "unmarks 2 fewer boxes".
- **Confused (decided 2026-11-01).** A Power result, defined under the Confuse Power: at the start of its turn the target
  rolls Willpower against DC 12 or the DC the Power lists; on a failure it loses its Actions this turn, and can still Deflect.
- **Encounter Points (decided 2026-11-01).** The GM Guide now sizes fights by points: each hero is 10, opponents have
  points by tier, and enemy ÷ party sets the difficulty (0.75 to 1 is the challenging fight). A Boss is 65 at Novice, 55
  at Seasoned and 50 above, counting its Phase 2, Specials and Signature Move. A party with no healer counts the fight
  as one band harder. It is a GM tool, so the builder does not use it.
- **Four new Boons (decided 2026-11-01).** Opening, the next ally to attack the same target this round gets +2; Break
  Through, this hit ignores armor DR, once per round; Reset, regain one spent Reaction, once per round; Keen Eye, one true answer
  from the GM. Chase versions are in the Player Book.
- **Tempo is once per round (decided 2026-11-01).** A Boon's extra Action can no longer chain into more.
- **NPC numbers are built for six heroes (decided 2026-11-01).** Antagonist and Boss Boxes and Actions are 1.5 times the
  old four-hero numbers; Rivals and Minions are unchanged, with about one Rival per hero. For four heroes, use
  two-thirds, rounding Actions up. The NPC table is in the books, not the builder.
- **Pools stay 15/15/15 (decided 2026-11-01).** Unequal pools by Domain (20/15/10) were simulated and turned down.
- **No Guard stays (decided 2026-10-31).** The Cheat Code from the One Page sheets is now in the Lite Player Book: at
  Seasoned tier and above, twice per encounter on your turn, mark 1 box from the pool you are using and trade one
  Reaction for one extra Action this round. Deflect still protects you. (An unlimited, free version was simulated
  first and was far too strong.) It was not in the builder and adds nothing to it.
- **Roles trim (decided and applied 2026-10-31).** Nine Roles: Warrior, Defender,
  Scout, Speaker, Expert (a widened Artificer: building, deduction, adaptability), Medic (moved out of the supernatural
  group), Ascetic, Caster, Channeler. The other Roles become optional Archetypes: a core Role with a Specialty, Aptitude
  or Genre. The Expert Role replaces Artificer, Investigator and Polymath. Four Roles keep their Steps as Stepped Feats: Battle Fury, Marked
  Prey, Net Diver, Weird Touched. The Mastery Feat Berserker is now Frenzy; Berserker's Threshold keeps its "At the table" version;
  hurt Attack bonuses do not stack.
- **Roles become Stepped (applied 2026-10-31).** Each Role works like a Specialty: the first is free at
  creation, its five Abilities arrive at Levels 1, 5, 9, 13, 17, and a further Role uses a Feat slot, starting at the
  character's current tier. Tier changes no longer offer a Role choice, and the multiclass rule goes. Feat requirements
  change from "Role Step 3" to "Role at Veteran tier".
- **Specialties and Feats stay separate (applied 2026-10-31).** No Talents. One rule is added: "Your free
  Specialty may instead be a second Stepped Feat."
- **Aptitudes become Backgrounds (applied 2026-10-31).** A rename only; how they work does not change.
  The builder keeps its saved field name, so old saves still load.
- **Chase Boons use the Boon Menu (applied 2026-10-31).** Momentum, +2 to all rolls until the end of your
  next turn; Recovery, unmark 1 box; Tempo (Seasoned+), move two bands this round; Clarity, clear a Condition or shake off a
  Complication; Guard, +2 against the next hazard or Attack Calling; Grace, give one to an ally in the chase. Legendary only:
  End the Chase, the quarry vanishes (distance resets to Far) or the pursuer cuts them off (distance jumps to Close). The
  cumulative tier list goes.
- **Supernatural conditions move to the GM Guide Lite (applied 2026-10-31).** The Player Book
  lists 15 + 4. The builder already keeps the seven off the sheet, as GM reference on Quick Rules.
- **Abjure stays an action, not a skill (applied 2026-10-31).** Available from Seasoned tier to a Channeler (spiritual
  ones included), or to anyone with Belief 3+ and 1 point in Channel. The roll is unchanged: Belief vs the entity's Morale.
  - **Channeler**: 2 Resolve at Seasoned, 1 at Veteran, 0 once per scene at Heroic. It can be repeated in a scene, at a
    cumulative -1 to the roll for each earlier use that scene. On 5+ overage the entity gains Removed (Spirit).
  - **Others**: 2 Resolve, once per scene. Success makes the entity Frightened; 5+ overage does nothing more.
  - **Abjurer's Authority** gives others Removed (Spirit) on 5+ overage and works from Seasoned. Its 1 fewer Resolve stays,
    and they remain limited to once per scene.
  - Channeler Step 1 loses its Abjure cost, Legendary is unchanged, and Rule 3 and the Holy Relic need rewording.
- **Spent does not stack with backlash (applied 2026-10-31).** "Spent doesn't repeat boxes already crossed by
  backlash." It still charges Surges of 1 or 2 boxes, and Effect boxes on the same roll.
- **Seven Feat slots stay** (decided 2026-10-31), at Levels 1, 3, 7, 11, 15, 17, 19, so players can take something outside a
  narrow build. Specialties and Roles growing free does leave characters stronger; watch that in play.
- **Deafened stays its own condition** (decided 2026-10-31). No change needed.
- **Element and Void (applied 2026-10-31).** Element is absorbed into the expansion Sources; the closest is
  Nature / Primal, which is the proposed home for old saves. Void stays as its own Source: negative energy, from Space or
  "the Old Ones". Its rules:
  - Ability Intellect or Willpower; pools Mana / Stamina; Basic Cast crosses Stamina. Origin chosen at creation: Space
    (impersonal) or the Old Ones (may notice you). No visible components. Learned from forbidden texts or contact.
  - The Void Effect never takes the -1 for being non-Signature.
  - **Corruption**: a Void-source caster gains Corruption +1 automatically on a Bane (natural 1) when using Void power,
    with no check. Other Sources keep the book's Void Effect check (Arcane DC 14, Divine DC 12, Innate and Spirit exempt).
  - **Opposition**: Divine Powers (positive energy) and Nature / Primal Earth Effects count as 1 Power Level higher
    against Void-sourced targets. Positive Energy is not a separate Effect. Void casters can be Abjured.
    It applies only to Powers aimed at the target, costs no extra Mana, and can reach PL 6. Void-sourced means the Void
    Source for player characters and the GM's call for NPCs. Banish's Step text needs a line saying so.
  - **Demonic is separate**: Demonic is a deal with something that wants you; Void is contact with something that does
    not care. A patron who bargains, like The Bound, is Demonic. Pantara's Void is ignored for now (work in progress).

- Standard Origin trait.
- Abjure rewrites (see Skills).
- Side-by-side pool layout on the sheet — the author will judge it once the sheet exists.
- **Weird Role Step 2** is kept as written for now ("Revelation fills 0 Resolve. Corruption check DC 12 (not 14)").
  Its DC 14 Corruption check comes from the older d8 Weird Table (Back to Basics); the current d20 table (Book of
  Genres) adds Corruption automatically, so the DC half has nothing to change. Removing or rewriting it is undecided.
  The Weird Role text also still uses the d8 numbers (Revelation 8, Drain 4, Backlash 1), read as the named results.
