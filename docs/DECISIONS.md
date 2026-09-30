# JUGGS Builder — Rules Decisions

The rules documents in `source/` disagree with each other in places. This file records how each conflict was
settled by the author (Jon). The builder and its data follow this file. When a new conflict turns up, ask the
author and add the answer here; do not guess.

Last updated: 2026-09-29.

## Sources

- `source/JUGGS_Player_Book.docx` wins every conflict. After it: `JUGGS_SRD_Updated.html`, then the dedicated
  books (`JUGGS_Items.docx`, `JUGGS_Vehicles.docx`, `JUGGS_Book_of_Genres.docx`), then older documents.
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
- **Second Specialty**: free, from Level 5 (Seasoned). It gives Ability 1 and its 2 bonus Focus Skills.
- **Domain Mastery** is added to rolls (skills, Initiative, Defend), not to the fixed Deflect number.
- **Feat Ranks A–D.** Feat tiers are renamed so they are not confused with the character tiers (Novice …
  Legendary): **Rank A** = Basic, **Rank B** = Advanced, **Rank C** = Mastery, **Rank D** = Legendary. The rulebooks
  still use the old names; the builder uses Ranks.
- **Feat slots**: Levels 1, 3, 7, 11, 15, 17, 19. Highest Rank per slot: L1 and L3 Rank A, L7 Rank B, L11, L15 and
  L17 Rank C, L19 Rank D. **A slot can always take a lower-Rank Feat.** The Level 1 Feat must be Basic and cannot unlock Specialty
  Ability 2, which is available from Level 3.
- **Level 17 Capstone**: *to be decided*.
- **Roles**: five Steps, using the wording in the Player Book's "All 22 Roles" section.

## Combat and defenses

- **Initiative**: d20 + the primary Domain's Deflect Ability. The builder also offers Pick Your Place and Roll and
  Swap.
- **Deflect** always uses the Domain's Deflect Ability: Agility (Body), Acuity (Mind), Serenity (Spirit). (Creation
  Step 3's "Willpower for Mind" is wrong.)
- The sheet shows all defenses (three Deflects, Defend, Initiative) with a roll button on the ones that are rolled.
- **Surge maximum** is set by tier: 3 / 4 / 5 / 6 / 7 (not by the governing Ability).
- **Effects**: the Surge level sets an Effect's strength (Surge 2 = 1-box intensity, and so on). There is no
  separate Effect box cost.

## Boons and Banes

- **Boon.** At **Novice** tier a Boon is simply +2 (**Momentum**) to all rolls until the end of your next turn.
  From **Seasoned** up you gain Momentum *and* choose from the Boon Menu (Seasoned one choice, Veteran two, Heroic
  two, Legendary three). Momentum lasts **one extra turn per tier** (Novice 1, Seasoned 2 … Legendary 5 turns).
  (Replaces the earlier "+2 at Level 1, menu from Level 2" ruling.) Momentum is **no longer a Boon Menu option**;
  the menu is Recovery, Tempo, Clarity, Guard, Grace.
- The −2 from a Bane is called **Regression**. It lasts until the end of your next turn **at every tier** (the
  Chapter 9 Seasoned extension "through round after next" is removed); higher tiers add consequences, not duration.
- **Bane severity** uses the Player Book's **Chapter 9** table (the GM may add a second Condition at Heroic; the
  Legendary Bane adds a free enemy Reaction attack with a 1-box typed Effect).

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
- **Pool Transfer**: once per encounter, a free action, from **any pool to any other** (the old linked/cross pairs
  are gone), at **2 boxes spent to restore 1**. Most boxes spent: 6 at Novice, +2 per tier (6 / 8 / 10 / 12 / 14),
  so it always restores a whole number. (Answered in the How to Play doc.)
- **Surge** uses the "Calculating Without the Tools" box table (+1 per box; Effect strength by boxes); Chapter 1's
  points table (1/3/5/8/13) is superseded.
- **Effects**: for now, pay from the pool you are using.
- **Defender Step 2** ("Broken threshold +1") adds 1 box to **Healthy**.
- **Legendary Endurance** ("Broken at box 17, +2 max") adds 2 boxes at the **end of Injured**, moving Broken two
  boxes.

## Costs

- **Basic Attack, Basic Cast and Basic Press are free** — no pool is spent, the same as swinging a sword.
- Anything added (a Maneuver, a Signature or other Effect, Surge, a built Power) costs pool boxes, **minimum 1**.
- **Spell (Power) cost, Casters only**: Mana = the spell's Power Level − the character's tier Power Level
  (Novice 1, Seasoned 2, Veteran 3, Heroic 4, Legendary 5), minimum 1.
- **Maneuvers** use the tier Mastery Floor: Seasoned makes 1-cost Maneuvers free, Veteran 2-cost, Heroic 3-cost,
  Legendary all.
- **Surge** is not reduced by the Mastery Floor. Surge Discipline is the only Surge discount.
- These stay **free** as written exceptions: Mastery Floor free Maneuvers, Warrior Step 4, Caster Steps 4–5,
  Invoker's Total Output, Conduit's Overflow Conduit.

