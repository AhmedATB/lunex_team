import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SubscribeDto } from "./push.dto";

/** The site's global pipe refuses properties a DTO does not declare, so what a real browser sends has to be declared. */
const check = async (body: unknown) =>
  validate(plainToInstance(SubscribeDto, body), { whitelist: true, forbidNonWhitelisted: true });

describe("SubscribeDto", () => {
  const keys = { p256dh: "BNc-key", auth: "auth-secret" };

  it("accepts what a browser's PushSubscription.toJSON() gives, including its expirationTime", async () => {
    expect(await check({ endpoint: "https://fcm.googleapis.com/fcm/send/x", expirationTime: null, keys })).toHaveLength(0);
    expect(await check({ endpoint: "https://fcm.googleapis.com/fcm/send/x", expirationTime: 1790000000000, keys })).toHaveLength(0);
    expect(await check({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys })).toHaveLength(0);
  });

  it("still refuses anything else it does not know, and missing keys", async () => {
    expect(await check({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys, userId: "someone-else" })).not.toHaveLength(0);
    expect(await check({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { p256dh: "k" } })).not.toHaveLength(0);
    expect(await check({ endpoint: "https://fcm.googleapis.com/fcm/send/x" })).not.toHaveLength(0);
  });
});
