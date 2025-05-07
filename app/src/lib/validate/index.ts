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
    vehicles: draft.vehicles
      .filter(v => {
        const vehicleType = vehicles.find(vc => vc.id === v.type);
        return !!vehicleType; // Filter out any vehicles with unknown types
      })
      .map((v) => {
        const vehicleClass = vehicles.find(vc => vc.id === v.type);
        if (!vehicleClass) {
          // This should never happen due to the filter above, but it's a safety check
          throw new Error(`Vehicle type ${v.type} not found`);
        }
        
        return {
          instance: v,
          class: vehicleClass,
          weapons: v.weapons
            .map(id => weapons.find(w => w.id === id))
            .filter((w): w is NonNullable<typeof w> => w !== undefined),
          perks: v.perks
            .map(id => perks.find(p => p.id === id))
            .filter((p): p is NonNullable<typeof p> => p !== undefined)
        };
      })
  };

  /* 4 — per-vehicle reports with cans */
  const vehicleReports: VehicleReport[] = team.vehicles.map((v) => {
    // Safety check for missing data
    if (!v.instance || !v.class) {
      return {
        vehicleId: v.instance?.id || 'unknown',
        cans: 0,
        errors: ['Invalid vehicle data']
      };
    }
    
    // Calculate total cans safely
    const baseCost = vehicleBaseCost(v.class);
    const weaponsCost = v.weapons.reduce((s, w) => s + (w ? weaponCost(w) : 0), 0);
    const perksCost = v.perks.reduce((s, p) => s + (p ? perkCost(p) : 0), 0);
    
    return {
      vehicleId: v.instance.id,
      cans: baseCost + weaponsCost + perksCost,
      errors: []
    };
  });

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
