# Mobile API Documentation

## Product Highlights API

### Get Active Highlights
**Endpoint:** `GET /api/mobile/highlights`
**Headers:** `X-Shop-Domain: your-shop.myshopify.com`

**Response:**
```json
{
  "success": true,
  "highlights": [
    {
      "id": "highlight-uuid",
      "shopifyProductId": "gid://shopify/Product/123",
      "title": "🔥 Flash Sale - 50% Off!",
      "description": "Limited time offer on our best-selling item...",
      "imageUrl": "https://cdn.shopify.com/image.jpg",
      "productUrl": "https://shop.com/products/item",
      "ctaText": "Shop Now",
      "isActive": true,
      "expiresAt": "2024-01-11T10:00:00Z",
      "viewCount": 150,
      "clickCount": 23,
      "createdAt": "2024-01-09T10:00:00Z",
      "timeRemaining": 172800000,
      "isExpired": false
    }
  ],
  "count": 1
}
```

### Get Specific Highlight
**Endpoint:** `GET /api/mobile/highlights?id=highlight-uuid`
**Headers:** `X-Shop-Domain: your-shop.myshopify.com`

**Response:**
```json
{
  "success": true,
  "highlight": {
    "id": "highlight-uuid",
    "shopifyProductId": "gid://shopify/Product/123",
    "title": "🔥 Flash Sale - 50% Off!",
    "description": "Limited time offer...",
    "imageUrl": "https://cdn.shopify.com/image.jpg",
    "productUrl": "https://shop.com/products/item",
    "ctaText": "Shop Now",
    "isActive": true,
    "expiresAt": "2024-01-11T10:00:00Z",
    "viewCount": 151,
    "clickCount": 23,
    "createdAt": "2024-01-09T10:00:00Z",
    "timeRemaining": 172800000,
    "isExpired": false
  }
}
```

### Track Highlight Click
**Endpoint:** `POST /api/mobile/highlights`
**Headers:** `X-Shop-Domain: your-shop.myshopify.com`

**Request Body:**
```json
{
  "action": "click",
  "highlightId": "highlight-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Click tracked",
  "highlight": {
    "id": "highlight-uuid",
    "clickCount": 24,
    // ... other highlight fields
  }
}
```

## Implementation Guide for Mobile App

### 1. Display Highlights as Stories

```javascript
// Fetch highlights
const fetchHighlights = async () => {
  const response = await fetch('/api/mobile/highlights', {
    headers: {
      'X-Shop-Domain': 'your-shop.myshopify.com'
    }
  });
  const data = await response.json();
  return data.highlights;
};

// Display as story circles (like Instagram/WhatsApp)
const HighlightStories = ({ highlights }) => {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {highlights.map(highlight => (
        <TouchableOpacity 
          key={highlight.id}
          onPress={() => openHighlightModal(highlight)}
          style={styles.storyCircle}
        >
          <Image source={{ uri: highlight.imageUrl }} style={styles.storyImage} />
          <Text style={styles.storyTitle}>{highlight.title}</Text>
          <View style={styles.timeIndicator}>
            <Text>{formatTimeRemaining(highlight.timeRemaining)}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};
```

### 2. Story Modal Implementation

```javascript
const HighlightModal = ({ highlight, onClose }) => {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    // Auto-advance story after 5 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    
    // Progress bar animation
    const progressTimer = setInterval(() => {
      setProgress(prev => prev + 2); // 100% in 5 seconds
    }, 100);
    
    return () => {
      clearTimeout(timer);
      clearInterval(progressTimer);
    };
  }, []);
  
  const handleCTAPress = async () => {
    // Track click
    await fetch('/api/mobile/highlights', {
      method: 'POST',
      headers: {
        'X-Shop-Domain': 'your-shop.myshopify.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'click',
        highlightId: highlight.id
      })
    });
    
    // Open product URL
    Linking.openURL(highlight.productUrl);
  };
  
  return (
    <Modal visible={true} animationType="slide">
      <View style={styles.storyContainer}>
        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progress, { width: `${progress}%` }]} />
        </View>
        
        {/* Story content */}
        <Image source={{ uri: highlight.imageUrl }} style={styles.fullImage} />
        
        <View style={styles.storyContent}>
          <Text style={styles.storyTitle}>{highlight.title}</Text>
          <Text style={styles.storyDescription}>{highlight.description}</Text>
          
          <TouchableOpacity 
            style={styles.ctaButton}
            onPress={handleCTAPress}
          >
            <Text style={styles.ctaText}>{highlight.ctaText}</Text>
          </TouchableOpacity>
        </View>
        
        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text>×</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};
```

### 3. Time Formatting Utility

```javascript
const formatTimeRemaining = (milliseconds) => {
  if (milliseconds <= 0) return "Expired";
  
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};
```

## Push Notification Payload

When a new highlight is created, users receive this push notification:

```json
{
  "title": "🌟 New Product Highlight: Flash Sale - 50% Off!",
  "body": "Limited time offer on our best-selling item...",
  "data": {
    "type": "PRODUCT_HIGHLIGHT",
    "highlightId": "highlight-uuid",
    "productId": "gid://shopify/Product/123"
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE" // Optional
}
```

Common HTTP status codes:
- `400` - Bad Request (missing parameters)
- `401` - Unauthorized (missing/invalid X-Shop-Domain)
- `404` - Not Found (highlight doesn't exist)
- `429` - Rate Limited
- `500` - Server Error