// app/src/lib/validate/index.ts
import type { Draft, Team, VehicleReport, Validation } from './model';
import { runAllChecks } from './checks';
import {
  loadSponsors,
  loadVehicles,
  loadWeapons,
  loadUpgrades,
  loadPerks
} from '$lib/rules/loadRules';
import {
  vehicleBaseCost,
  weaponCost,
  upgradeCost,
  perkCost
} from './calc';

const DEFAULT_TEAM_CAP = 50;

// Cached rule data to avoid repeated loading
let cachedSponsors: any[] | null = null;
let cachedVehicles: any[] | null = null;
let cachedWeapons: any[] | null = null;
let cachedUpgrades: any[] | null = null;
let cachedPerks: any[] | null = null;

export async function validateDraft(draft: Draft): Promise<Validation> {
  // Use custom maxCans if provided, otherwise use default
  const TEAM_CAP = draft.maxCans || DEFAULT_TEAM_CAP;
  
  /* 1 — load all rule data */
  // Use cached data if available to prevent repeated loading
  if (!cachedSponsors || !cachedVehicles || !cachedWeapons || !cachedUpgrades || !cachedPerks) {
    [cachedSponsors, cachedVehicles, cachedWeapons, cachedUpgrades, cachedPerks] = await Promise.all([
      loadSponsors(),
      loadVehicles(),
      loadWeapons(),
      loadUpgrades(),
      loadPerks()
    ]);
  }
  
  // Use cached data
  const sponsors = cachedSponsors;
  const vehicles = cachedVehicles;
  const weapons = cachedWeapons;
  const upgrades = cachedUpgrades;
  const perks = cachedPerks;

  /* 2 — look-up chosen sponsor BEFORE constructing team */
  const sponsor = sponsors.find((s) => s.id === draft.sponsor);
  if (!sponsor) {
    return { cans: 0, errors: ['Unknown sponsor'], vehicleReports: [] };
  }

  /* 3 — hydrate team */
  // Debug the input draft
  console.log("Processing draft with vehicles:", draft.vehicles.map(v => ({
    id: v.id,
    type: v.type,
    weapons: v.weapons,
    upgrades: v.upgrades,
    perks: v.perks
  })));

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

        // Process weapons with careful error handling and logging
        const processedWeapons = v.weapons.map(weaponInstanceId => {
          try {
            console.log(`Processing weapon: ${weaponInstanceId} for vehicle ${v.id}`);

            // Extract base weapon ID from instance ID (format: baseId_instanceHash)
            const parts = weaponInstanceId.split('_');
            // If there's no underscore, use the whole ID
            const baseWeaponId = parts.length > 1 ? parts[0] : weaponInstanceId;

            const weaponObj = weapons.find(w => w.id === baseWeaponId);
            if (!weaponObj) {
              console.warn(`Weapon not found: ${baseWeaponId} (from ${weaponInstanceId})`);
            }
            return weaponObj;
          } catch (err) {
            console.error(`Error processing weapon ID: ${weaponInstanceId}`, err);
            return undefined;
          }
        }).filter((w): w is NonNullable<typeof w> => w !== undefined);

        return {
          instance: v,
          class: vehicleClass,
          weapons: processedWeapons,
          upgrades: (v.upgrades || [])  // Handle existing drafts without upgrades
            .map(id => upgrades.find(u => u.id === id))
            .filter((u): u is NonNullable<typeof u> => u !== undefined),
          perks: v.perks
            .map(id => perks.find(p => p.id === id))
            .filter((p): p is NonNullable<typeof p> => p !== undefined)
        };
      })
  };

  /* 4 — per-vehicle reports with cans */
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

    // Calculate weapon costs with detailed logging
    const weaponDetails = v.weapons.map(w => {
      if (!w) return { id: 'unknown', cost: 0 };
      const cost = weaponCost(w);
      return { id: w.id, name: w.name, cost };
    });
    const weaponsCost = weaponDetails.reduce((s, w) => s + w.cost, 0);

    // Calculate upgrade costs
    const upgradesCost = (v.upgrades || []).reduce((s, u) => s + (u ? upgradeCost(u) : 0), 0);

    // Calculate perk costs
    const perksCost = v.perks.reduce((s, p) => s + (p ? perkCost(p) : 0), 0);

    // Calculate total vehicle cost
    const totalVehicleCost = baseCost + weaponsCost + upgradesCost + perksCost;

    // Debug vehicle cost breakdown
    console.log(`Vehicle cost breakdown for ${v.instance.name} (${v.instance.id}):`, {
      baseCost,
      weaponsCost,
      weaponDetails,
      upgradesCost,
      perksCost,
      totalCost: totalVehicleCost,
      weapons: v.instance.weapons,
      processedWeapons: v.weapons.map(w => w.id)
    });
    
    return {
      vehicleId: v.instance.id,
      cans: baseCost + weaponsCost + upgradesCost + perksCost,
      errors: []
    };
  });

  /* 5 — rule checks */
  runAllChecks(team, vehicleReports);

  /* 6 — team total + cap */
  const totalCans = vehicleReports.reduce((s, r) => s + r.cans, 0);
  const errors: string[] = [];

  if (totalCans > TEAM_CAP) {
    errors.push(`Team exceeds ${TEAM_CAP} cans (currently ${totalCans})`);
  }

  // Debug info
  console.log("Validation completed:", {
    totalCans,
    vehicleReports: vehicleReports.map(vr => ({
      vehicleId: vr.vehicleId,
      cans: vr.cans
    }))
  });

  return { cans: totalCans, errors, vehicleReports };
}