import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorResponse } from '../models/api.models';

export const extractApiErrorMessage = (
  error: unknown,
  fallback = 'An unexpected error occurred.'
): string => {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.trim().length > 0) {
      return error.error;
    }

    const body = error.error as Partial<ApiErrorResponse>;

    if (body?.error?.message) {
      const details = body.error.details as
        | Array<{ msg?: string; message?: string }>
        | undefined;

      if (Array.isArray(details) && details.length > 0) {
        const detailMessage = details[0]?.message ?? details[0]?.msg;

        if (detailMessage) {
          return detailMessage;
        }
      }

      return body.error.message;
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};
