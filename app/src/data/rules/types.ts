export const Vehicle = z.object({
  id: z.string(),
  name: z.string(),
  baseCost: z.number().int().nonnegative(),
  maxHull: z.number().int().positive(),
  weaponSlots: z.number().int().positive(),
  upgradeSlots: z.number().int().positive().default(2)  // Most vehicles have 2 upgrade slots by default
});

export const Weapon = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number().int().nonnegative(),
  slots: z.number().int().positive(),
  type: z.enum(['weapon']),
  unique: z.boolean().optional()
});

export const Upgrade = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number().int().nonnegative(),
  slots: z.number().int().positive(),
  specialRules: z.string(),
  type: z.literal('upgrade')
});
