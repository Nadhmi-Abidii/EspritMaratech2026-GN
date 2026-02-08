import { HttpParams } from '@angular/common/http';

export const buildHttpParams = (
  query?: Record<string, string | number | boolean | undefined | null>
): HttpParams => {
  let params = new HttpParams();

  if (!query) {
    return params;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    params = params.set(key, String(value));
  }

  return params;
};