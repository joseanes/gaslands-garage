iimport { z } from 'zod';

/* ---------- schemas ---------- */
export const Sponsor = z.object({
  id: z.string(),
  name: z.string(),
  starterCans: z.number().int().nonnegative(),
  perks: z.string().array(),
  color: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i)
});

export type Sponsor = z.infer<typeof Sponsor>;

export const Vehicle = z.object({
  id: z.string(),
  name: z.string(),
  maxGear: z.number().int().positive(),
  baseCost: z.number().int().nonnegative(),
  maxHull: z.number().int().positive()
});
export type Vehicle = z.infer<typeof Vehicle>;

export const Weapon = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number().int().nonnegative(),
  slots: z.number().int().nonnegative(),
  type: z.enum(['weapon', 'upgrade'])
});
export type Weapon = z.infer<typeof Weapon>;

export const Perk = z.object({
  id: z.string(),
  name: z.string(),
  line: z.string(),
  level: z.number().int().positive(),
  text: z.string()
});
export type Perk = z.infer<typeof Perk>;

