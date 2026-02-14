// Product detail data fetching functions
// TODO: Re-enable 'use cache' directive when cacheComponents is enabled in next.config.ts

// Mock product data - will be replaced with Supabase queries
const mockProducts: Record<string, any> = {
  '1': {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Classic T-Shirt',
    description: 'Comfortable cotton t-shirt perfect for everyday wear. Made from 100% premium cotton with a modern fit.',
    longDescription: 'Our Classic T-Shirt combines comfort and style in one essential piece. Crafted from soft, breathable 100% cotton, this shirt features a modern fit that looks great on everyone. The durable construction ensures it will be a wardrobe staple for years to come. Available in multiple sizes and colors to match your style.',
    price: 24.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/3b82f6/ffffff?text=T-Shirt+Front',
      'https://via.placeholder.com/600x600/3b82f6/ffffff?text=T-Shirt+Back',
      'https://via.placeholder.com/600x600/3b82f6/ffffff?text=T-Shirt+Detail',
    ],
    rating: 4.5,
    reviewCount: 128,
    category: 'apparel',
    inStock: true,
    variants: {
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['Black', 'White', 'Navy', 'Gray'],
    },
  },
  '2': {
    id: '00000000-0000-0000-0000-000000000002',
    title: 'Hoodie',
    description: 'Cozy fleece hoodie for chilly days',
    longDescription: 'Stay warm and comfortable in our premium fleece hoodie. Features a soft interior lining, adjustable drawstring hood, and kangaroo pocket. Perfect for layering or wearing on its own.',
    price: 49.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/8b5cf6/ffffff?text=Hoodie+Front',
      'https://via.placeholder.com/600x600/8b5cf6/ffffff?text=Hoodie+Back',
    ],
    rating: 4.8,
    reviewCount: 94,
    category: 'apparel',
    inStock: true,
    variants: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Black', 'Gray', 'Navy'],
    },
  },
  '3': {
    id: '00000000-0000-0000-0000-000000000003',
    title: 'Mug',
    description: 'Ceramic coffee mug',
    longDescription: 'Start your day right with our high-quality ceramic mug. Microwave and dishwasher safe, this 11oz mug is perfect for coffee, tea, or hot chocolate.',
    price: 14.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/10b981/ffffff?text=Mug+Front',
      'https://via.placeholder.com/600x600/10b981/ffffff?text=Mug+Side',
    ],
    rating: 4.3,
    reviewCount: 256,
    category: 'home',
    inStock: true,
    variants: {
      colors: ['White', 'Black'],
    },
  },
  '4': {
    id: '4',
    title: 'Poster',
    description: 'High-quality art poster',
    longDescription: 'Decorate your space with our premium art posters. Printed on high-quality paper with vibrant colors that last.',
    price: 19.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/f59e0b/ffffff?text=Poster',
    ],
    rating: 4.6,
    reviewCount: 87,
    category: 'home',
    inStock: true,
    variants: {
      sizes: ['A3', 'A4', 'A2'],
    },
  },
  '5': {
    id: '5',
    title: 'Phone Case',
    description: 'Protective phone case',
    longDescription: 'Keep your phone safe with our durable protective case. Slim design with shock-absorbing corners.',
    price: 16.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/ef4444/ffffff?text=Case',
    ],
    rating: 4.4,
    reviewCount: 312,
    category: 'accessories',
    inStock: true,
    variants: {
      models: ['iPhone 14', 'iPhone 15', 'Samsung S23'],
    },
  },
  '6': {
    id: '6',
    title: 'Tote Bag',
    description: 'Eco-friendly tote bag',
    longDescription: 'Carry your essentials in style with our eco-friendly tote bag. Made from sustainable materials.',
    price: 18.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/06b6d4/ffffff?text=Bag',
    ],
    rating: 4.7,
    reviewCount: 143,
    category: 'accessories',
    inStock: true,
    variants: {
      colors: ['Natural', 'Black', 'Navy'],
    },
  },
  '7': {
    id: '7',
    title: 'Cat Lover Mug',
    description: 'Perfect mug for cat enthusiasts',
    longDescription: 'Show your love for cats with this adorable mug. Features cute cat designs and holds 11oz of your favorite beverage.',
    price: 12.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/ec4899/ffffff?text=Cat+Mug',
    ],
    rating: 4.9,
    reviewCount: 189,
    category: 'home',
    inStock: true,
    variants: {
      colors: ['White', 'Pink'],
    },
  },
  '8': {
    id: '8',
    title: 'Canvas Print',
    description: 'Beautiful canvas wall art',
    longDescription: 'Transform your walls with our stunning canvas prints. Gallery-quality printing on premium canvas material.',
    price: 39.99,
    currency: 'USD',
    images: [
      'https://via.placeholder.com/600x600/6366f1/ffffff?text=Canvas',
    ],
    rating: 4.7,
    reviewCount: 76,
    category: 'home',
    inStock: true,
    variants: {
      sizes: ['12x16', '16x20', '20x24'],
    },
  },
}

