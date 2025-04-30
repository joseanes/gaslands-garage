// ID types for clarity
export type SponsorID = string;
export type VehicleID = string;
export type WeaponID  = string;
export type PerkID    = string;

/** Raw user draft (straight from UI) */
export interface Draft {
  sponsor: SponsorID;
  vehicles: {
    id: VehicleID;
    type: string;          // 'car', 'buggy', …
    weapons: WeaponID[];
    perks:   PerkID[];
    name:    string;
  }[];
}

/** Hydrated objects after rule-lookup */
export interface Team {
  sponsor: import('../rules/types').Sponsor;
  vehicles: {
    instance: Draft['vehicles'][0];
    class:    import('../rules/types').Vehicle;
    weapons:  import('../rules/types').Weapon[];
    perks:    import('../rules/types').Perk[];
  }[];
}

/** Report types */
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

