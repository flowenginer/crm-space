/**
 * LameJS Loader with CDN fallback to local bundle
 * 
 * This loader ensures lamejs is available even if the CDN is blocked
 * by firewalls, ad-blockers, or has a corrupted cache.
 * 
 * Strategy:
 * 1. Check if lamejs is available globally (loaded via CDN in index.html)
 * 2. If not, dynamically import from the npm package (bundled with the app)
 * 3. Cache the result for subsequent calls
 */

let lamejsInstance: any = null;
let loadingPromise: Promise<any> | null = null;

export async function getLamejs(): Promise<any> {
  // Return cached instance if available
  if (lamejsInstance) {
    return lamejsInstance;
  }
  
  // If already loading, wait for that promise
  if (loadingPromise) {
    return loadingPromise;
  }
  
  loadingPromise = (async () => {
    try {
      // Try CDN version first (loaded via script tag in index.html)
      if ((window as any).lamejs?.Mp3Encoder) {
        console.log('[LameJS] Using CDN version');
        lamejsInstance = (window as any).lamejs;
        return lamejsInstance;
      }
      
      // Fallback to local bundle
      console.log('[LameJS] CDN not available, loading from bundle...');
      const lamejs = await import('lamejs');
      
      // Handle both default and named exports
      lamejsInstance = lamejs.default || lamejs;
      
      // Make it available globally for consistency
      (window as any).lamejs = lamejsInstance;
      
      console.log('[LameJS] Loaded from bundle successfully');
      return lamejsInstance;
    } catch (error) {
      console.error('[LameJS] Failed to load:', error);
      loadingPromise = null; // Allow retry
      throw new Error('Failed to load lamejs library for audio encoding');
    }
  })();
  
  return loadingPromise;
}

/**
 * Check if lamejs is available (without loading)
 */
export function isLamejsLoaded(): boolean {
  return lamejsInstance !== null || (window as any).lamejs?.Mp3Encoder !== undefined;
}
