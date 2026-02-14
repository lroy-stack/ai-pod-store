import { NextResponse } from 'next/server'

// Mock skills data for now
// In production, this would read from PodClaw's skills registry
const MOCK_SKILLS = [
  {
    id: 'product_search',
    name: 'Product Search',
    description: 'Search products by query, category, or filters',
    status: 'active',
    usage_count: 1243,
  },
  {
    id: 'design_generator',
    name: 'Design Generator',
    description: 'Generate AI designs using fal.ai FLUX.1',
    status: 'active',
    usage_count: 87,
  },
  {
    id: 'order_tracker',
    name: 'Order Tracker',
    description: 'Track order status and shipping',
    status: 'active',
    usage_count: 456,
  },
  {
    id: 'cart_manager',
    name: 'Cart Manager',
    description: 'Add, update, remove items from cart',
    status: 'active',
    usage_count: 892,
  },
  {
    id: 'recommendation_engine',
    name: 'Recommendation Engine',
    description: 'Generate personalized product recommendations',
    status: 'active',
    usage_count: 623,
  },
  {
    id: 'size_guide',
    name: 'Size Guide',
    description: 'Provide size recommendations for products',
    status: 'active',
    usage_count: 312,
  },
  {
    id: 'return_handler',
    name: 'Return Handler',
    description: 'Process return and refund requests',
    status: 'active',
    usage_count: 45,
  },
  {
    id: 'wishlist_manager',
    name: 'Wishlist Manager',
    description: 'Manage customer wishlists',
    status: 'active',
    usage_count: 234,
  },
]

export async function GET() {
  try {
    return NextResponse.json(MOCK_SKILLS)
  } catch (err) {
    console.error('Failed to fetch skills:', err)
    return NextResponse.json(
      { error: 'Failed to fetch skills' },
      { status: 500 }
    )
  }
}
