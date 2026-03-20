export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export const ERROR_CODES = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_PARAMS: 'INVALID_PARAMS',
  OPERATION_FAILED: 'OPERATION_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  FILE_OPEN_ERROR: 'FILE_OPEN_ERROR',
  INDEXING_ERROR: 'INDEXING_ERROR',
  PIPELINE_ERROR: 'PIPELINE_ERROR',
  SEARCH_ERROR: 'SEARCH_ERROR',
  EXPORT_ERROR: 'EXPORT_ERROR',
  PLUGIN_ERROR: 'PLUGIN_ERROR',
  UNKNOWN: 'UNKNOWN',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as ApiError).code === 'string' &&
    typeof (error as ApiError).message === 'string'
  );
}

export function handleApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: error.message,
      details: error.stack,
    };
  }
  
  if (typeof error === 'string') {
    return {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: error,
    };
  }
  
  return {
    code: ERROR_CODES.UNKNOWN,
    message: 'An unexpected error occurred',
    details: error,
  };
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return true;
  }
  if (isApiError(error) && error.code === ERROR_CODES.NETWORK_ERROR) {
    return true;
  }
  return false;
}

export function getUserFriendlyMessage(error: ApiError): string {
  switch (error.code) {
    case ERROR_CODES.FILE_NOT_FOUND:
      return 'The file could not be found. It may have been moved or deleted.';
    case ERROR_CODES.INVALID_PARAMS:
      return 'Invalid request. Please check your input and try again.';
    case ERROR_CODES.OPERATION_FAILED:
      return 'The operation failed. Please try again.';
    case ERROR_CODES.PERMISSION_DENIED:
      return 'You do not have permission to perform this action.';
    case ERROR_CODES.FILE_OPEN_ERROR:
      return 'Could not open the file. Please check if it exists and you have access.';
    case ERROR_CODES.INDEXING_ERROR:
      return 'Failed to process the file. It may be corrupted or too large.';
    case ERROR_CODES.NETWORK_ERROR:
      return 'Network error. Please check your connection and try again.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
}

export function logError(context: string, error: unknown): void {
  const apiError = handleApiError(error);
  console.error(`[${context}] ${apiError.code}: ${apiError.message}`, apiError.details || '');
}