## Skills

- The skill list is under review by the author.
- **Abjure is not a skill.** It is an ability available at a certain level. Until the text is rewritten, references
  to Abjure as a skill use **Channel** instead and are flagged for rewrite: the Abjurer's Authority prerequisite, the
  Channeler Suggested Build's Focus Skills, and the Book of Genres Magic skill list.
- **First Aid** is part of **Survive**, not a separate skill.
- **Heal** and **Channel** are both skills, available only when the Magic Genre is switched on. (The Player Book
  has no entry for Heal; the draft uses the SRD's. Heal's Domain is drafted as Spirit — to be confirmed.)
- **Shoot** (Modern and related Genres) is a **Body** skill.

## Power Sources

- **Physical** is the Power Source every character has.
- The others: **Arcane, Divine, Element, Nature, Psionic, Spirit, Void, Weird**. Innate and Weird Science are no
  longer Power Sources; former Innate abilities count as Physical for now.

  | Source | Preferred Ability | Basic Cast damages | Rule set |
  |---|---|---|---|
  | Arcane | Intellect or Belief | Mana | Arcane rules |
  | Divine | Belief or Morale | Resolve | Divine rules |
  | Element | *to be decided* | *to be decided* | *to be decided* |
  | Nature | *to be decided* | *to be decided* | *to be decided* |
  | Psionic | Willpower | Mana | Psionic rules |
  | Spirit | Belief or Serenity | Resolve | Spiritual rules |
  | Void | *to be decided* | *to be decided* | *to be decided* |
  | Weird | Intellect or Acuity | GM's call | Weird Table |

- Defaults from Focus Skills: **Cast → Arcane**, **Channel → Spirit**.

## Powers (the Spell Builder)

- Layout from `source/juggs_spell_builder_v2.html` (the version that works best); numbers from the Player Book's
  point budget.
- **A · Range** Close 0, Near 1, Far 2, Sight 3, Anywhere known 5. **B · Targets** Single 0, Line 1, Cone 2,
  Burst 3, up to 3 targets 3, up to 6 targets 5. **C · Duration** Instant 0, rounds 1, Concentration 2, minutes 3,
  10 minutes 4, hours 5.
- **D · Effect** is declared only (0 points); the Surge level sets its strength. **Summons** cost points: Grunt 4,
  Rival 8.
- **E · Conditions**: 1 point each, up to 3.
- Points → Power Level: 0 Cantrip, 1–5 PL 1, 6–10 PL 2, 11–15 PL 3, 16–20 PL 4, 21+ PL 5. Base Mana = PL; Casters
  pay PL − tier Power Level, minimum 1. A Cantrip is free for anyone with Cast or Channel at rank 2+, else 1 Mana.
- Kept from the mobile Spell Builder (not in the Player Book): the supplemental Effects **Bleed, Concussive,
  Gravity, Nature, Shadow** (GM approval); **Summons**; **Focus Item** (−1 point, Arcane or Divine only); **Entity
  Blessing** (+1 Power Level free; Mana is paid for the level it was built at).

## Weird Magic

- The Weird Table is rolled on a **d20** with ranged results (Book of Genres version). Weird Role references to
  results by number (1 Backlash, 4 Drain, 8 Revelation) mean the named results.
- Weird results add to **Corruption** (no separate Tainted track).

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
  - **Armor is a weight and a quality** (author's choice, option C). Quality sets DR: Light 1, Standard 2,
    Quality 3, Masterwork 4, Legendary 5; Heavy and Powered add +1 (max DR 5). Weight sets the Agility penalty:
    Light 0, Medium −1, Heavy −2, Powered 0; Masterwork and Legendary armor fits better (1 less penalty). The
    penalty applies to Agility rolls (skills, Initiative, ranged attacks) **and lowers Body Deflect** — armor absorbs
    more than it dodges. Shields add DR with no Agility penalty. The Ascetic gets no benefit and no penalty from armor
    (no DR either). The SRD's named armors are kept as examples only.
  - DR = armor + shield + Defender (+1, +2 from Step 4) + Ward items — **all DR counts** (for now). DR is **added to
    the Body Defend roll and the Body Deflect number** (Deflect is not rolled but still benefits). It is **not taken
    off Stamina damage**; it reduces damage through the roll. Mind and Spirit Defend/Deflect get a bonus only from
    enhanced armor or items that name them (Enhancement targets "Defend (Mind)", "Deflect (Spirit)", …).
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

## Open — to be decided

- Level 17 Capstone.
- Standard Origin trait.
- Skill list review.
- Element, Nature and Void Power Source details.
- Abjure rewrites (see Skills).
- **Effect pools**: which pools can pay for each Effect. Chapter 1 and the "Effect types by pool" table disagree;
  the data keeps both readings and leaves `pools` empty.
- The Channeler Suggested Build's sixth Focus Skill (Abjure was one of the six).
- Power list damage: Lay on Hands has no Power Level lines, and one Psionic Power lost its heading (the "Boon and
  Bane Severity Summary" sits in its place).
- Side-by-side pool layout on the sheet — the author will judge it once the sheet exists.
