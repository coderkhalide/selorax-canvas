/**
 * Standalone utility functions for the landing page renderer.
 * These functions are self-contained and don't depend on external imports,
 * making the renderer portable to other Next.js projects.
 */

const S3_PUBLIC_URL =
  (typeof process !== "undefined" &&
    process.env?.NEXT_PUBLIC_S3_PUBLIC_URL) ||
  "https://assets.selorax.io";

/**
 * Get the proper URL for an image, handling S3 URLs and placeholders.
 */
export const imageGetUrl = (img) => {
  if (!img) return "/placeholder.svg";

  // Check for dynamic placeholders
  if (img.includes("{{") || img.includes("}}")) {
    return img;
  }

  try {
    const u = new URL(img);
    const host = u.host;
    const path = decodeURIComponent(u.pathname.replace(/^\/+/, ""));

    // If S3_PUBLIC_URL is invalid, this might throw, caught below
    const s3Host = new URL(S3_PUBLIC_URL).host;

    if (host === s3Host) return img;
    if (host.endsWith("cloudflarestorage.com") || host.endsWith("r2.dev")) {
      return `${S3_PUBLIC_URL}/${path}`;
    }
    return img;
  } catch {
    // Fallback: try to construct URL if it's a relative path or similar
    return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${img}` : img;
  }
};

/**
 * Replace product placeholders like {{ product.title }} with actual values.
 */
export const replaceProductPlaceholders = (content, product) => {
  if (!content || typeof content !== "string") return content;
  if (!product) return content;

  return content.replace(
    /\{\{\s*product\.([a-zA-Z0-9_.[\]]+)\s*\}\}/g,
    (match, path) => {
      // Helper to get nested value (e.g. images[0] or variants.price)
      const getValue = (obj, p) => {
        if (!obj) return match;
        const parts = p.split(".");
        let current = obj;
        for (const part of parts) {
          // Handle array notation like images[0]
          const arrayMatch = part.match(/^([a-zA-Z_]+)\[(\d+)\]$/);
          if (arrayMatch) {
            const [, key, idx] = arrayMatch;
            current = current?.[key]?.[parseInt(idx, 10)];
          } else {
            current = current?.[part];
          }
          if (current === undefined || current === null) return match;
        }
        return current;
      };

      const value = getValue(product, path);
      return value !== match && value !== undefined && value !== null
        ? String(value)
        : match;
    }
  );
};