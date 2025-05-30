// app/src/lib/validate/model.ts
export type SponsorID = string;
export type VehicleID = string;

export interface Draft {
  sponsor: SponsorID;
  vehicles: {
    id: VehicleID;
    type: string;
    weapons: string[];
    weaponFacings?: Record<string, string>;  // Maps weaponId to facing
    upgrades?: string[];  // Optional for backward compatibility
    perks: string[];
    name: string;
  }[];
  teamName?: string;   // Optional for backward compatibility
  maxCans?: number;    // Optional for backward compatibility
  darkMode?: boolean;  // Optional dark mode setting
  weaponAndUpgradeSpecialRules?: {  // Special rules for weapons and upgrades
    id: string;
    ruleName: string;
    rule: string;
  }[];
}

export interface VehicleReport {
  vehicleId: VehicleID;
  cans: number;
  errors: string[];
}

export interface Validation {
  cans: number;
  errors: string[];
  vehicleReports: VehicleReport[];
}

export interface Team {
  sponsor: import('$lib/rules/types').Sponsor;
  vehicles: {
    instance: Draft['vehicles'][0];
    class: import('$lib/rules/types').Vehicle;
    weapons: import('$lib/rules/types').Weapon[];
    upgrades: import('$lib/rules/types').Upgrade[];
    perks: import('$lib/rules/types').Perk[];
  }[];
}

