interface LoadingSkeletonProps {
  type?: "card" | "table" | "chart" | "text" | "metric";
  count?: number;
  height?: string;
}

export function LoadingSkeleton({ 
  type = "card", 
  count = 1,
  height = "auto" 
}: LoadingSkeletonProps) {
  const skeletonStyle = {
    backgroundColor: "var(--p-color-bg-surface-secondary)",
    borderRadius: "var(--p-border-radius-200)",
    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  };

  const renderSkeleton = () => {
    switch (type) {
      case "card":
        return (
          <div style={{ 
            ...skeletonStyle, 
            padding: "1.5rem",
            height: height === "auto" ? "200px" : height,
          }}>
            <div style={{ 
              ...skeletonStyle, 
              width: "60%", 
              height: "24px", 
              marginBottom: "1rem" 
            }} />
            <div style={{ 
              ...skeletonStyle, 
              width: "100%", 
              height: "100px" 
            }} />
          </div>
        );

      case "table":
        return (
          <div style={{ ...skeletonStyle, padding: "1rem" }}>
            {/* Header */}
            <div style={{ 
              display: "flex", 
              gap: "1rem", 
              marginBottom: "1rem",
              paddingBottom: "1rem",
              borderBottom: "1px solid var(--p-color-border-subdued)"
            }}>
              {[1, 2, 3, 4].map((i) => (
                <div 
                  key={i} 
                  style={{ 
                    ...skeletonStyle, 
                    flex: 1, 
                    height: "20px" 
                  }} 
                />
              ))}
            </div>
            {/* Rows */}
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <div 
                key={rowIndex} 
                style={{ 
                  display: "flex", 
                  gap: "1rem", 
                  marginBottom: "0.75rem" 
                }}
              >
                {[1, 2, 3, 4].map((i) => (
                  <div 
                    key={i} 
                    style={{ 
                      ...skeletonStyle, 
                      flex: 1, 
                      height: "16px" 
                    }} 
                  />
                ))}
              </div>
            ))}
          </div>
        );

      case "chart":
        return (
          <div style={{ 
            ...skeletonStyle, 
            padding: "1.5rem",
            height: height === "auto" ? "300px" : height,
          }}>
            <div style={{ 
              ...skeletonStyle, 
              width: "40%", 
              height: "20px", 
              marginBottom: "1.5rem" 
            }} />
            <div style={{ 
              display: "flex", 
              alignItems: "flex-end", 
              gap: "0.5rem", 
              height: "200px" 
            }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div 
                  key={i} 
                  style={{ 
                    ...skeletonStyle, 
                    flex: 1,
                    height: `${Math.random() * 80 + 20}%` 
                  }} 
                />
              ))}
            </div>
          </div>
        );

      case "metric":
        return (
          <div style={{ 
            ...skeletonStyle, 
            padding: "1.5rem",
            height: height === "auto" ? "120px" : height,
          }}>
            <div style={{ 
              ...skeletonStyle, 
              width: "50%", 
              height: "16px", 
              marginBottom: "1rem" 
            }} />
            <div style={{ 
              ...skeletonStyle, 
              width: "80%", 
              height: "32px", 
              marginBottom: "0.5rem" 
            }} />
            <div style={{ 
              ...skeletonStyle, 
              width: "40%", 
              height: "14px" 
            }} />
          </div>
        );

      case "text":
      default:
        return (
          <div style={{ ...skeletonStyle, height: height === "auto" ? "20px" : height }} />
        );
    }
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} style={{ marginBottom: count > 1 ? "1rem" : 0 }}>
          {renderSkeleton()}
        </div>
      ))}
    </>
  );
}

// Specific loading components for common patterns
export function MetricsGridSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div style={{ 
      display: "grid", 
      gridTemplateColumns: `repeat(${columns}, 1fr)`, 
      gap: "1rem",
      marginBottom: "2rem"
    }}>
      {Array.from({ length: columns }).map((_, i) => (
        <LoadingSkeleton key={i} type="metric" />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div style={{ padding: "2rem" }}>
      <LoadingSkeleton type="text" height="32px" />
      <div style={{ marginTop: "2rem" }}>
        <MetricsGridSkeleton columns={4} />
      </div>
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "2fr 1fr", 
        gap: "1rem",
        marginTop: "2rem"
      }}>
        <LoadingSkeleton type="chart" />
        <LoadingSkeleton type="card" />
      </div>
      <div style={{ marginTop: "2rem" }}>
        <LoadingSkeleton type="table" />
      </div>
    </div>
  );
}
