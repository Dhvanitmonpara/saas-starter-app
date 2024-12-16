import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("WEBHOOK_SECRET is not found");
  }

  const headerPayload = headers();
  const svixId = (await headerPayload).get("svix-id");
  const svixTimestamp = (await headerPayload).get("svix-timestamp");
  const svixSignature = (await headerPayload).get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("No svix headers found", { status: 400 });
  }

  const payload = await request.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (error) {
    console.log("Error verifying webhooks: ", error);
    return new Response("Error occurred while verifying webhooks", {
      status: 400,
    });
  }

  if (evt.type === "user.created") {
    try {
      const { email_addresses, primary_email_address_id } = evt.data;

      const primaryEmail = email_addresses.find(
        (email) => email.id === primary_email_address_id
      );

      if (!primaryEmail) {
        return new Response("Primary email not found", { status: 400 });
      }

      const newUser = await prisma.user.create({
        data: {
          id: evt.data.id,
          email: primaryEmail.email_address,
          isSubscribed: false,
        },
      });

      if (!newUser) {
        return new Response("User not created", { status: 400 });
      }
    } catch (error) {
      console.log("Error creating user: ", error);
      return new Response("Error occurred while creating user", {
        status: 400,
      });
    }
  }

  return new Response("Webhook received Successfully", { status: 200 });
}
