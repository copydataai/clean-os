import { internal } from "../_generated/api";

export async function logTallyRouteValidationFailure(
  ctx: any,
  args: {
    endpoint: "request" | "confirmation";
    routeToken?: string;
    message: string;
  },
) {
  try {
    await ctx.runMutation(internal.integrations.logIntegrationWebhookAttempt, {
      provider: "tally",
      endpoint: args.endpoint,
      routeToken: args.routeToken,
      httpStatus: 400,
      stage: "route_validation",
      message: args.message,
    });
  } catch (err) {
    console.error("[Tally Webhook] Failed to log route validation failure", err);
  }
}
