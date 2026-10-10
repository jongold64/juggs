// The Weird Table and Weird Fallout (Book of Genres), shown on the Powers and Quick Rules tabs when the Weird Magic
// Genre is on. Buttons carry data-weird="table" or "fallout"; app.js rolls them with weirdRoll().
import { esc } from './dom.js';

export const weirdOn = c => c.genres.includes('weird-magic');

const range = r => (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`);
export const weirdResult = (rows, die) => rows.find(r => die >= r.min && die <= r.max);

// Rolls on one table: { die, row, drain } where drain is the pool for a Drain result.
export function weirdRoll(D, which) {
  const w = D.powers.weird;
  const d20 = () => 1 + Math.floor(Math.random() * 20);
  const die = d20();
  const row = weirdResult(which === 'fallout' ? w.fallout : w.table, die);
  const drainDie = row.drain ? d20() : null;
  return { die, row, drain: row.drain ? { die: drainDie, pool: weirdResult(row.drain, drainDie).pool } : null };
}

const btn = (which, text) => `<button type="button" class="tiny no-print" data-weird="${which}">${text}</button>`;

export function weirdCard(D, cls = 'card wide') {
  const w = D.powers.weird;
  const rows = list => list.map(r => `<tr><th scope="row">${range(r)}</th><td><b>${esc(r.name)}</b></td><td>${esc(r.effect)}</td></tr>`).join('');
  return `<section class="${cls} weird"><h2>Weird Table <span class="hint">Weird Magic</span></h2>
    <p>${esc(w.when)} ${btn('table', 'Roll the Weird Table')}</p>
    <div class="table-wrap"><table class="qr-table"><thead><tr><th>d20</th><th>Result</th><th>Effect</th></tr></thead><tbody>${rows(w.table)}</tbody></table></div>
    <h3>Weird Fallout</h3>
    <p>${esc(w.fallout_when)} ${btn('fallout', 'Roll Weird Fallout')}</p>
    <div class="table-wrap"><table class="qr-table"><thead><tr><th>d20</th><th>Result</th><th>Effect</th></tr></thead><tbody>${rows(w.fallout)}</tbody></table></div>
    <ul class="hint">${w.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></section>`;
}
