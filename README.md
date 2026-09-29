# JUGGS Character Builder

A character builder for JUGGS (Jon's Universal Genre Gaming System). Plain HTML, CSS and JavaScript: no
installation beyond Python, which serves the files.

## Try it

From this folder:

```
python -m http.server 8000
```

Then open http://localhost:8000/ in a browser. Rules checks: http://localhost:8000/tests.html

## What it does

- **Character**: campaign Genres, level, name and concept (with ideas for each Role), Aptitude, Origin, the
  20 Build Points, Primary Domain and governing Ability, starting Role (with its Suggested Build), Specialties,
  Signature Effects, Power Sources, Wealth and Reputation.
- **Skills**: the 6 Focus Skills plus Aptitude and Specialty bonus skills, and every skill's rank, cap and total.
- **Roles & Feats**: Role Steps, Specialty abilities and Feats held.
- **Advancement**: level by level — skill points, Ability increases, Role advancement and Feats, with
  requirements checked (✓ met, ✗ not met, ? written in words, check by hand).
- **Sheet**: the two-page character sheet. Pool boxes, trackers and conditions can be marked during play, and
  rolled values have a d20 button. Print prints the sheet.

Characters are saved in the browser. Export and Import move one between devices as a .json file.

## Rules data

`data/*.json` holds the rules, drafted from the rulebooks in `source/` and edited directly since. The author's
rulings on conflicts between the rulebooks are in `docs/DECISIONS.md`. Check the data after editing:

```
python scripts/validate.py data
```
