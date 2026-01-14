import { Link, useLocation } from "react-router";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const routeLabels: Record<string, string> = {
  "": "Dashboard",
  "analytics": "Analytics",
  "analytics.enhanced": "Enhanced Analytics",
  "additional": "Send Push",
  "push.rich": "Rich Push",
  "push.ab-test": "A/B Testing",
  "push.history": "Push History",
  "reengagement": "Re-engagement",
  "preferences": "Customer Preferences",
  "highlights": "Product Stories",
  "templates": "Templates",
  "automation": "Automation",
  "customers": "Customers",
  "setup": "Setup",
  "billing": "Billing",
  "settings": "Settings",
  "feature-flags": "Feature Flags",
  "cache": "Cache Management",
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  // Build breadcrumb items
  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = "";

  pathSegments.forEach((segment, index) => {
    if (segment === "app") {
      breadcrumbs.push({ label: "Home", href: "/app" });
    } else {
      currentPath = currentPath ? `${currentPath}.${segment}` : segment;
      const label = routeLabels[currentPath] || segment;
      const isLast = index === pathSegments.length - 1;
      
      breadcrumbs.push({
        label,
        href: isLast ? undefined : `/app/${currentPath.replace(/\./g, "/")}`,
      });
    }
  });

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <div style={{ 
      padding: "1rem 2rem", 
      borderBottom: "1px solid var(--p-color-border-subdued)",
      backgroundColor: "var(--p-color-bg-surface)",
      fontSize: "0.875rem"
    }}>
      {breadcrumbs.map((crumb, index) => (
        <span key={index}>
          {index > 0 && <span style={{ margin: "0 0.5rem", color: "var(--p-color-text-subdued)" }}>/</span>}
          {crumb.href ? (
            <Link 
              to={crumb.href}
              style={{ 
                color: "var(--p-color-text-link)",
                textDecoration: "none"
              }}
            >
              {crumb.label}
            </Link>
          ) : (
            <span style={{ color: "var(--p-color-text)" }}>{crumb.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}
