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
