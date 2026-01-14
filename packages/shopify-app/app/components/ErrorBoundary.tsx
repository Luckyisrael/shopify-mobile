import { useRouteError, isRouteErrorResponse, Link } from "react-router";

interface ErrorDisplayProps {
  title: string;
  message: string;
  statusCode?: number;
  showRetry?: boolean;
  showHome?: boolean;
}

function ErrorDisplay({ 
  title, 
  message, 
  statusCode, 
  showRetry = true,
  showHome = true 
}: ErrorDisplayProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "400px",
      padding: "2rem",
      textAlign: "center"
    }}>
      <div style={{
        fontSize: "4rem",
        fontWeight: "bold",
        color: "var(--p-color-text-critical)",
        marginBottom: "1rem"
      }}>
        {statusCode || "⚠️"}
      </div>
      
      <h1 style={{
        fontSize: "1.5rem",
        fontWeight: "600",
        color: "var(--p-color-text)",
        marginBottom: "0.5rem"
      }}>
        {title}
      </h1>
      
      <p style={{
        fontSize: "1rem",
        color: "var(--p-color-text-subdued)",
        marginBottom: "2rem",
        maxWidth: "500px"
      }}>
        {message}
      </p>
      
      <div style={{ display: "flex", gap: "1rem" }}>
        {showRetry && (
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "var(--p-color-bg-fill-brand)",
              color: "var(--p-color-text-on-color)",
              border: "none",
              borderRadius: "var(--p-border-radius-200)",
              fontSize: "1rem",
              fontWeight: "500",
              cursor: "pointer"
            }}
          >
            Try Again
          </button>
        )}
        
        {showHome && (
          <Link
            to="/app"
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "var(--p-color-bg-surface-secondary)",
              color: "var(--p-color-text)",
              border: "1px solid var(--p-color-border)",
              borderRadius: "var(--p-border-radius-200)",
              fontSize: "1rem",
              fontWeight: "500",
              textDecoration: "none",
              display: "inline-block"
            }}
          >
            Go to Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}

export function GeneralErrorBoundary() {
  const error = useRouteError();

  // Handle React Router errors
  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 404:
        return (
          <ErrorDisplay
            title="Page Not Found"
            message="The page you're looking for doesn't exist or has been moved."
            statusCode={404}
            showRetry={false}
          />
        );
      
      case 401:
        return (
          <ErrorDisplay
            title="Unauthorized"
            message="You don't have permission to access this page. Please log in and try again."
            statusCode={401}
            showRetry={false}
          />
        );
      
      case 403:
        return (
          <ErrorDisplay
            title="Forbidden"
            message="You don't have permission to access this resource."
            statusCode={403}
            showRetry={false}
          />
        );
      
      case 500:
        return (
          <ErrorDisplay
            title="Server Error"
            message="Something went wrong on our end. We're working to fix it. Please try again later."
            statusCode={500}
          />
        );
      
      default:
        return (
          <ErrorDisplay
            title={`Error ${error.status}`}
            message={error.statusText || "An unexpected error occurred."}
            statusCode={error.status}
          />
        );
    }
  }

  // Handle JavaScript errors
  if (error instanceof Error) {
    // Don't show stack traces in production
    const isDev = process.env.NODE_ENV === "development";
    
    return (
      <div style={{ padding: "2rem" }}>
        <ErrorDisplay
          title="Something Went Wrong"
          message={isDev ? error.message : "An unexpected error occurred. Please try again."}
        />
        
        {isDev && error.stack && (
          <details style={{
            marginTop: "2rem",
            padding: "1rem",
            backgroundColor: "var(--p-color-bg-surface-secondary)",
            borderRadius: "var(--p-border-radius-200)",
            maxWidth: "800px",
            margin: "2rem auto"
          }}>
            <summary style={{ 
              cursor: "pointer", 
              fontWeight: "600",
              marginBottom: "1rem"
            }}>
              Error Details (Development Only)
            </summary>
            <pre style={{
              fontSize: "0.875rem",
              overflow: "auto",
              padding: "1rem",
              backgroundColor: "var(--p-color-bg-surface)",
              borderRadius: "var(--p-border-radius-100)"
            }}>
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    );
  }

  // Fallback for unknown errors
  return (
    <ErrorDisplay
      title="Unexpected Error"
      message="An unexpected error occurred. Please try again."
    />
  );
}

// Specific error components for common scenarios
export function NotFoundError() {
  return (
    <ErrorDisplay
      title="Page Not Found"
      message="The page you're looking for doesn't exist or has been moved."
      statusCode={404}
      showRetry={false}
    />
  );
}

export function UnauthorizedError() {
  return (
    <ErrorDisplay
      title="Unauthorized"
      message="You need to be logged in to access this page."
      statusCode={401}
      showRetry={false}
    />
  );
}

export function ServerError() {
  return (
    <ErrorDisplay
      title="Server Error"
      message="Something went wrong on our end. Please try again later."
      statusCode={500}
    />
  );
}
