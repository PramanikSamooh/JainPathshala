import "server-only";
import * as crypto from "crypto";

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
}

/**
 * Send a Web Push notification using the Web Push Protocol.
 * Uses VAPID authentication — no external dependencies needed.
 *
 * Required env vars:
 *   VAPID_PUBLIC_KEY  — Base64url-encoded public key
 *   VAPID_PRIVATE_KEY — Base64url-encoded private key
 *   NEXT_PUBLIC_APP_URL — App URL for VAPID subject
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<void> {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error("VAPID keys not configured");
  }

  const body = JSON.stringify(payload);
  const endpoint = new URL(subscription.endpoint);

  // Create VAPID JWT
  const header = base64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const now = Math.floor(Date.now() / 1000);
  const claims = base64url(
    JSON.stringify({
      aud: `${endpoint.protocol}//${endpoint.host}`,
      exp: now + 43200, // 12 hours
      sub: `mailto:admin@${new URL(appUrl).host}`,
    })
  );

  const unsignedToken = `${header}.${claims}`;
  const key = crypto.createPrivateKey({
    key: Buffer.concat([
      Buffer.from("3077020101042020", "hex"),
      base64urlDecode(vapidPrivateKey),
      Buffer.from("a00a06082a8648ce3d030107a14403420004", "hex"),
      base64urlDecode(vapidPublicKey),
    ]),
    format: "der",
    type: "sec1",
  });

  const sign = crypto.createSign("SHA256");
  sign.update(unsignedToken);
  const signature = sign.sign({ key, dsaEncoding: "ieee-p1363" });
  const token = `${unsignedToken}.${base64url(signature)}`;

  // Encrypt payload using subscription keys
  const userPublicKey = base64urlDecode(subscription.keys.p256dh);
  const userAuth = base64urlDecode(subscription.keys.auth);

  const salt = crypto.randomBytes(16);
  const localKeys = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const localPublicKey = (localKeys.publicKey as crypto.KeyObject)
    .export({ type: "spki", format: "der" })
    .subarray(27); // Extract raw public key bytes

  const sharedSecret = crypto.diffieHellman({
    publicKey: crypto.createPublicKey({
      key: Buffer.concat([Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex"), userPublicKey]),
      format: "der",
      type: "spki",
    }),
    privateKey: localKeys.privateKey as crypto.KeyObject,
  });

  // HKDF-based key derivation (RFC 8291)
  const authInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    userPublicKey,
    localPublicKey,
  ]);
  const prk = hkdf(userAuth, sharedSecret, authInfo, 32);
  const contentKey = hkdf(salt, prk, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, prk, Buffer.from("Content-Encoding: nonce\0"), 12);

  // Encrypt with AES-128-GCM
  const cipher = crypto.createCipheriv("aes-128-gcm", contentKey, nonce);
  const paddedPayload = Buffer.concat([Buffer.from(body), Buffer.from([2])]);
  const encrypted = Buffer.concat([cipher.update(paddedPayload), cipher.final(), cipher.getAuthTag()]);

  // Build the final encrypted body with header
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(encrypted.length + 17 + 1, 0); // overhead

  const encryptedBody = Buffer.concat([
    salt,
    recordSize,
    Buffer.from([localPublicKey.length]),
    localPublicKey,
    encrypted,
  ]);

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${token}, k=${vapidPublicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
    },
    body: encryptedBody,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push failed (${response.status}): ${text}`);
  }
}

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

function base64urlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number): Buffer {
  const prk = crypto.createHmac("sha256", salt).update(ikm).digest();
  const infoHmac = crypto.createHmac("sha256", prk).update(Buffer.concat([info, Buffer.from([1])])).digest();
  return infoHmac.subarray(0, length);
}
