// Requirements as words, for the Character, Advancement and Roles & Feats tabs.
import { esc, cap } from './dom.js';

export function reqText(D, clause) {
  const ability = a => D.abilitiesById.get(a).name;
  const skill = s => D.skillsById.get(s)?.name || s;
  if (clause.text) return clause.text;
  if (clause.ability) return `${clause.ability.map(ability).join(' or ')} ${clause.min}+`;
  if (clause.skill) return `${skill(clause.skill)} rank ${clause.rank_min}+`;
  if (clause.focus) return `${clause.focus.map(skill).join(clause.all ? ' and ' : ' or ')} as Focus Skill`;
  if (clause.role) return `${clause.role.map(r => D.rolesById.get(r).name).join(' or ')} Role Step ${clause.step}`;
  if (clause.feat) return clause.feat.map(f => D.featsById.get(f).name).join(' or ');
  if (clause.genre) return `${clause.genre.map(g => D.genresById.get(g).name).join(' or ')} Genre`;
  if (clause.power_level_min) return `Power Level ${clause.power_level_min}+`;
  if (clause.reputation_min) return `Reputation ${clause.reputation_min}+`;
  if (clause.specialty) return `${clause.specialty.map(s => D.specialtiesById.get(s)?.name || s).join(' or ')} Specialty`;
  if (clause.specialty_category) return `an active ${cap(clause.specialty_category)} Specialty`;
  if (clause.specialty_ability) return `a Specialty at ${clause.specialty_ability.replace('ability', 'Ability ')}`;
  if (clause.any) return clause.any.map(x => reqText(D, x)).join(' or ');
  return JSON.stringify(clause);
}

// "✓ Requirements met" / "✗ Needs Strength 3+" / "? Check by hand: …" for a checkRequirements() result.
export function reqStatus(D, check) {
  if (check.ok === true) return '<span class="good">✓ Requirements met</span>';
  const parts = [];
  if (check.failed.length) parts.push(`<span class="bad">✗ Needs ${esc(check.failed.map(x => reqText(D, x)).join(', '))}</span>`);
  if (check.unknown.length) parts.push(`<span class="warn">? Check by hand: ${esc(check.unknown.map(x => reqText(D, x)).join(', '))}</span>`);
  return parts.join(' ');
}

export const mark = check => (check.ok === true ? '✓' : check.ok === false ? '✗' : '?');
