"use server";
import { updateTag } from "next/cache";
import { cookies } from "next/headers";

export async function getProducts(storeId: string, accessToken: string) {
  try {
    const response = await fetch(
      `https://api.selorax.io/api/products/all/admin?1=1&store_id=${storeId}&sort=created_at&order=DESC&search=&options=all_time&gm=1`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": accessToken,
        },
      },
    );

    if (!response.ok) {
      console.error(
        "Failed to fetch products:",
        response.status,
        response.statusText,
      );
      return { success: false, error: "Failed to fetch products" };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching products:", error);
    return { success: false, error: "Error fetching products" };
  }
}

export async function getProductTemplate(slug: string, storeId: string) {
  try {
    const apiUrl = process.env.APP_API_URL || "https://api.selorax.io/api";
    const key = process.env.PRODUCTS_VIEW_KEY || "";

    // Construct URL based on user provided snippet logic
    const url = `${apiUrl}/products/${slug}?store_id=${storeId}&key=${key}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store", // Always fetch fresh data
    });

    if (!response.ok) {
      console.error(
        "Failed to fetch product template:",
        response.status,
        response.statusText,
      );
      return { success: false, error: "Failed to fetch product template" };
    }

    const data = await response.json();

    // Extract template logic based on user snippet
    // const TEMPLATE_DATA = res?.product?.landing_template ? res?.product?.landing_template : store?.store?.default_landing_template;
    // We return the product data, and let the client decide on the template usage or return the template directly if found.
    // However, the prompt says "sathe sathe tempaltae data asbe oita sora sora amardder json file import hoia jabe"
    // (template data will come and directly import into our json file)

    return {
      success: true,
      data: data,
      template: data?.product?.landing_template || null,
    };
  } catch (error) {
    console.error("Error fetching product template:", error);
    return { success: false, error: "Error fetching product template" };
  }
}

//update product
export async function updateProductTemplate(
  slug: string,
  accessToken: string,
  landingTemplate: any,
  storeId: string,
  disableLandingTemplate: boolean = false,
) {
  try {
    const apiUrl = process.env.APP_API_URL || "https://api.selorax.io/api";
    const url = `${apiUrl}/products/${slug}/landing-page-template`;

    // Build body based on action - backend checks disable_landing_template first
    // and returns early, so don't send landing_template: null (fails validation)
    const body: Record<string, any> = {};
    if (disableLandingTemplate) {
      body.disable_landing_template = true;
    } else {
      body.landing_template = landingTemplate;
    }

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-auth-token": accessToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "Failed to update product template:",
        response.status,
        response.statusText,
        errorBody,
      );
      return { success: false, error: `Failed to update: ${errorBody}` };
    }

    // Clear cache (skip revalidation to prevent page reload)
    await clearProductCache(accessToken, storeId, slug, true);

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Error updating product template:", error);
    return { success: false, error: "Error updating product template" };
  }
}

// clear cache
export async function clearProductCache(
  accessToken: string,
  storeId: string,
  slug: string,
  skipRevalidation: boolean = false,
) {
  try {
    await fetch(
      `https://api.selorax.io/api/stores/cache/clear/products?store_id=${storeId}&slug=${slug}`,
      {
        method: "GET",
        headers: {
          "x-auth-token": accessToken,
        },
      },
    );
    // Only revalidate if not skipped (revalidation causes page reload)
    if (!skipRevalidation) {
      await updateTag(`product_${slug}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Error clearing product cache:", error);
    return { success: false, error: "Error clearing product cache" };
  }
}

export async function setCookie(name: string, value: string) {
  const cookieStore = await cookies();
  cookieStore.set(name, value);
}
