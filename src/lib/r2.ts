import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;

function r2() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET) {
    throw new Error("R2 env vars are not configured");
  }
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return client;
}

export const PUT_TTL_SECONDS = 300;
export const GET_TTL_SECONDS = 3600;

export function presignUpload(key: string, contentType: string) {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: PUT_TTL_SECONDS },
  );
}

export function presignView(key: string) {
  return getSignedUrl(
    r2(),
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
    { expiresIn: GET_TTL_SECONDS },
  );
}

// Keys look like "<user-uuid>/<uuid>.jpg". A user may only touch their own prefix.
const KEY_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;
export function isOwnKey(key: unknown, userId: string): key is string {
  return typeof key === "string" && KEY_RE.test(key) && key.startsWith(`${userId}/`);
}
