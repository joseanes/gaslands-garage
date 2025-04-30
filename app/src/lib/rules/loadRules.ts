iimport fs from 'node:fs/promises';
import path from 'node:path';
import { Sponsor, Vehicle, Weapon, Perk } from './types';

const RULES_DIR = '../../rules';

export async function loadSponsors() {
  const dir = path.resolve(import.meta.dir, RULES_DIR, 'sponsors');
  const files = await fs.readdir(dir);
  return Promise.all(
    files.map(async f => Sponsor.parse(
      JSON.parse(await fs.readFile(path.join(dir, f), 'utf-8'))
    ))
  );
}

export async function loadVehicles() {
  const json = JSON.parse(
    await fs.readFile(path.resolve(import.meta.dir, RULES_DIR, 'vehicles.json'), 'utf-8')
  );
  return Vehicle.array().parse(json);
}

/* similar helpers for weapons & perks */

