import { QueryClient } from '@tanstack/react-query';

// Centralized QueryClient instance - allows reset on auth changes
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - prevents excessive refetching
      refetchOnWindowFocus: false, // Disable refetch on tab focus
      refetchOnReconnect: false, // Disable refetch on network reconnect
      refetchOnMount: false, // Disable refetch when component mounts if data exists
      retry: 1, // Reduce retry attempts
    },
  },
});

/**
 * Reset all query cache - call on SIGNED_OUT and user change
 * This prevents stale data from previous tenant/user leaking into new session
 */
export function resetQueryCache() {
  console.log('[QueryClient] Resetting all query cache');
  queryClient.clear();
}

/**
 * Invalidate all tenant-specific queries without clearing entire cache
 * Use when you want to refetch but keep optimistic updates
 */
export function invalidateTenantQueries() {
  console.log('[QueryClient] Invalidating tenant-specific queries');
  queryClient.invalidateQueries({ queryKey: ['conversations'] });
  queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
  queryClient.invalidateQueries({ queryKey: ['contacts'] });
  queryClient.invalidateQueries({ queryKey: ['contacts-paginated'] });
  queryClient.invalidateQueries({ queryKey: ['messages'] });
  queryClient.invalidateQueries({ queryKey: ['messages-paginated'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['team'] });
  queryClient.invalidateQueries({ queryKey: ['header-notifications'] });
  queryClient.invalidateQueries({ queryKey: ['departments'] });
  queryClient.invalidateQueries({ queryKey: ['tags'] });
  queryClient.invalidateQueries({ queryKey: ['templates'] });
  queryClient.invalidateQueries({ queryKey: ['deals'] });
  queryClient.invalidateQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['quotes'] });
  queryClient.invalidateQueries({ queryKey: ['products'] });
}
