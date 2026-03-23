import { useState, useCallback, useEffect, useRef } from 'react';

interface UseApiWithRetryOptions {
    maxRetries?: number;
    retryDelay?: number;
    onError?: (error: Error) => void;
}

interface UseApiWithRetryResult<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * Custom hook for API calls with automatic retry logic
 * 
 * @param fetcher - Async function that fetches data
 * @param options - Configuration options
 * @returns Object with data, loading, error states and refetch function
 */
export function useApiWithRetry<T>(
    fetcher: () => Promise<T>,
    options: UseApiWithRetryOptions = {}
): UseApiWithRetryResult<T> {
    const {
        maxRetries = 3,
        retryDelay = 1000,
        onError
    } = options;

    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const retriesRef = useRef(0);

    const fetchWithRetry = useCallback(async () => {
        // Reset state
        setLoading(true);
        setError(null);
        retriesRef.current = 0;

        // Create new abort controller
        abortControllerRef.current = new AbortController();

        const attemptFetch = async (attempt: number): Promise<void> => {
            try {
                const result = await fetcher();

                // Check if aborted
                if (abortControllerRef.current?.signal.aborted) {
                    return;
                }

                setData(result);
                setLoading(false);
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Unknown error');

                // Check if aborted
                if (abortControllerRef.current?.signal.aborted) {
                    return;
                }

                // Retry logic
                if (attempt < maxRetries) {
                    retriesRef.current = attempt + 1;
                    console.log(`Retry attempt ${retriesRef.current}/${maxRetries}`);

                    // Exponential backoff
                    const delay = retryDelay * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));

                    return attemptFetch(attempt + 1);
                }

                // Max retries reached
                setError(error);
                setLoading(false);
                onError?.(error);
            }
        };

        await attemptFetch(0);
    }, [fetcher, maxRetries, retryDelay, onError]);

    useEffect(() => {
        fetchWithRetry();

        // Cleanup on unmount
        return () => {
            abortControllerRef.current?.abort();
        };
    }, [fetchWithRetry]);

    return {
        data,
        loading,
        error,
        refetch: fetchWithRetry
    };
}
