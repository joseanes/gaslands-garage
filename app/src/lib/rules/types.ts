import { z } from "zod";

/* ---------- schemas ---------- */
export const Sponsor = z.object({
  id: z.string(),
  name: z.string(),
  starterCans: z.number().int().nonnegative(),
  perks: z.string().array(),
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
  weaponSlots: z.number().int().positive(),
  upgradeSlots: z.number().int().positive().default(2),
  color: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i).optional()
});
export type Vehicle = z.infer<typeof Vehicle>;

export const Weapon = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number().int().nonnegative(),
  slots: z.number().int().positive(),
  type: z.enum(['weapon']),
  unique: z.boolean().optional()
});

export type Weapon = z.infer<typeof Weapon>;

export const Upgrade = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number().int().nonnegative(),
  slots: z.number().int().positive(),
  specialRules: z.string(),
  type: z.literal('upgrade')
});

export type Upgrade = z.infer<typeof Upgrade>;

export const Perk = z.object({
  id: z.string(),
  name: z.string(),
  line: z.string(),
  level: z.number().int().positive(),
  text: z.string()
});
export type Perk = z.infer<typeof Perk>;

