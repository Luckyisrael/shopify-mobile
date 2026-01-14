/**
 * RequestDeduplicator prevents duplicate concurrent requests
 * Returns the same promise for identical requests
 */
export class RequestDeduplicator {
  private pendingRequests: Map<string, Promise<any>> = new Map();

  /**
   * Deduplicate a request by key
   * If a request with the same key is already pending, return that promise
   * Otherwise, execute the request and track it
   */
  async deduplicate<T>(key: string, request: () => Promise<T>): Promise<T> {
    // Check if request is already pending
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    // Execute request and track it
    const promise = request()
      .then((result) => {
        // Clean up after completion
        this.pendingRequests.delete(key);
        return result;
      })
      .catch((error) => {
        // Clean up after error
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Generate a cache key from request parameters
   */
  static generateKey(
    method: string,
    url: string,
    params?: Record<string, any>
  ): string {
    const paramsStr = params ? JSON.stringify(params) : '';
    return `${method}:${url}:${paramsStr}`;
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
  }

  /**
   * Get number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}
