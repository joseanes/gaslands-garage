// app/src/lib/rules/loadRules.ts
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  Sponsor,
  Vehicle,
  Weapon,
  Perk,
  type Sponsor as SponsorT,
  type Vehicle as VehicleT,
  type Weapon as WeaponT,
  type Perk as PerkT
} from './types';

/* ------------------------------------------------------------------
   Absolute path to <repo-root>/rules
   ------------------------------------------------------------------ */
const RULES_DIR = path.join(process.cwd(), '..', 'rules');

/* ------------------------------------------------------------------
   Generic helper for JSON arrays
   ------------------------------------------------------------------ */
async function loadJsonArray<T>(
  relPath: string,
  schema: ReturnType<typeof Sponsor.array>
): Promise<T[]> {
  const json = JSON.parse(
    await fs.readFile(path.join(RULES_DIR, relPath), 'utf-8')
  );
  return schema.parse(json) as T[];
}

/* ------------------------------------------------------------------
   Public loaders
   ------------------------------------------------------------------ */
export async function loadSponsors(): Promise<SponsorT[]> {
  const dir = path.join(RULES_DIR, 'sponsors');
  const files = await fs.readdir(dir);

  return Promise.all(
    files.map(async (file) =>
      Sponsor.parse(
        JSON.parse(await fs.readFile(path.join(dir, file), 'utf-8'))
      )
    )
  );
}

export async function loadVehicles(): Promise<VehicleT[]> {
  return loadJsonArray<VehicleT>('vehicles.json', Vehicle.array());
}

export async function loadWeapons(): Promise<WeaponT[]> {
  return loadJsonArray<WeaponT>('weapons.json', Weapon.array());
}

export async function loadPerks(): Promise<PerkT[]> {
  return loadJsonArray<PerkT>('perks.json', Perk.array());
}

