'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { createClient } from '@/lib/supabase/client';
import { VIEWER_QUERY_KEY } from '@/lib/use-viewer';

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
      dehydrateOptions: {
        // The viewer's saved clubs and tournaments must not outlive the session
        // in localStorage — on a shared device the next person would inherit
        // them. Public tournament data is still persisted.
        shouldDehydrateQuery: (query) => query.queryKey[0] !== VIEWER_QUERY_KEY[0],
      },
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

    // Signing in or out changes who the viewer is, so drop the cached answer
    // and let the next render fetch it again.
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: VIEWER_QUERY_KEY });
    });

    return () => {
      unsubscribe();
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
