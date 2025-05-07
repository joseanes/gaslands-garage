

// app/src/lib/validate/checks.ts
import type { Team, VehicleReport } from './model';

/* ------------------------------------------------------------
   NEW RULE A – weapon-slot limit
   ------------------------------------------------------------ */
export function weaponSlotCheck(team: Team, reports: VehicleReport[]) {
  team.vehicles.forEach((v, i) => {
    const max = v.class.weaponSlots;         // needs weaponSlots in vehicles.json
    if (v.weapons.length > max) {
      reports[i].errors.push(
        `Too many weapons: ${v.weapons.length}/${max} slots`
      );
    }
  });
}
/* ------------------------------------------------------------
   RULE B – no duplicate “unique” weapons per vehicle
   ------------------------------------------------------------ */
   export function uniqueWeaponCheck(team: Team, reports: VehicleReport[]) {
    team.vehicles.forEach((v, i) => {
      const uniques = v.weapons.filter((w) => w.unique);
      const idsSeen = new Set<string>();
  
      for (const w of uniques) {
        if (idsSeen.has(w.id)) {
          reports[i].errors.push(`Duplicate unique weapon: ${w.name}`);
        } else {
          idsSeen.add(w.id);
        }
      }
    });
  }
  
/* ------------------------------------------------------------
   RULE C – upgrade-slot limit
   ------------------------------------------------------------ */
   export function upgradeSlotCheck(team: Team, reports: VehicleReport[]) {
    team.vehicles.forEach((v, i) => {
      const max = v.class.upgradeSlots;
      if (v.upgrades.length > max) {
        reports[i].errors.push(
          `Too many upgrades: ${v.upgrades.length}/${max} slots`
        );
      }
    });
  }

/* ------------------------------------------------------------
   aggregate runner – call every rule function here
   ------------------------------------------------------------ */
   export function runAllChecks(team: Team, reports: VehicleReport[]) {
    weaponSlotCheck(team, reports);
    uniqueWeaponCheck(team, reports);
    upgradeSlotCheck(team, reports);
  }
  
