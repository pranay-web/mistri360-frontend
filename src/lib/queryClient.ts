import { QueryClient } from '@tanstack/react-query';

// Single shared QueryClient instance — exported so auth mutations can
// invalidate / remove the 'me' cache directly after login/logout.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});
