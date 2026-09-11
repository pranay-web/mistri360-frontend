/**
 * Hand-written hooks for endpoints added after the initial codegen pass.
 */
import { useQuery, type UseQueryOptions, type QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ── Fleet type summary ────────────────────────────────────────────────────────

export interface FleetTypeBucket {
  total: number;
  available: number;
  inRepair: number;
  outOfService: number;
  restricted: number;
}

export interface FleetTypeSummary {
  trucks: FleetTypeBucket;
  trailers: FleetTypeBucket;
}

export const getFleetTypeSummaryUrl = () => `/api/fleet/type-summary` as const;

export const getGetFleetTypeSummaryQueryKey = () =>
  [getFleetTypeSummaryUrl()] as const;

export const getFleetTypeSummary = (options?: RequestInit): Promise<FleetTypeSummary> =>
  customFetch<FleetTypeSummary>(getFleetTypeSummaryUrl(), options);

export function useGetFleetTypeSummary<TData = FleetTypeSummary>(options?: {
  query?: UseQueryOptions<FleetTypeSummary, unknown, TData>;
}) {
  const { query: queryOptions } = options ?? {};
  const queryKey: QueryKey = queryOptions?.queryKey ?? getGetFleetTypeSummaryQueryKey();
  return useQuery<FleetTypeSummary, unknown, TData>({
    queryKey,
    queryFn: ({ signal }) => getFleetTypeSummary({ signal }),
    ...(queryOptions as any),
  });
}
