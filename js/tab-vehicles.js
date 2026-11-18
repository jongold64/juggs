// The Vehicles tab: pick vehicles from the catalog (filtered by the campaign's Genres) and see their Systems, tracks
// and what this character rolls at each station.
import * as R from './rules.js';
import { esc, signed, groupedOptions } from './dom.js';

// Catalog entries for the campaign's Genres. Vehicles with no Genre (the Mech setting) always show.
function shown(D, c) {
  return D.vehicles.catalog.filter(v => !c.genres.length || !v.genres.length || v.genres.some(g => c.genres.includes(g)));
}

// A button in this tab. Returns true if the character changed.
export function vehicleAction(D, c, action, arg, pick) {
  if (action === 'add') {
    const id = pick('vehicle-pick');
    if (!D.vehicles.catalog.some(v => v.id === id)) return false;
    c.vehicles.push({ id, name: '' });
    return true;
  }
  if (action === 'remove') { c.vehicles.splice(Number(arg), 1); return true; }
  return false;
}

// Printed track: a row of boxes coloured by band.
export function trackBoxes(bands) {
  return bands.map(b => Array.from({ length: b.boxes }, () => `<span class="box band-${b.id}" title="${esc(b.name)}"></span>`).join('')).join('');
}

// One System's line: what its Rating does, with strain, shots and Scale-Breaking for Weapons.
export function systemLine(D, v, s) {
  const st = R.vehicleStats(D, v);
  const what = {
    hull: `Armor ${s.rating}`, drive: `Speed ${s.rating}`, controls: `Handling ${signed(st.handling)}`,
    power: `Effort up to ${s.rating}; strain marks it`, weapon: `${signed(s.rating)} to Fire`, sensors: `${signed(s.rating)} to Sensors`,
    shields: `DR ${s.rating}, −1 per hit`, comms: `Commander’s +2 out to ${s.rating} zones`,
    'life-support': `sealed ${s.rating} day${s.rating === 1 ? '' : 's'}`,
    cargo: ['', 'a few people', 'a party', 'a squad', 'a company', 'vehicles or an army'][s.rating] }[s.system] || '';
  const extra = [s.strain && `strain ${s.strain}`, s.shots && `${s.shots} shots`, s.scale_breaking && 'Scale-Breaking', s.note]
    .filter(Boolean).join(', ');
  return extra ? `${what} · ${extra}` : what;
}

