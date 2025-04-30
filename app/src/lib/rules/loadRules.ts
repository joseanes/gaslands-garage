
// app/src/lib/rules/loadRules.ts
import { Sponsor, Vehicle, Weapon, Perk } from './types';

/* ── sponsors (one file per sponsor) ───────────────────────── */
const sponsorMods = import.meta.glob('../../data/rules/sponsors/*.json', {
  eager: true
});
export function loadSponsors() {
  return Object.values(sponsorMods).map((m: any) => Sponsor.parse(m.default));
}

/* ── vehicles.json ─────────────────────────────────────────── */
import vehiclesRaw from '../../data/rules/vehicles.json';
export function loadVehicles() {
  return Vehicle.array().parse(vehiclesRaw);
}

/* ── weapons.json ──────────────────────────────────────────── */
import weaponsRaw from '../../data/rules/weapons.json';
export function loadWeapons() {
  return Weapon.array().parse(weaponsRaw);
}

/* ── perks.json ────────────────────────────────────────────── */
import perksRaw from '../../data/rules/perks.json';
export function loadPerks() {
  return Perk.array().parse(perksRaw);
}
