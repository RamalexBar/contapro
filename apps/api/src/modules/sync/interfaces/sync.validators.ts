import { z } from "zod";

export const pushSyncEventsSchema = z.object({
  deviceId: z.string().min(1),
  platform: z.enum(["ANDROID", "IOS", "WEB"]),
  events: z
    .array(
      z.object({
        clientEventId: z.string().min(1),
        entityType: z.enum(["SALE"]),
        payload: z.unknown(),
      })
    )
    .min(1),
});
