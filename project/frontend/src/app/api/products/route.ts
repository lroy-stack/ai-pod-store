import { NextRequest, NextResponse } from 'next/server'

// Mock product data - will be replaced with Supabase queries
const mockProducts = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Classic T-Shirt',
    description: 'Comfortable cotton t-shirt',
    price: 24.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/3b82f6/ffffff?text=T-Shirt',
    rating: 4.5,
    reviewCount: 128,
    category: 'apparel',
    inStock: true,
    variants: {
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['Black', 'White', 'Navy', 'Gray'],
    },
    stock: 150,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    title: 'Hoodie',
    description: 'Cozy fleece hoodie',
    price: 49.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/8b5cf6/ffffff?text=Hoodie',
    rating: 4.8,
    reviewCount: 94,
    category: 'apparel',
    inStock: true,
    variants: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Black', 'Gray', 'Navy'],
    },
    stock: 85,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    title: 'Mug',
    description: 'Ceramic coffee mug',
    price: 14.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/10b981/ffffff?text=Mug',
    rating: 4.3,
    reviewCount: 256,
    category: 'home',
    inStock: true,
    stock: 200,
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
    inStock: true,
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
    inStock: true,
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
    inStock: true,
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
    inStock: true,
  },
  {
    id: '8',
    title: 'Canvas Print',
    description: 'Beautiful canvas wall art',
    price: 39.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/6366f1/ffffff?text=Canvas',
    rating: 4.7,
    reviewCount: 76,
    category: 'home',
    inStock: true,
  },
  {
    id: '9',
    title: 'Water Bottle',
    description: 'Stainless steel water bottle',
    price: 22.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/14b8a6/ffffff?text=Bottle',
    rating: 4.6,
    reviewCount: 201,
    category: 'accessories',
    inStock: true,
  },
  {
    id: '10',
    title: 'Laptop Sleeve',
    description: 'Protective laptop sleeve',
    price: 28.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/8b5cf6/ffffff?text=Sleeve',
    rating: 4.5,
    reviewCount: 167,
    category: 'accessories',
    inStock: true,
  },
  {
    id: '11',
    title: 'Yoga Mat',
    description: 'Non-slip yoga mat',
    price: 34.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/10b981/ffffff?text=Yoga+Mat',
    rating: 4.8,
    reviewCount: 223,
    category: 'accessories',
    inStock: true,
  },
  {
    id: '12',
    title: 'Wall Clock',
    description: 'Modern wall clock',
    price: 45.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/f59e0b/ffffff?text=Clock',
    rating: 4.4,
    reviewCount: 98,
    category: 'home',
    inStock: true,
  },
  {
    id: '13',
    title: 'Throw Pillow',
    description: 'Decorative throw pillow',
    price: 24.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/ec4899/ffffff?text=Pillow',
    rating: 4.6,
    reviewCount: 145,
    category: 'home',
    inStock: true,
  },
  {
    id: '14',
    title: 'Baseball Cap',
    description: 'Adjustable baseball cap',
    price: 19.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/3b82f6/ffffff?text=Cap',
    rating: 4.7,
    reviewCount: 178,
    category: 'apparel',
    inStock: true,
  },
  {
    id: '15',
    title: 'Zip Hoodie',
    description: 'Full-zip hoodie with pockets',
    price: 54.99,
    currency: 'USD',
    image: 'https://via.placeholder.com/400x400/6366f1/ffffff?text=Zip+Hoodie',
    rating: 4.9,
    reviewCount: 112,
    category: 'apparel',
    inStock: true,
  },
]

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const locale = searchParams.get('locale') || 'en'
    const category = searchParams.get('category')
    // Support both 'q' and 'search' parameters for text search
    const search = searchParams.get('q') || searchParams.get('search')
    const sort = searchParams.get('sort')

    // Filter products
    let filteredProducts = [...mockProducts]

    // Filter by category
    if (category) {
      filteredProducts = filteredProducts.filter((p) => p.category === category)
    }

    // Filter by search query
    if (search) {
      const searchLower = search.toLowerCase()
      filteredProducts = filteredProducts.filter(
        (p) =>
          p.title.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
      )
    }

    // Sort products
    if (sort === 'price-asc') {
      filteredProducts.sort((a, b) => a.price - b.price)
    } else if (sort === 'price-desc') {
      filteredProducts.sort((a, b) => b.price - a.price)
    } else if (sort === 'rating') {
      filteredProducts.sort((a, b) => b.rating - a.rating)
    } else if (sort === 'popular') {
      filteredProducts.sort((a, b) => b.reviewCount - a.reviewCount)
    }

    // Calculate pagination
    const total = filteredProducts.length
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit
    const paginatedProducts = filteredProducts.slice(offset, offset + limit)

    // Return paginated response
    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages,
      items: paginatedProducts,
      locale,
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch products',
      },
      { status: 500 }
    )
  }
}
