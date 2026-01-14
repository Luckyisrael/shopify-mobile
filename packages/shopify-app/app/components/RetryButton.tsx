import { useState } from "react";

interface RetryButtonProps {
  onRetry: () => Promise<void> | void;
  label?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export function RetryButton({ 
  onRetry, 
  label = "Retry",
  maxRetries = 3,
  retryDelay = 1000
}: RetryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = async () => {
    if (retryCount >= maxRetries) {
      setError(`Maximum retry attempts (${maxRetries}) reached. Please refresh the page.`);
      return;
    }

    setIsRetrying(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      await onRetry();
      setRetryCount(0); // Reset on success
    } catch (err) {
      setRetryCount(prev => prev + 1);
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <button
        onClick={handleRetry}
        disabled={isRetrying || retryCount >= maxRetries}
        style={{
          padding: "0.75rem 1.5rem",
          backgroundColor: isRetrying || retryCount >= maxRetries 
            ? "var(--p-color-bg-surface-disabled)" 
            : "var(--p-color-bg-fill-brand)",
          color: isRetrying || retryCount >= maxRetries
            ? "var(--p-color-text-disabled)"
            : "var(--p-color-text-on-color)",
          border: "none",
          borderRadius: "var(--p-border-radius-200)",
          fontSize: "1rem",
          fontWeight: "500",
          cursor: isRetrying || retryCount >= maxRetries ? "not-allowed" : "pointer",
          opacity: isRetrying || retryCount >= maxRetries ? 0.6 : 1
        }}
      >
        {isRetrying ? "Retrying..." : label}
        {retryCount > 0 && ` (${retryCount}/${maxRetries})`}
      </button>
      
      {error && (
        <p style={{
          marginTop: "1rem",
          color: "var(--p-color-text-critical)",
          fontSize: "0.875rem"
        }}>
          {error}
        </p>
      )}
    </div>
  );
}

// Hook for automatic retry logic
export function useRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    onError?: (error: Error) => void;
  } = {}
) {
  const { maxRetries = 3, retryDelay = 1000, onError } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const execute = async (): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        setRetryCount(0);
        setIsLoading(false);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setRetryCount(attempt + 1);

        if (attempt === maxRetries) {
          setError(error);
          setIsLoading(false);
          onError?.(error);
          return null;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }

    setIsLoading(false);
    return null;
  };

  return {
    execute,
    isLoading,
    error,
    retryCount,
    reset: () => {
      setError(null);
      setRetryCount(0);
    }
  };
}
