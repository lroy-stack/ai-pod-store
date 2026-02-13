'use cache'

// Cached product data fetching functions
// These functions use React's "use cache" directive for automatic caching

// Mock product data - will be replaced with Supabase queries
const mockProducts = [
  {
    id: '1',
    title: 'Classic T-Shirt',
    description: 'Comfortable cotton t-shirt',
    price: 24.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/3b82f6/ffffff?text=T-Shirt',
    rating: 4.5,
    reviewCount: 128,
    category: 'apparel',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    title: 'Hoodie',
    description: 'Cozy fleece hoodie',
    price: 49.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/8b5cf6/ffffff?text=Hoodie',
    rating: 4.8,
    reviewCount: 94,
    category: 'apparel',
    createdAt: '2024-02-20T10:00:00Z',
  },
  {
    id: '3',
    title: 'Mug',
    description: 'Ceramic coffee mug',
    price: 14.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/10b981/ffffff?text=Mug',
    rating: 4.3,
    reviewCount: 256,
    category: 'home',
    createdAt: '2024-01-10T10:00:00Z',
  },
  {
    id: '4',
    title: 'Poster',
    description: 'High-quality art poster',
    price: 19.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/f59e0b/ffffff?text=Poster',
    rating: 4.6,
    reviewCount: 87,
    category: 'home',
    createdAt: '2024-03-05T10:00:00Z',
  },
  {
    id: '5',
    title: 'Phone Case',
    description: 'Protective phone case',
    price: 16.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/ef4444/ffffff?text=Case',
    rating: 4.4,
    reviewCount: 312,
    category: 'accessories',
    createdAt: '2024-01-25T10:00:00Z',
  },
  {
    id: '6',
    title: 'Tote Bag',
    description: 'Eco-friendly tote bag',
    price: 18.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/06b6d4/ffffff?text=Bag',
    rating: 4.7,
    reviewCount: 143,
    category: 'accessories',
    createdAt: '2024-02-10T10:00:00Z',
  },
  {
    id: '7',
    title: 'Cat Lover Mug',
    description: 'Perfect mug for cat enthusiasts',
    price: 12.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/ec4899/ffffff?text=Cat+Mug',
    rating: 4.9,
    reviewCount: 189,
    category: 'home',
    createdAt: '2024-03-15T10:00:00Z',
  },
  {
    id: '8',
    title: 'Canvas Print',
    description: 'Beautiful canvas wall art',
    price: 39.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/6366f1/ffffff?text=Canvas',
    rating: 4.6,
    reviewCount: 76,
    category: 'home',
    createdAt: '2024-02-15T10:00:00Z',
  },
  {
    id: '9',
    title: 'Baseball Cap',
    description: 'Adjustable cotton baseball cap',
    price: 19.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/14b8a6/ffffff?text=Cap',
    rating: 4.4,
    reviewCount: 203,
    category: 'accessories',
    createdAt: '2024-01-20T10:00:00Z',
  },
  {
    id: '10',
    title: 'Laptop Sleeve',
    description: 'Padded laptop protection',
    price: 24.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/f97316/ffffff?text=Sleeve',
    rating: 4.7,
    reviewCount: 154,
    category: 'accessories',
    createdAt: '2024-02-28T10:00:00Z',
  },
  {
    id: '11',
    title: 'Water Bottle',
    description: 'Insulated stainless steel bottle',
    price: 22.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/0ea5e9/ffffff?text=Bottle',
    rating: 4.8,
    reviewCount: 287,
    category: 'accessories',
    createdAt: '2024-03-10T10:00:00Z',
  },
  {
    id: '12',
    title: 'Yoga Mat',
    description: 'Non-slip exercise mat',
    price: 29.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/a855f7/ffffff?text=Yoga+Mat',
    rating: 4.5,
    reviewCount: 198,
    category: 'accessories',
    createdAt: '2024-01-30T10:00:00Z',
  },
  {
    id: '13',
    title: 'Sweatpants',
    description: 'Comfortable cotton blend sweatpants',
    price: 34.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/84cc16/ffffff?text=Sweatpants',
    rating: 4.3,
    reviewCount: 112,
    category: 'apparel',
    createdAt: '2024-02-05T10:00:00Z',
  },
  {
    id: '14',
    title: 'Coasters Set',
    description: 'Set of 4 absorbent coasters',
    price: 15.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/eab308/ffffff?text=Coasters',
    rating: 4.6,
    reviewCount: 221,
    category: 'home',
    createdAt: '2024-03-01T10:00:00Z',
  },
  {
    id: '15',
    title: 'Tank Top',
    description: 'Breathable athletic tank top',
    price: 18.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/f43f5e/ffffff?text=Tank',
    rating: 4.4,
    reviewCount: 167,
    category: 'apparel',
    createdAt: '2024-01-18T10:00:00Z',
  },
]

// Cached function to get all products
export async function getCatalogProducts() {
  // In production, this would query Supabase
  // The "use cache" directive at the top of the file automatically caches the result
  return mockProducts
}

// Cached function to get product categories
export async function getProductCategories() {
  const products = await getCatalogProducts()
  const categories = Array.from(new Set(products.map((p) => p.category)))
  return ['all', ...categories]
}

// Cached function to get product count per category
export async function getCategoryProductCount(category: string) {
  const products = await getCatalogProducts()
  if (category === 'all') {
    return products.length
  }
  return products.filter((p) => p.category === category).length
}
