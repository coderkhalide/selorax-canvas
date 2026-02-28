export async function getStoreData(domain) {
  try {
    // Skip processing for static files and service workers
    if (!domain || domain.includes('.') && (
      domain.endsWith('.js') || 
      domain.endsWith('.css') || 
      domain.endsWith('.ico') ||
      domain.endsWith('.png') ||
      domain.endsWith('.jpg') ||
      domain.endsWith('.svg')
    )) {
      console.log('Skipping store data fetch for static file:', domain);
      return null;
    }
    
    // Fetch store data directly with no caching (real-time)
    const response = await fetch(
      `${process.env.APP_API_URL}/domains/domains/data/${domain}?key=${process.env.DOMAIN_VIEW_KEY}`,
      {
        cache: "no-store",
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Error getting store data:', error);
    return null;
  }
}
