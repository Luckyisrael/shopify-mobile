import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Shopify Mobile Connector API',
      version: '1.0.0',
      description: `
        Complete API documentation for the Shopify Mobile Connector platform.
        
        ## Authentication
        All mobile API endpoints require the \`X-Shop-Domain\` header with your Shopify store domain.
        
        ## Features
        - **Customer Authentication**: Login, signup, logout with Shopify Storefront API
        - **Product Management**: Browse products and collections
        - **Cart Operations**: Create and manage shopping carts
        - **Push Notifications**: Device registration and event tracking
        - **Product Highlights**: Story-like product promotions (48-hour expiry)
        - **Event Tracking**: Customer behavior analytics
        
        ## Rate Limiting
        API endpoints are rate-limited to prevent abuse:
        - Mobile endpoints: 100 requests per 15 minutes per shop
        - Admin endpoints: 50 requests per 15 minutes per shop
        
        ## Error Handling
        All endpoints return consistent error responses with appropriate HTTP status codes.
      `,
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://your-app-domain.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        ShopDomain: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Shop-Domain',
          description: 'Your Shopify store domain (e.g., mystore.myshopify.com)'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            code: {
              type: 'string',
              description: 'Error code (optional)'
            }
          },
          required: ['error']
        },
        Customer: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Shopify customer ID'
            },
            firstName: {
              type: 'string',
              nullable: true
            },
            lastName: {
              type: 'string',
              nullable: true
            },
            email: {
              type: 'string',
              format: 'email'
            },
            phone: {
              type: 'string',
              nullable: true
            }
          }
        },
        CustomerSession: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            customer: {
              $ref: '#/components/schemas/Customer'
            },
            accessToken: {
              type: 'string',
              description: 'Customer access token for Shopify Storefront API'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              description: 'Token expiration timestamp'
            }
          }
        },
        Product: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Shopify product ID'
            },
            title: {
              type: 'string'
            },
            handle: {
              type: 'string'
            },
            description: {
              type: 'string'
            },
            featuredImage: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  format: 'uri'
                },
                altText: {
                  type: 'string',
                  nullable: true
                }
              }
            },
            priceRange: {
              type: 'object',
              properties: {
                minVariantPrice: {
                  type: 'object',
                  properties: {
                    amount: {
                      type: 'string'
                    },
                    currencyCode: {
                      type: 'string'
                    }
                  }
                }
              }
            },
            variants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string'
                  },
                  title: {
                    type: 'string'
                  },
                  price: {
                    type: 'object',
                    properties: {
                      amount: {
                        type: 'string'
                      },
                      currencyCode: {
                        type: 'string'
                      }
                    }
                  },
                  availableForSale: {
                    type: 'boolean'
                  }
                }
              }
            }
          }
        },
        ProductHighlight: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique highlight identifier'
            },
            shopifyProductId: {
              type: 'string',
              description: 'Associated Shopify product ID'
            },
            title: {
              type: 'string',
              description: 'Highlight title (e.g., "🔥 Flash Sale!")'
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Optional description text'
            },
            imageUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              description: 'Product image URL'
            },
            productUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              description: 'Direct link to product page'
            },
            ctaText: {
              type: 'string',
              description: 'Call-to-action button text',
              default: 'Shop Now'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether highlight is currently active'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              description: 'Expiration timestamp (48 hours from creation)'
            },
            viewCount: {
              type: 'integer',
              description: 'Number of times viewed'
            },
            clickCount: {
              type: 'integer',
              description: 'Number of times CTA was clicked'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            timeRemaining: {
              type: 'integer',
              description: 'Milliseconds until expiry'
            },
            isExpired: {
              type: 'boolean',
              description: 'Whether highlight has expired'
            }
          }
        },
        Collection: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            title: {
              type: 'string'
            },
            handle: {
              type: 'string'
            },
            description: {
              type: 'string'
            },
            image: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  format: 'uri'
                }
              }
            }
          }
        },
        Cart: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Cart ID'
            },
            checkoutUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL to complete checkout'
            },
            totalQuantity: {
              type: 'integer'
            },
            cost: {
              type: 'object',
              properties: {
                totalAmount: {
                  type: 'object',
                  properties: {
                    amount: {
                      type: 'string'
                    },
                    currencyCode: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    security: [
      {
        ShopDomain: []
      }
    ]
  },
  apis: [
    './app/routes/api.mobile.*.ts',
    './app/routes/api.mobile.*.tsx',
    './app/routes/api.*.ts',
    './app/routes/api.*.tsx'
  ]
};

export const swaggerSpec = swaggerJsdoc(options);