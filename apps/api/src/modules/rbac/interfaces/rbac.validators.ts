import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(2),
});

export const assignPermissionsSchema = z.object({
  permissionCodes: z.array(z.string()).min(0),
});

export const grantUserPermissionSchema = z.object({
  permissionCode: z.string(),
  granted: z.boolean(),
});

export const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  password: z.string().min(8),
  roleId: z.string().uuid().optional(),
});
