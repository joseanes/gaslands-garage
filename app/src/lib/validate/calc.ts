// app/src/lib/validate/calc.ts
export function sum(nums: number[]) {
  return nums.reduce((s, n) => s + n, 0);
}

import type { Vehicle, Weapon, Perk } from '$lib/rules/types';

export function vehicleBaseCost(v: Vehicle) {
  return v.baseCost;
}

export function weaponCost(w: Weapon) {
  return w.cost;
}

export function perkCost(p: Perk) {
  return p.level;        // tweak later if rules differ
}
