export const imageGetUrl = (url: string | undefined | null) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  // Assuming relative paths should be prefixed or handled.
  // For now, let's just return the url if it's not empty.
  // If you have a specific CDN or base URL, prepend it here.
  return url;
};
