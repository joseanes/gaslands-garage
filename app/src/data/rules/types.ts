export const Vehicle = z.object({
  id: z.string(),
  name: z.string(),
  baseCost: z.number().int().nonnegative(),
  maxHull: z.number().int().positive(),
  weaponSlots: z.number().int().positive()   // ← new
});

export const Weapon = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number().int().nonnegative(),
  slots: z.number().int().positive(),
  type: z.enum(['weapon', 'upgrade']),
  unique: z.boolean().optional()   // ← add this line
});
