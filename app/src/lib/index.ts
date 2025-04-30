


import type { Draft, Team, VehicleReport, Validation } from './model';
import { runAllChecks } from './checks';
import { vehicleBaseCost, weaponCost, perkCost } from './calc';
import {
  loadSponsors,
  loadVehicles,
  loadWeapons,
  loadPerks
} from '$lib/rules/loadRules';

const TEAM_CAP = 50;    // 🎯 change this if your game size differs

export async function validateDraft(draft: Draft): Promise<Validation> {
  /* ---------- 1. load rules ---------- */
  const [sponsors, vehicles, weapons, perks] = await Promise.all([
    loadSponsors(),
    loadVehicles(),
    loadWeapons(),
    loadPerks()
  ]);

  const sponsor = sponsors.find((s) => s.id === draft.sponsor)!;

  /* ---------- 2. hydrate team --------- */
  const team: Team = {
    sponsor,
    vehicles: draft.vehicles.map((v) => ({
      instance: v,
      class:    vehicles.find((c) => c.id === v.type)!,
      weapons:  v.weapons.map((id) => weapons.find((w) => w.id === id)!),
      perks:    v.perks.map((id) => perks.find((p) => p.id === id)!)
    }))
  };

  /* ---------- 3. per-vehicle report ---- */
  const vehicleReports: VehicleReport[] = team.vehicles.map((v) => ({
    vehicleId: v.instance.id,
    cans:
      vehicleBaseCost(v.class) +
      v.weapons.reduce((s, w) => s + weaponCost(w), 0) +
      v.perks.reduce((s, p) => s + perkCost(p), 0),
    errors: []
  }));

  /* ---------- 4. rule checks ----------- */
  runAllChecks(team, vehicleReports);

  /* ---------- 5. team total & cap ------ */
  const totalCans = vehicleReports.reduce((s, r) => s + r.cans, 0);
  const teamErrors: string[] = [];

  if (totalCans > TEAM_CAP) {
    teamErrors.push(`Team exceeds ${TEAM_CAP} cans (currently ${totalCans}).`);
  }

  return { cans: totalCans, errors: teamErrors, vehicleReports };
}
