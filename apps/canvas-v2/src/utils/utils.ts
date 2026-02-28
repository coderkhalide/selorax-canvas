import { clsx, type ClassValue } from "clsx";

import { StaticImageData } from "next/image";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function getImageSrc(
  image: string | StaticImageData | { src: string } | null | undefined,
): string {
  if (!image) return "";
  if (typeof image === "string") return image;
  return (image as { src: string }).src || "";
}

const S3_PUBLIC_URL =
  process.env.NEXT_PUBLIC_S3_PUBLIC_URL || "https://assets.selorax.io";

export const imageGetUrl = (img: string | null | undefined) => {
  if (!img) return "/placeholder.svg";
  
  // Check for dynamic placeholders
  if (img.includes("{{") || img.includes("}}")) {
    return img;
  }

  // If no S3_PUBLIC_URL is configured, return the original image URL
  // if (!S3_PUBLIC_URL) return img; // Removed to enforce default usage

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
    // But if S3_PUBLIC_URL is not set, we shouldn't be here (checked above)
    // However, for safety:
    return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${img}` : img;
  }
};

export const transformUrlForExport = (url: string): string => {
  if (!url || typeof url !== "string") return url;
  // if (!S3_PUBLIC_URL) return url; // Removed to enforce default usage

  try {
    if (!url.startsWith("http")) return url;

    const u = new URL(url);
    const host = u.host;

    if (host.endsWith("cloudflarestorage.com") || host.endsWith("r2.dev")) {
      const path = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
      return `${S3_PUBLIC_URL}/${path}`;
    }
    return url;
  } catch {
    return url;
  }
};

export const processExportData = (data: any, product?: any): any => {
  if (Array.isArray(data)) {
    return data.map((item) => processExportData(item, product));
  } else if (typeof data === "object" && data !== null) {
    const newObj: any = {};
    for (const key in data) {
      const value = data[key];
      if (typeof value === "string") {
        // First resolve product placeholders, then transform URLs
        let processedValue = product
          ? replaceProductPlaceholders(value, product)
          : value;
        // Transform URLs for export (e.g., Cloudflare to S3)
        processedValue = transformUrlForExport(processedValue);
        newObj[key] = processedValue;
      } else {
        newObj[key] = processExportData(value, product);
      }
    }
    return newObj;
  }
  return data;
};

export const replaceProductPlaceholders = (
  content: string,
  product: any,
): string => {
  if (!content || typeof content !== "string") return content;
  if (!product) return content;

  return content.replace(
    /\{\{\s*product\.([a-zA-Z0-9_.[\]]+)\s*\}\}/g,
    (match, path) => {
      // Helper to get nested value (e.g. images[0] or variants.price)
      const getValue = (obj: any, p: string) => {
        return p
          .replace(/\[(\w+)\]/g, ".$1") // convert [0] to .0
          .replace(/^\./, "") // strip leading dot
          .split(".")
          .reduce((acc, part) => acc && acc[part], obj);
      };

      const value = getValue(product, path);

      // 1. Direct match
      if (value !== undefined && value !== null) return String(value);

      // 2. Common Shopify Aliases
      if (path === "title" && product.name) return product.name;
      if (path === "name" && product.title) return product.title;

      if (path === "description" || path === "content") {
        if (product.body_html) return product.body_html;
        if (product.description) return product.description;
      }

      if (path === "featuredImage" || path === "featured_image") {
        if (product.image) return product.image;
        
        // Handle images array or string (comma-separated)
        if (product.images) {
          if (typeof product.images === "string") {
            return product.images.split(",")[0].trim();
          }
          if (Array.isArray(product.images) && product.images.length > 0) {
            return typeof product.images[0] === "string"
              ? product.images[0]
              : product.images[0].src;
          }
        }
        
        if (product.thumbnail) return product.thumbnail;
      }

      if (path === "price") {
        // Handle price formatting if needed, or just return raw
        if (product.price) return String(product.price);
        // Check variants
        if (product.variants && product.variants.length > 0)
          return String(product.variants[0].price);
      }

      return match;
    },
  );
};
