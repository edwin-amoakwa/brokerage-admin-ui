/** The backend envelope (com.stately.common.api.ApiResponse). */
export interface ApiResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data: any;
  meta?: any;
  pager?: Pager;
  errors?: { message: string }[];
}

export interface Pager {
  pageNo: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
}

/** Builds pageNo/pageSize query params from a PrimeNG lazy table event. */
export function pageParams(event: any, defaultSize = 20): { pageNo: number; pageSize: number } {
  const rows = event?.rows || defaultSize;
  const first = event?.first || 0;
  return { pageNo: Math.floor(first / rows) + 1, pageSize: rows };
}
