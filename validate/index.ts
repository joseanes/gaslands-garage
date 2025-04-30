import { Draft, Team, Validation, VehicleReport } from './model';
import { loadSponsors, loadVehicles, loadWeapons, loadPerks } from '$lib/rules/loadRules';
import { vehicleBaseCost, weaponCost, perkCost } from './calc';
import * as checks from './checks';

export async function validateDraft(draft: Draft): Promise<Validation> {
  // 1. hydrate rule objects (lookup maps for O(1) access)
  const [sponsors, vehicles, weapons, perks] = await Promise.all([
    loadSponsors(), loadVehicles(), loadWeapons(), loadPerks()
  ]);
  const sponsor = sponsors.find(s => s.id === draft.sponsor)!;

  const team: Team = {
    sponsor,
    vehicles: draft.vehicles.map(v => ({
      instance: v,
      class:    vehicles.find(c => c.id === v.type)!,
      weapons:  v.weapons.map(id => weapons.find(w => w.id === id)!),
      perks:    v.perks.map(id => perks.find(p => p.id === id)!)
    }))
  };

  // 2. build initial report objects
  const vehicleReports: VehicleReport[] = team.vehicles.map(v => ({
    vehicleId: v.instance.id,
    cans:
      vehicleBaseCost(v.class) +
      v.weapons.reduce((sum, w) => sum + weaponCost(w), 0) +
      v.perks.reduce((s, p) => s + perkCost(p), 0),
    errors: []
  }));

  // 3. run all rule checks
  Object.values(checks).forEach(fn => fn(team, vehicleReports));

  // 4. team-total
  const totalCans = vehicleReports.reduce((s, r) => s + r.cans, 0);

  return { cans: totalCans, errors: [], vehicleReports };
}

