import { z } from "zod";

export const createWebhookSubscriptionSchema = z.object({
  url: z.string().url(),
  eventTypes: z.array(z.string()).min(1),
});
export type CreateWebhookSubscriptionInput = z.infer<typeof createWebhookSubscriptionSchema>;
