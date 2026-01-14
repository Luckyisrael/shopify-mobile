import type { LoaderFunctionArgs } from "react-router";
import { swaggerSpec } from "../swagger.config";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  
  // Return JSON spec for API consumers
  if (url.searchParams.get('format') === 'json') {
    return Response.json(swaggerSpec);
  }
  
  // Return HTML page with Swagger UI (standalone, not in Shopify admin)
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shopify Mobile Connector API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    #swagger-ui {
      max-width: 1460px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const spec = ${JSON.stringify(swaggerSpec)};
      
      window.ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        docExpansion: "list",
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        tryItOutEnabled: true,
        requestInterceptor: (request) => {
          // Add default X-Shop-Domain header for testing
          if (!request.headers['X-Shop-Domain']) {
            request.headers['X-Shop-Domain'] = 'your-shop.myshopify.com';
          }
          return request;
        }
      });
    };
  </script>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
};