"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { Webhook } from "svix";

export const handleClerkWebhook = internalAction({
  args: {
    payload: v.string(),
    svix_id: v.string(),
    svix_timestamp: v.string(),
    svix_signature: v.string(),
  },
  handler: async (ctx, { payload, svix_id, svix_timestamp, svix_signature }) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    if (!webhookSecret) {
      console.error("Missing CLERK_WEBHOOK_SIGNING_SECRET");
      return { error: "Server configuration error", status: 500 };
    }

    const wh = new Webhook(webhookSecret);
    let evt: any;

    try {
      evt = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error("Webhook verification failed:", err);
      return { error: "Invalid signature", status: 400 };
    }

    const eventType = evt.type;

    try {
      switch (eventType) {
        case "user.created":
          await ctx.runMutation(internal.clerkWebhooks.createUser, {
            clerkId: evt.data.id,
            email: evt.data.email_addresses[0]?.email_address ?? "",
            firstName: evt.data.first_name ?? undefined,
            lastName: evt.data.last_name ?? undefined,
            imageUrl: evt.data.image_url ?? undefined,
          });
          break;

        case "user.updated":
          await ctx.runMutation(internal.clerkWebhooks.updateUser, {
            clerkId: evt.data.id,
            email: evt.data.email_addresses[0]?.email_address ?? "",
            firstName: evt.data.first_name ?? undefined,
            lastName: evt.data.last_name ?? undefined,
            imageUrl: evt.data.image_url ?? undefined,
          });
          break;

        case "user.deleted":
          await ctx.runMutation(internal.clerkWebhooks.deleteUser, {
            clerkId: evt.data.id,
          });
          break;

        case "organization.created":
          await ctx.runMutation(internal.clerkWebhooks.createOrganization, {
            clerkId: evt.data.id,
            name: evt.data.name,
            slug: evt.data.slug ?? undefined,
            imageUrl: evt.data.image_url ?? undefined,
          });
          break;

        case "organization.updated":
          await ctx.runMutation(internal.clerkWebhooks.updateOrganization, {
            clerkId: evt.data.id,
            name: evt.data.name,
            slug: evt.data.slug ?? undefined,
            imageUrl: evt.data.image_url ?? undefined,
          });
          break;

        case "organization.deleted":
          await ctx.runMutation(internal.clerkWebhooks.deleteOrganization, {
            clerkId: evt.data.id,
          });
          break;

        case "organizationMembership.created":
          await ctx.runMutation(internal.clerkWebhooks.createMembership, {
            clerkId: evt.data.id,
            userClerkId: evt.data.public_user_data.user_id,
            organizationClerkId: evt.data.organization.id,
            role: evt.data.role,
          });
          break;

        case "organizationMembership.updated":
          await ctx.runMutation(internal.clerkWebhooks.updateMembership, {
            clerkId: evt.data.id,
            role: evt.data.role,
          });
          break;

        case "organizationMembership.deleted":
          await ctx.runMutation(internal.clerkWebhooks.deleteMembership, {
            clerkId: evt.data.id,
          });
          break;

        default:
          console.log(`Unhandled event type: ${eventType}`);
      }
    } catch (err) {
      console.error(`Error processing ${eventType}:`, err);
      return { error: "Error processing webhook", status: 500 };
    }

    return { success: true, status: 200 };
  },
});
