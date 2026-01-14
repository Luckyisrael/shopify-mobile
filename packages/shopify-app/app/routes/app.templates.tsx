import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Add to Prisma schema later
const TEMPLATE_CATEGORIES = {
  CART_RECOVERY: "Cart Recovery",
  PROMOTIONAL: "Promotional", 
  TRANSACTIONAL: "Transactional",
  SEASONAL: "Seasonal"
};

const DEFAULT_TEMPLATES = [
  {
    name: "Cart Recovery - Gentle Reminder",
    category: "CART_RECOVERY",
    title: "Don't forget your items!",
    body: "Hi {{firstName}}, you left {{itemCount}} items in your cart. Complete your purchase now!",
    variables: ["firstName", "itemCount"]
  },
  {
    name: "Flash Sale Alert",
    category: "PROMOTIONAL", 
    title: "⚡ Flash Sale - 24 Hours Only!",
    body: "Get {{discount}}% off everything! Use code {{promoCode}}. Sale ends midnight!",
    variables: ["discount", "promoCode"]
  },
  {
    name: "New Collection Launch",
    category: "PROMOTIONAL",
    title: "🆕 New {{collectionName}} Collection",
    body: "Discover our latest {{collectionName}} collection. Shop now and be the first to get these exclusive items!",
    variables: ["collectionName"]
  },
  {
    name: "Order Shipped",
    category: "TRANSACTIONAL",
    title: "Your order is on the way!",
    body: "Great news {{firstName}}! Your order #{{orderNumber}} has shipped and will arrive in {{deliveryDays}} days.",
    variables: ["firstName", "orderNumber", "deliveryDays"]
  }
];

export const loader = async ({ request }: any) => {
  const { session } = await authenticate.admin(request);
  
  // For now, return default templates
  // In production, these would be stored in database
  return {
    templates: DEFAULT_TEMPLATES,
    categories: TEMPLATE_CATEGORIES
  };
};

export const action = async ({ request }: any) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "preview") {
    const template = formData.get("template");
    const variables = JSON.parse(formData.get("variables") || "{}");
    
    if (!template) {
      return Response.json({ error: "Template is required" });
    }

    const templateData = DEFAULT_TEMPLATES.find(t => t.name === template);
    if (!templateData) {
      return Response.json({ error: "Template not found" });
    }

    // Replace variables in template
    let title = templateData.title;
    let body = templateData.body;
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      title = title.replace(new RegExp(placeholder, 'g'), String(value));
      body = body.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return Response.json({
      success: true,
      preview: { title, body },
      originalTemplate: templateData
    });
  }

  return Response.json({ error: "Invalid intent" });
};

export default function TemplatesPage() {
  const { templates, categories } = useLoaderData<typeof loader>();
  const actionData = useActionData() as any;
  const nav = useNavigation();

  const isLoading = nav.state === "submitting";

  return (
    <s-page heading="Push Notification Templates">
      <s-stack direction="block" gap="base">
        
        <s-section heading="Template Library">
          <s-text>
            Use pre-built templates to create engaging push notifications quickly.
          </s-text>
        </s-section>

        {/* Template Preview */}
        <s-section heading="Template Preview">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
            <Form method="post">
              <input type="hidden" name="intent" value="preview" />
              <s-stack direction="block" gap="base">
                
                <s-stack direction="inline" gap="base">
                  <div style={{ flex: 1 }}>
                    <label>
                      <s-text type="strong">Select Template</s-text>
                      <select name="template" style={{ width: '100%', padding: '8px', marginTop: '4px' }}>
                        <option value="">Choose a template...</option>
                        {templates.map(template => (
                          <option key={template.name} value={template.name}>
                            {template.name} ({template.category})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </s-stack>

                <s-text-field
                  label="Variables (JSON)"
                  name="variables"
                  placeholder='{"firstName": "John", "itemCount": "3"}'
                />

                <s-button type="submit" loading={isLoading}>
                  Preview Template
                </s-button>

              </s-stack>
            </Form>
          </s-box>
        </s-section>

        {/* Preview Result */}
        {actionData?.success && (
          <s-section heading="Preview Result">
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-stack direction="block" gap="base">
                  <s-text type="strong">Title:</s-text>
                  <s-text>{actionData.preview.title}</s-text>
                </s-stack>
                <s-stack direction="block" gap="base">
                  <s-text type="strong">Body:</s-text>
                  <s-text>{actionData.preview.body}</s-text>
                </s-stack>
                <s-stack direction="block" gap="base">
                  <s-text type="strong">Variables Used:</s-text>
                  <s-text>{actionData.originalTemplate.variables.join(', ')}</s-text>
                </s-stack>
              </s-stack>
            </s-box>
          </s-section>
        )}

        {/* Template List */}
        <s-section heading="Available Templates">
          <s-stack direction="block" gap="base">
            {Object.entries(categories).map(([key, categoryName]) => {
              const categoryTemplates = templates.filter(t => t.category === key);
              if (categoryTemplates.length === 0) return null;
              
              return (
                <div key={key}>
                  <s-text type="strong">{categoryName}</s-text>
                  <div style={{ marginTop: '8px' }}>
                    <s-stack direction="block" gap="base">
                      {categoryTemplates.map(template => (
                        <s-box key={template.name} padding="base" borderWidth="base" borderRadius="base" background="transparent">
                          <s-stack direction="block" gap="base">
                            <s-text type="strong">{template.name}</s-text>
                            <s-text>Title: {template.title}</s-text>
                            <s-text>Body: {template.body}</s-text>
                            <s-text>
                              Variables: {template.variables.join(', ')}
                            </s-text>
                          </s-stack>
                        </s-box>
                      ))}
                    </s-stack>
                  </div>
                </div>
              );
            })}
          </s-stack>
        </s-section>

      </s-stack>
    </s-page>
  );
}