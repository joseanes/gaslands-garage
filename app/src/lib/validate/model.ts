// app/src/lib/validate/model.ts
export type SponsorID = string;
export type VehicleID = string;

export interface Draft {
  sponsor: SponsorID;
  vehicles: {
    id: VehicleID;
    type: string;
    weapons: string[];
    upgrades?: string[];  // Optional for backward compatibility
    perks: string[];
    name: string;
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

