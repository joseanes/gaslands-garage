// app/src/lib/validate/index.ts
import type { Draft, Team, VehicleReport, Validation } from './model';
import { runAllChecks } from './checks';
import {
  loadSponsors,
  loadVehicles,
  loadWeapons,
  loadPerks
} from '$lib/rules/loadRules';
import {
  vehicleBaseCost,
  weaponCost,
  perkCost
} from './calc';

const TEAM_CAP = 50;

export async function validateDraft(draft: Draft): Promise<Validation> {
  /* 1 — load all rule data */
  const [sponsors, vehicles, weapons, perks] = await Promise.all([
    loadSponsors(),
    loadVehicles(),
    loadWeapons(),
    loadPerks()
  ]);

  /* 2 — look-up chosen sponsor BEFORE constructing team */
  const sponsor = sponsors.find((s) => s.id === draft.sponsor);
  if (!sponsor) {
    return { cans: 0, errors: ['Unknown sponsor'], vehicleReports: [] };
  }

  /* 3 — hydrate team */
  const team: Team = {
    sponsor,
    vehicles: draft.vehicles.map((v) => ({
      instance: v,
      class:   vehicles.find((vc) => vc.id === v.type)!,
      weapons: v.weapons.map((id) => weapons.find((w) => w.id === id)!),
      perks:   v.perks.map((id) => perks.find((p) => p.id === id)!)
    }))
  };

  /* 4 — per-vehicle reports with cans */
  const vehicleReports: VehicleReport[] = team.vehicles.map((v) => ({
    vehicleId: v.instance.id,
    cans:
      vehicleBaseCost(v.class) +
      v.weapons.reduce((s, w) => s + weaponCost(w), 0) +
      v.perks.reduce((s, p) => s + perkCost(p), 0),
    errors: []
  }));

  /* 5 — rule checks */
  runAllChecks(team, vehicleReports);

  /* 6 — team total + cap */
  const totalCans = vehicleReports.reduce((s, r) => s + r.cans, 0);
  const errors: string[] = [];

  if (totalCans > TEAM_CAP) {
    errors.push(`Team exceeds ${TEAM_CAP} cans (currently ${totalCans})`);
  }

  return { cans: totalCans, errors, vehicleReports };
}
