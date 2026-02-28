"use server";

export async function verifyDeveloperKey(key: string): Promise<boolean> {
  // Check against the environment variable
  const validKey = process.env.DEV_API_KEY;

  if (!validKey) {
    console.warn("DEV_API_KEY is not set in the environment variables.");
    return false;
  }

  return key === validKey;
}
