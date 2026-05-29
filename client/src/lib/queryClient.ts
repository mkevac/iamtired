import { QueryClient } from "@tanstack/react-query";

// All data lives in IndexedDB (see lib/db.ts). Each useQuery supplies its own
// queryFn, so there is no global network fetcher here anymore.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
