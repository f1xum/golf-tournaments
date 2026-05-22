'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

// Bump when the API response shape changes so old caches are discarded.
const CACHE_BUSTER = 'v1';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: ONE_HOUR,
            gcTime: ONE_DAY,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: 'thepin-query-cache',
      throttleTime: 1000,
    });

    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister,
      maxAge: ONE_DAY,
      buster: CACHE_BUSTER,
    });

    // Warm the cache for /turniere as soon as the app boots.
    queryClient.prefetchQuery({
      queryKey: ['tournaments', 'upcoming'],
      queryFn: async () => {
        const r = await fetch('/api/tournaments/upcoming');
        if (!r.ok) throw new Error('failed');
        return r.json();
      },
      staleTime: ONE_HOUR,
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
