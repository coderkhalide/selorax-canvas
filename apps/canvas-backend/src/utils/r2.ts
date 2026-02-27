// Cloudflare R2 upload utility — SigV4 signing + upload
import { createHmac, createHash } from 'crypto';

const endpoint  = () => process.env.S3_ENDPOINT!;
const bucket    = () => process.env.S3_BUCKET!;
const accessKey = () => process.env.S3_ACCESS_KEY!;
const secretKey = () => process.env.S3_SECRET_KEY!;
const publicUrl = () => process.env.S3_PUBLIC_URL!;

export function r2Configured(): boolean {
  return !!(process.env.S3_ENDPOINT && process.env.S3_BUCKET &&
            process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
}

/**
 * Upload a string to R2. Returns the public CDN URL.
 * key example: 'components/my-banner-1.0.0.js'
 */
export async function uploadToR2(key: string, body: string, contentType = 'application/javascript'): Promise<string> {
  const putUrl = `${endpoint()}/${bucket()}/${key}`;
  const signed = await signRequest({ method: 'PUT', url: putUrl, body, contentType,
    accessKey: accessKey(), secretKey: secretKey(), region: 'auto', service: 's3' });

  const res = await fetch(putUrl, { method: 'PUT', headers: signed, body });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`R2 upload failed (${res.status}): ${errBody.slice(0, 200)}`);
  }

  return `${publicUrl()}/${key}`;
}

// ── AWS SigV4 signer ──────────────────────────────────────────────────────────

async function signRequest({
  method, url, body, contentType, accessKey, secretKey, region, service,
}: {
  method: string; url: string; body: string; contentType: string;
  accessKey: string; secretKey: string; region: string; service: string;
}): Promise<Record<string, string>> {
  const parsed    = new URL(url);
  const now       = new Date();
  const amzDate   = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = createHash('sha256').update(body).digest('hex');

  const headers: Record<string, string> = {
    'host':                  parsed.host,
    'x-amz-date':            amzDate,
    'x-amz-content-sha256':  payloadHash,
    'content-type':          contentType,
    'content-length':        Buffer.byteLength(body).toString(),
  };

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}\n`)
    .join('');

  const canonicalRequest = [method, parsed.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), service), 'aws4_request');
  const signature  = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return {
    ...headers,
    'authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}
