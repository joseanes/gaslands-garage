// runs in browser *and* during dev SSR
import { loadSponsors, loadVehicles, loadWeapons, loadUpgrades, loadPerks } from '$lib/rules/loadRules';

export const prerender = false;   // keep SPA behaviour

export async function load() {
  return {
    sponsors: await loadSponsors(),
    vehicleTypes: await loadVehicles(),
    weapons: await loadWeapons(),
    upgrades: await loadUpgrades(),
    perks: await loadPerks()
  };
}

