// app/src/lib/validate/model.ts
export type SponsorID = string;
export type VehicleID = string;

export interface Draft {
  sponsor: SponsorID;
  vehicles: {
    id: VehicleID;
    type: string;
    weapons: string[];
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