// Add UUID aliases for products 1-3
mockProducts['00000000-0000-0000-0000-000000000001'] = mockProducts['1']
mockProducts['00000000-0000-0000-0000-000000000002'] = mockProducts['2']
mockProducts['00000000-0000-0000-0000-000000000003'] = mockProducts['3']

// Mock reviews data
const mockReviews: Record<string, any[]> = {
  '1': [
    {
      id: 'rev-1',
      author: 'Sarah Johnson',
      rating: 5,
      date: '2024-02-10',
      verified: true,
      comment: 'Absolutely love this t-shirt! The fabric is so soft and the fit is perfect. I ordered two more in different colors.',
    },
    {
      id: 'rev-2',
      author: 'Mike Chen',
      rating: 4,
      date: '2024-02-08',
      verified: true,
      comment: 'Great quality shirt. Runs slightly large, so I recommend sizing down if you want a fitted look.',
    },
    {
      id: 'rev-3',
      author: 'Emily Rodriguez',
      rating: 5,
      date: '2024-02-05',
      verified: true,
      comment: 'Best t-shirt I\'ve bought in years. The color stays vibrant after multiple washes. Highly recommend!',
    },
  ],
  '2': [
    {
      id: 'rev-4',
      author: 'David Kim',
      rating: 5,
      date: '2024-02-12',
      verified: true,
      comment: 'This hoodie is incredibly comfortable and warm. Perfect for cold days. The quality is outstanding!',
    },
    {
      id: 'rev-5',
      author: 'Lisa Anderson',
      rating: 5,
      date: '2024-02-09',
      verified: true,
      comment: 'Love the fit and the softness of the interior lining. It\'s become my go-to hoodie.',
    },
  ],
}

// Cached function to get product by ID
export async function getProduct(id: string) {
  // In production, this would query Supabase
  // The "use cache" directive at the top of the file automatically caches the result
  return mockProducts[id] || null
}

// Cached function to get product reviews
export async function getProductReviews(id: string) {
  // Normalize ID (handle both '1' and UUID formats)
  const normalizedId = id.startsWith('00000000-') ? id.slice(-1) : id
  return mockReviews[normalizedId] || []
}

// Cached function to get related products
export async function getRelatedProducts(productId: string) {
  const product = await getProduct(productId)
  if (!product) return []

  const seenIds = new Set<string>()
  return Object.values(mockProducts)
    .filter((p) => {
      if (p.category !== product?.category || p.id === product?.id || seenIds.has(p.id)) {
        return false
      }
      seenIds.add(p.id)
      return true
    })
    .slice(0, 4)
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.price,
      currency: p.currency,
      image: p.images[0],
      rating: p.rating,
      reviewCount: p.reviewCount,
      category: p.category,
    }))
}
