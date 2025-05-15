// Mock for $lib/rules/loadRules.ts
import { vi } from 'vitest';
import { 
  mockSponsors, 
  mockVehicles, 
  mockWeapons, 
  mockUpgrades, 
  mockPerks 
} from './mockData';

// Create the mock functions
export const loadSponsors = vi.fn().mockResolvedValue(mockSponsors);
export const loadVehicles = vi.fn().mockResolvedValue(mockVehicles);
export const loadWeapons = vi.fn().mockResolvedValue(mockWeapons);
export const loadUpgrades = vi.fn().mockResolvedValue(mockUpgrades);
export const loadPerks = vi.fn().mockResolvedValue(mockPerks);

// Export a setup function to reset all mocks between tests
export function resetRulesMocks() {
  loadSponsors.mockClear();
  loadVehicles.mockClear();
  loadWeapons.mockClear();
  loadUpgrades.mockClear();
  loadPerks.mockClear();
}