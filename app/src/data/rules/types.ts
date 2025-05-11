import { z } from "zod";

export const Vehicle = z.object({
  id: z.string(),
  name: z.string(),
  baseCost: z.number().int().nonnegative(),
  maxHull: z.number().int().positive(),
  upgradeSlots: z.number().int().nonnegative().optional().default(2),  // Most vehicles have 2 upgrade slots by default
  advanced: z.boolean().optional().default(false),
  color: z.string().optional()
});

export const Weapon = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number().int().nonnegative(),
  slots: z.number().int().positive(),
  type: z.enum(['weapon']),
  unique: z.boolean().optional(),
  advanced: z.boolean().optional().default(false),
  facing: z.enum(['front', 'side', 'rear', 'turret', 'hull', 'any']).optional()
});

export const Upgrade = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number().int().nonnegative(),
  slots: z.number().int().positive(),
  specialRules: z.string(),
  type: z.literal('upgrade'),
  advanced: z.boolean().optional().default(false)
});
