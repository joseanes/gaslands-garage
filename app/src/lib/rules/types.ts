import { z } from "zod";

/* ---------- schemas ---------- */
export const Sponsor = z.object({
  id: z.string(),
  name: z.string(),
  starterCans: z.number().int().nonnegative().optional(), // Made optional as it will be deprecated
  perks: z.string().array().optional(), // Made optional as it will be deprecated
  perksClasses: z.string().array().optional(), // New field for perk classes
  color: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i),
  source: z.string().optional(),
  electrical: z.boolean().optional().default(false) // Whether sponsor can use electrical items
});

export type Sponsor = z.infer<typeof Sponsor>;

export const Vehicle = z.object({
  id: z.string(),
  name: z.string(),
  maxGear: z.number().int().positive(),
  baseCost: z.number().int().nonnegative(),
  maxHull: z.number().int().positive(),
  upgradeSlots: z.number().int().nonnegative().optional().default(2),
  buildSlots: z.number().int().nonnegative().default(2),
  crew: z.number().int().nonnegative().default(1),
  color: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i).optional(),
  weight: z.union([z.string(), z.number().int().nonnegative()]).default(1),
  advanced: z.boolean().optional().default(false),
  source: z.string().optional(),
  handling: z.number().int().optional(),
  specialRules: z.string().optional()
});
export type Vehicle = z.infer<typeof Vehicle>;

export const Weapon = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number().int().nonnegative(),
  slots: z.number().int().nonnegative(), // Changed from positive() to nonnegative() to allow 0
  buildSlots: z.number().int().nonnegative().default(1), // Changed to match slots
  type: z.enum(['weapon']),
  facing: z.string().optional(),
  crewFired: z.boolean().optional(),
  unique: z.boolean().optional(),
  advanced: z.boolean().optional().default(false),
  range: z.string().optional(),
  attackDice: z.number().int().nonnegative().optional(),
  specialRules: z.string().optional(),
  dropped: z.boolean().optional(),
  source: z.string().optional(),
  electrical: z.boolean().optional().default(false) // New field for electrical weapons
});

export type Weapon = z.infer<typeof Weapon>;

export const Upgrade = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number().int().nonnegative(),
  slots: z.number().int().nonnegative(), // Changed from positive() to nonnegative() to allow 0
  buildSlots: z.number().int().nonnegative().default(1), // Changed to match slots
  specialRules: z.string(),
  type: z.literal('upgrade'),
  advanced: z.boolean().optional().default(false),
  source: z.string().optional(),
  electrical: z.boolean().optional().default(false), // New field for electrical upgrades
  360: z.boolean().optional().default(false), // Whether the upgrade provides 360-degree firing arc
  // Vehicle stat modifiers
  hull: z.number().int().optional(), // Hull points modifier
  gear: z.number().int().optional(), // Max gear modifier
  handling: z.number().int().optional(), // Handling modifier
  crew: z.number().int().optional() // Crew modifier
});

export type Upgrade = z.infer<typeof Upgrade>;

export const Perk = z.object({
  id: z.string(),
  name: z.string(),
  sponsor: z.string(), // Renamed from 'line'
  cost: z.number().int().nonnegative().optional(), // Cost in cans
  class: z.string().optional(), // Class field for categorization
  text: z.string(),
  electrical: z.boolean().optional().default(false), // New field for electrical perks
  level: z.number().int().nonnegative().optional() // Perk level
});
export type Perk = z.infer<typeof Perk>;

export const VehicleRule = z.object({
  ruleName: z.string(),
  rule: z.string()
});
export type VehicleRule = z.infer<typeof VehicleRule>;

export const WeaponSpecialRule = z.object({
  id: z.string(),
  ruleName: z.string(),
  rule: z.string()
});
export type WeaponSpecialRule = z.infer<typeof WeaponSpecialRule>;

