import { z } from "zod";

export const createBranchSchema = z.object({
  name: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().optional(),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

/** Editar o desactivar una sucursal (la principal no se puede desactivar). */
export const updateBranchSchema = z
  .object({
    name: z.string().min(2).optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No hay cambios" });
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

/** Sucursales en las que trabaja un usuario; `defaultBranchId` es con la que entra. */
export const setUserBranchesSchema = z
  .object({
    branchIds: z.array(z.string().uuid()).min(1, "Elige al menos una sucursal"),
    defaultBranchId: z.string().uuid(),
  })
  .refine((v) => v.branchIds.includes(v.defaultBranchId), {
    message: "La sucursal por defecto debe estar entre las elegidas",
    path: ["defaultBranchId"],
  });
export type SetUserBranchesInput = z.infer<typeof setUserBranchesSchema>;

export const switchBranchSchema = z.object({ branchId: z.string().uuid() });
export type SwitchBranchInput = z.infer<typeof switchBranchSchema>;
