import { SignJWT, jwtVerify } from "jose";

const confirmationLifetime = "7d";

function getSigningKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export function assertOrderConfirmationConfigured() {
  getSigningKey();
}

export async function createOrderConfirmationToken(orderId: string) {
  return new SignJWT({ purpose: "order-confirmation" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(orderId)
    .setIssuedAt()
    .setExpirationTime(confirmationLifetime)
    .sign(getSigningKey());
}

export async function verifyOrderConfirmationToken(token: string, orderId: string) {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: ["HS256"],
    });
    return payload.purpose === "order-confirmation" && payload.sub === orderId;
  } catch {
    return false;
  }
}
