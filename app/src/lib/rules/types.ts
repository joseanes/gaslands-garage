import { z } from "zod";

/* ---------- schemas ---------- */
export const Sponsor = z.object({
  id: z.string(),
  name: z.string(),
  starterCans: z.number().int().nonnegative().optional(), // Made optional as it will be deprecated
  perks: z.string().array().optional(), // Made optional as it will be deprecated
  perksClasses: z.string().array().optional(), // New field for perk classes
  color: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i),
  source: z.string().optional()
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
  source: z.string().optional()
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
  // New optional numerical fields that can be positive, negative, or zero
  hullModifier: z.number().int().optional(),
  crewModifier: z.number().int().optional(),
  gearModifier: z.number().int().optional(),
  handlingModifier: z.number().int().optional()
});

export type Upgrade = z.infer<typeof Upgrade>;

export const Perk = z.object({
  id: z.string(),
  name: z.string(),
  sponsor: z.string(), // Renamed from 'line'
  cost: z.number().int().nonnegative().optional(), // Cost in cans
  class: z.string().optional(), // Class field for categorization
  text: z.string()
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