export function renderVehicles(D, c, rollBtn) {
  const V = D.vehicles;
  const groups = [];
  for (const v of shown(D, c)) {
    let g = groups.find(([name]) => name === v.setting);
    if (!g) groups.push(g = [v.setting, []]);
    const size = V.sizes.find(s => s.id === v.size);
    g[1].push({ value: v.id, label: `${v.name} (${size.name})` });
  }
  const stations = Object.fromEntries(V.stations.map(s => [s.id, s]));
  const pilot = R.stationRoll(D, c, stations.pilot);
  const gunner = R.stationRoll(D, c, stations.gunner);

  const cards = c.vehicles.map((ref, i) => {
    const v = V.catalog.find(x => x.id === ref.id);
    const st = R.vehicleStats(D, v);
    const type = V.types.find(t => t.id === v.type);
    const tracks = R.vehicleTracks(D, v);
    const rows = st.size.sections
      ? tracks.map(t => `<tr><td><b>${esc(t.label)}</b></td><td></td><td class="hint">holds ${esc(t.note)}</td>
          <td><span class="v-track">${trackBoxes(t.bands)}</span> <span class="hint">${t.bands.at(-1).to}</span></td></tr>`).join('')
        + v.systems.map(s => `<tr><td>${esc(s.name || V.systems.find(x => x.id === s.system).name)}</td><td>${s.rating}</td>
          <td>${esc(systemLine(D, v, s))}</td><td class="hint">in its Section</td></tr>`).join('')
      : tracks.map(t => `<tr><td><b>${esc(t.label)}</b></td><td>${t.system.rating}</td><td>${esc(systemLine(D, v, t.system))}</td>
          <td><span class="v-track">${trackBoxes(t.bands)}</span> <span class="hint">${t.bands.at(-1).to}</span></td></tr>`).join('');
    const weapons = v.systems.filter(s => s.system === 'weapon');
    return `<section class="card wide"><h2>${esc(ref.name || v.name)} <span class="hint">${esc(v.name)} · ${esc(st.size.name)} ${esc(type.name)}</span></h2>
      <div class="row"><input type="text" data-bind="vehicles.${i}.name" value="${esc(ref.name)}" placeholder="Name it (optional)" aria-label="Vehicle name">
        <button type="button" class="tiny" data-vehicle="remove" data-arg="${i}">Remove</button></div>
      <p><b>Speed ${st.speed}</b> · <b>Handling ${signed(st.handling)}</b> · <b>Armor ${st.armor}</b> · Deflect ${R.vehicleDeflect(D, c, v)} with you piloting
        · Effort up to ${st.effortMax} from ${st.effortFrom}</p>
      <p class="hint">${esc(st.size.can)}${type.note ? ` ${esc(type.note)}` : ''}</p>
      <table class="v-systems"><thead><tr><th>System</th><th>Rating</th><th>What it does</th><th>Track</th></tr></thead><tbody>${rows}</tbody></table>
      <p><b>You at the controls:</b> Pilot ${signed(pilot + st.handling)} ${rollBtn(`${v.name} Pilot`, pilot + st.handling)}${
        weapons.map(w => ` · ${esc(w.name)} ${signed(gunner + w.rating)} ${rollBtn(`${w.name}`, gunner + w.rating)}`).join('')}</p>
      ${v.capabilities.length ? `<ul class="v-caps">${v.capabilities.map(k => `<li><b>${esc(k.name)}.</b> ${esc(k.text)}</li>`).join('')}</ul>` : ''}
    </section>`;
  }).join('');

  const rulesCard = `<section class="card wide"><h2>Vehicles</h2>
    <p class="hint">${esc(V.rules.systems)} ${esc(V.rules.bands)}</p>
    <div class="row"><select id="vehicle-pick">${groupedOptions(groups, '', 'Choose a vehicle…')}</select>
      <button type="button" data-vehicle="add">Add</button></div>
    ${c.vehicles.length ? '' : '<p class="hint">No vehicles yet. The list follows the campaign’s Genres on the Character tab.</p>'}</section>`;

  const hitCard = `<section class="card wide"><h2>Running a vehicle</h2>
    <p class="hint">${esc(V.rules.deflect)} ${esc(V.rules.hit_cap)}</p>
    <p class="hint">${esc(V.rules.damage)}</p>
    <table class="v-systems"><thead><tr><th>d20</th><th>System hit</th></tr></thead><tbody>${V.hit_table.map(h =>
      `<tr><td>${h.low === h.high ? h.low : `${h.low}–${h.high}`}</td><td>${esc(h.text)}</td></tr>`).join('')}</tbody></table>
    <p class="hint">${esc(V.rules.effort)} ${esc(V.rules.strain)}</p>
    <table class="v-systems"><thead><tr><th>Size</th><th>Hull</th><th>Cap</th><th>What it can do</th></tr></thead><tbody>${V.sizes.map(s =>
      `<tr><td><b>${esc(s.name)}</b></td><td>${s.hull_boxes ?? `4 × ${s.section_boxes}`}</td><td>${s.cap}</td><td>${esc(s.can)}</td></tr>`).join('')}</tbody></table>
    <table class="v-systems"><thead><tr><th>Attacker</th><th>Result</th></tr></thead><tbody>${V.scale_rule.map(r =>
      `<tr><td>${esc(r.difference)}</td><td>${esc(r.result)}</td></tr>`).join('')}</tbody></table>
    <p class="hint">${esc(V.rules.scale)} ${esc(V.rules.scale_breaking)}</p></section>`;

  return rulesCard + cards + hitCard;
}
