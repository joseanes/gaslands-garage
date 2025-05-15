import { describe, it, expect } from 'vitest';
import { uniqueWeaponCheck, upgradeSlotCheck, sponsorPerkCheck, runAllChecks } from '../checks';
import { mockSponsors, mockVehicles, mockWeapons, mockUpgrades, mockPerks } from './mockData';
import type { Team, VehicleReport } from '../model';

describe('Validation Check Functions', () => {
  // Helper function to create a basic team for testing
  function createTestTeam(): Team {
    return {
      sponsor: mockSponsors[1], // Rutherford
      vehicles: [
        {
          instance: {
            id: 'vehicle1',
            type: 'car',
            name: 'Test Car',
            weapons: [],
            upgrades: [],
            perks: []
          },
          class: mockVehicles[0], // Car
          weapons: [],
          upgrades: [],
          perks: []
        }
      ]
    };
  }

  // Helper function to create a basic report array
  function createTestReports(): VehicleReport[] {
    return [
      {
        vehicleId: 'vehicle1',
        cans: 0,
        errors: []
      }
    ];
  }

  describe('uniqueWeaponCheck', () => {
    it('should not add errors when there are no duplicate unique weapons', () => {
      const team = createTestTeam();
      team.vehicles[0].weapons = [
        { ...mockWeapons[0] }, // Machine Gun (not unique)
        { ...mockWeapons[1] }  // Rocket Launcher (unique)
      ];
      
      const reports = createTestReports();
      uniqueWeaponCheck(team, reports);
      
      expect(reports[0].errors).toEqual([]);
    });

    it('should detect duplicate unique weapons', () => {
      const team = createTestTeam();
      team.vehicles[0].weapons = [
        { ...mockWeapons[1] }, // Rocket Launcher (unique)
        { ...mockWeapons[1] }  // Duplicate Rocket Launcher
      ];
      
      const reports = createTestReports();
      uniqueWeaponCheck(team, reports);
      
      expect(reports[0].errors).toContain('Duplicate unique weapon: Rocket Launcher');
    });

    it('should ignore non-unique weapons', () => {
      const team = createTestTeam();
      team.vehicles[0].weapons = [
        { ...mockWeapons[0] }, // Machine Gun (not unique)
        { ...mockWeapons[0] }  // Duplicate Machine Gun (still not unique)
      ];
      
      const reports = createTestReports();
      uniqueWeaponCheck(team, reports);
      
      expect(reports[0].errors).toEqual([]);
    });
  });

  describe('upgradeSlotCheck', () => {
    it('should not add errors when upgrades are within slot limit', () => {
      const team = createTestTeam();
      team.vehicles[0].upgrades = [
        { ...mockUpgrades[0] } // One upgrade, within car's 2 slot limit
      ];
      
      const reports = createTestReports();
      upgradeSlotCheck(team, reports);
      
      expect(reports[0].errors).toEqual([]);
    });

    it('should detect when upgrades exceed slot limit', () => {
      const team = createTestTeam();
      team.vehicles[0].class = mockVehicles[1]; // Buggy (1 upgrade slot)
      team.vehicles[0].upgrades = [
        { ...mockUpgrades[0] }, // Armor
        { ...mockUpgrades[1] }  // Nitro - exceeds limit
      ];
      
      const reports = createTestReports();
      upgradeSlotCheck(team, reports);
      
      expect(reports[0].errors).toContain('Too many upgrades: 2/1 slots');
    });

    it('should handle vehicle with no upgrade slots specified', () => {
      const team = createTestTeam();
      const noSlotsVehicle = { ...team.vehicles[0].class };
      delete noSlotsVehicle.upgradeSlots; // Remove upgrade slots property
      
      team.vehicles[0].class = noSlotsVehicle;
      team.vehicles[0].upgrades = [
        { ...mockUpgrades[0] } // Trying to add an upgrade
      ];
      
      const reports = createTestReports();
      upgradeSlotCheck(team, reports);
      
      expect(reports[0].errors).toContain('Too many upgrades: 1/0 slots');
    });
  });

  describe('sponsorPerkCheck', () => {
    it('should not add errors when perks are available for the sponsor', () => {
      const team = createTestTeam();
      team.vehicles[0].perks = [
        { ...mockPerks[0] }, // perk1 - available for Rutherford
        { ...mockPerks[2] }  // perk3 - available for Rutherford
      ];
      
      const reports = createTestReports();
      sponsorPerkCheck(team, reports);
      
      expect(reports[0].errors).toEqual([]);
    });

    it('should detect perks not available for the sponsor', () => {
      const team = createTestTeam();
      team.vehicles[0].perks = [
        { ...mockPerks[0] }, // perk1 - available for Rutherford
        { ...mockPerks[4] }  // perk5 - NOT available for Rutherford
      ];
      
      const reports = createTestReports();
      sponsorPerkCheck(team, reports);
      
      expect(reports[0].errors).toContain('Invalid perk: Perk 5 is not available for Rutherford');
    });
  });

  describe('runAllChecks', () => {
    it('should run all checks and aggregate errors', () => {
      const team = createTestTeam();
      // Add a duplicate unique weapon
      team.vehicles[0].weapons = [
        { ...mockWeapons[1] }, // Rocket Launcher (unique)
        { ...mockWeapons[1] }  // Duplicate Rocket Launcher
      ];
      
      // Add too many upgrades
      team.vehicles[0].class = mockVehicles[1]; // Buggy (1 upgrade slot)
      team.vehicles[0].upgrades = [
        { ...mockUpgrades[0] }, // Armor
        { ...mockUpgrades[1] }  // Nitro - exceeds limit
      ];
      
      // Add invalid perk
      team.vehicles[0].perks = [
        { ...mockPerks[4] }  // perk5 - NOT available for Rutherford
      ];
      
      const reports = createTestReports();
      runAllChecks(team, reports);
      
      // Should have 3 errors (one from each check)
      expect(reports[0].errors.length).toBe(3);
      expect(reports[0].errors).toContain('Duplicate unique weapon: Rocket Launcher');
      expect(reports[0].errors).toContain('Too many upgrades: 2/1 slots');
      expect(reports[0].errors).toContain('Invalid perk: Perk 5 is not available for Rutherford');
    });
  });
});