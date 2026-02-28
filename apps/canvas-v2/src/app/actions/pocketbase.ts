"use server";

const POCKETBASE_URL = process.env.POCKETBASE_URL || "https://pocketbase.selorax.io";
const POCKETBASE_TOKEN = process.env.POCKETBASE_TOKEN || "";

/**
 * Save landing page JSON data to PocketBase
 * @param jsonData - The landing page JSON data to save
 * @returns Result object with success status and record ID or error
 */
export async function saveLandingPageToPocketBase(jsonData: any) {
  try {
    const response = await fetch(`${POCKETBASE_URL}/api/collections/Landing_page/records`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": POCKETBASE_TOKEN,
      },
      cache: "no-store",
      body: JSON.stringify({
        name: jsonData.name || "Untitled",
        data: JSON.stringify(jsonData),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("PocketBase error:", response.status, errorData);
      return {
        success: false,
        error: errorData.message || `Failed to save: ${response.status}`,
      };
    }

    const record = await response.json();

    return {
      success: true,
      recordId: record.id,
      message: "Landing page saved to PocketBase successfully!",
    };
  } catch (error) {
    console.error("Error saving to PocketBase:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save to PocketBase",
    };
  }
}

/**
 * Update an existing landing page in PocketBase
 * @param recordId - The ID of the record to update
 * @param jsonData - The updated landing page JSON data
 * @param apiKey - Optional API key to use instead of env variable
 * @returns Result object with success status or error
 */
export async function updateLandingPageInPocketBase(recordId: string, jsonData: any, apiKey?: string) {
  try {
    const authToken = apiKey || POCKETBASE_TOKEN;

    if (!authToken) {
      return {
        success: false,
        error: "API Key is required for this operation",
      };
    }

    const response = await fetch(`${POCKETBASE_URL}/api/collections/Landing_page/records/${recordId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authToken,
      },
      cache: "no-store",
      body: JSON.stringify({
        name: jsonData.name || "Untitled",
        data: JSON.stringify(jsonData),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("PocketBase error:", response.status, errorData);
      return {
        success: false,
        error: errorData.message || `Failed to update: ${response.status}`,
      };
    }

    const record = await response.json();

    return {
      success: true,
      recordId: record.id,
      message: "Landing page updated successfully!",
    };
  } catch (error) {
    console.error("Error updating in PocketBase:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update in PocketBase",
    };
  }
}

/**
 * Delete a landing page from PocketBase
 * @param recordId - The ID of the record to delete
 * @param apiKey - Optional API key to use instead of env variable
 * @returns Result object with success status or error
 */
export async function deleteLandingPageFromPocketBase(recordId: string, apiKey?: string) {
  try {
    const authToken = apiKey || POCKETBASE_TOKEN;

    if (!authToken) {
      return {
        success: false,
        error: "API Key is required for this operation",
      };
    }

    const response = await fetch(`${POCKETBASE_URL}/api/collections/Landing_page/records/${recordId}`, {
      method: "DELETE",
      headers: {
        "Authorization": authToken,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("PocketBase error:", response.status, errorData);
      return {
        success: false,
        error: errorData.message || `Failed to delete: ${response.status}`,
      };
    }

    return {
      success: true,
      message: "Landing page deleted successfully!",
    };
  } catch (error) {
    console.error("Error deleting from PocketBase:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete from PocketBase",
    };
  }
}

/**
 * Get a landing page from PocketBase by record ID
 * @param recordId - The ID of the record to fetch
 * @returns Result object with landing page data or error
 */
export async function getLandingPageFromPocketBase(recordId: string) {
  try {
    const response = await fetch(`${POCKETBASE_URL}/api/collections/Landing_page/records/${recordId}`, {
      method: "GET",
      headers: {
        "Authorization": POCKETBASE_TOKEN,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("PocketBase error:", response.status, errorData);
      return {
        success: false,
        error: errorData.message || `Failed to fetch: ${response.status}`,
      };
    }

    const record = await response.json();

    // Handle data that might be a string or already an object
    let parsedData = record.data;
    if (typeof record.data === "string") {
      try {
        parsedData = JSON.parse(record.data);
      } catch {
        parsedData = record.data;
      }
    }

    return {
      success: true,
      data: parsedData,
      recordId: record.id,
    };
  } catch (error) {
    console.error("Error fetching from PocketBase:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch from PocketBase",
    };
  }
}

/**
 * List all landing pages from PocketBase
 * @param page - Page number (default: 1)
 * @param perPage - Items per page (default: 50)
 * @returns Result object with list of landing pages or error
 */
export async function listLandingPagesFromPocketBase(page: number = 1, perPage: number = 50) {
  console.log('[PocketBase] listLandingPagesFromPocketBase called', { page, perPage });
  console.log('[PocketBase] URL:', POCKETBASE_URL);
  console.log('[PocketBase] Token exists:', !!POCKETBASE_TOKEN);

  try {
    const url = `${POCKETBASE_URL}/api/collections/Landing_page/records?page=${page}&perPage=${perPage}&sort=-created`;
    console.log('[PocketBase] Fetching:', url);

    // PocketBase accepts the token directly or with Bearer prefix
    const authHeader = POCKETBASE_TOKEN.startsWith('Bearer ')
      ? POCKETBASE_TOKEN
      : POCKETBASE_TOKEN;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
      },
      cache: 'no-store', // Disable caching for server actions
    });

    console.log('[PocketBase] Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[PocketBase] Error:", response.status, errorData);
      return {
        success: false,
        error: errorData.message || `Failed to fetch: ${response.status}`,
        items: [],
        totalItems: 0,
        totalPages: 0,
      };
    }

    const result = await response.json();
    console.log('[PocketBase] Raw result:', JSON.stringify(result).slice(0, 500));
    console.log('[PocketBase] Total items:', result.totalItems);

    // Parse data field for each item
    const items = (result.items || []).map((item: any) => {
      let parsedData = null;
      try {
        // Handle both string and object data formats
        if (typeof item.data === 'string') {
          parsedData = item.data ? JSON.parse(item.data) : null;
        } else if (typeof item.data === 'object') {
          parsedData = item.data;
        }
        console.log(`[PocketBase] Parsed item "${item.name}":`, {
          id: item.id,
          dataType: typeof item.data,
          hasData: !!parsedData,
          elementsCount: parsedData?.elements?.length || 0,
          firstElementName: parsedData?.elements?.[0]?.name,
          firstElementType: parsedData?.elements?.[0]?.type
        });
      } catch (e) {
        console.error(`[PocketBase] Failed to parse data for item ${item.id}:`, e);
        console.error(`[PocketBase] Raw data:`, typeof item.data, item.data?.slice?.(0, 200));
        parsedData = null;
      }
      return {
        id: item.id,
        name: item.name || parsedData?.name || "Untitled",
        created: item.created,
        updated: item.updated,
        data: parsedData,
      };
    });

    console.log('[PocketBase] Processed items:', items.length);

    return {
      success: true,
      items,
      totalItems: result.totalItems || 0,
      totalPages: result.totalPages || 0,
      page: result.page || 1,
    };
  } catch (error) {
    console.error("[PocketBase] Error listing from PocketBase:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list from PocketBase",
      items: [],
      totalItems: 0,
      totalPages: 0,
    };
  }
}
