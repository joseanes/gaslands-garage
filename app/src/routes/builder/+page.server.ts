import { loadSponsors, loadVehicles } from '$lib/rules/loadRules';

export async function load() {
  return {
    sponsors: await loadSponsors(),
    vehicleTypes: await loadVehicles()
  };
}

