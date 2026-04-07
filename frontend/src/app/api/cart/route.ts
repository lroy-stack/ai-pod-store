import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'
import { STORE_DEFAULTS } from '@/lib/store-config'

const MAX_CART_QUANTITY = STORE_DEFAULTS.maxCartQuantity

// GET /api/cart - Fetch cart items
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('sb-access-token')

    // Get session ID for guest carts (fallback)
    let sessionId = cookieStore.get('cart-session-id')?.value
    let needsSessionCookie = false
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      needsSessionCookie = true
    }

    const supabase = supabaseAdmin

    // Try to get user from session
    let userId: string | null = null
    let userScopedClient: ReturnType<typeof createClient> | null = null
    if (sessionCookie) {
      const { data: { user } } = await supabase.auth.getUser(sessionCookie.value)
      userId = user?.id || null

      // Create user-scoped client for RLS-protected queries (personalizations)
      if (userId) {
        userScopedClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            auth: { persistSession: false },
            global: { headers: { Authorization: `Bearer ${sessionCookie.value}` } },
          }
        )
      }
    }

    // Fetch cart items (either by user_id or session_id)
    const query = supabase
      .from('cart_items')
      .select('id, product_id, quantity, variant_id, personalization_id, composition_id, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (userId) {
      query.eq('user_id', userId)
    } else {
      query.eq('session_id', sessionId)
    }

    const { data: cartItems, error } = await query

    if (error) {
      console.error('Cart fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch cart', message: error.message },
        { status: 500 }
      )
    }

    // Fetch product details for each cart item
    // We need to get product_id list and query products + products_l10n
    const productIds = (cartItems || []).map((item: any) => item.product_id)

    if (productIds.length === 0) {
      const response = NextResponse.json({ items: [] })
      if (needsSessionCookie) {
        response.cookies.set('cart-session-id', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        })
      }
      return response
    }

    // Fetch products with their base info (include status for availability check)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, slug, title, base_price_cents, currency, images, status')
      .is('deleted_at', null)
      .in('id', productIds)

    if (productsError) {
      console.error('Products fetch error:', productsError)
      return NextResponse.json(
        { error: 'Failed to fetch products', message: productsError.message },
        { status: 500 }
      )
    }

    // Create a map of product details
    const productMap = new Map(
      (products || []).map((p: any) => {
        const img = Array.isArray(p.images) && p.images.length > 0
          ? (p.images[0].src || p.images[0].url || '')
          : ''
        return [
          p.id,
          {
            slug: p.slug,
            title: p.title || 'Unknown Product',
            price: p.base_price_cents ? p.base_price_cents / 100 : 0,
            image: img,
            currency: p.currency?.toUpperCase() || 'EUR',
            unavailable: p.status !== 'active',
          },
        ]
      })
    )

    // Fetch variant details for cart items that have a variant_id
    const variantIds = (cartItems || [])
      .map((item: any) => item.variant_id)
      .filter(Boolean)

    let variantMap = new Map<string, { size?: string; color?: string; price_cents?: number; image_url?: string }>()
    if (variantIds.length > 0) {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('id, size, color, price_cents, image_url')
        .in('id', variantIds)

      variantMap = new Map(
        (variants || []).map((v: any) => [v.id, { size: v.size, color: v.color, price_cents: v.price_cents, image_url: v.image_url }])
      )
    }

    // Fetch personalization details for cart items that have a personalization_id
    // Only authenticated users can have personalizations (RLS-protected)
    const personalizationIds = (cartItems || [])
      .map((item: any) => item.personalization_id)
      .filter(Boolean)

    let personalizationMap = new Map<string, any>()
    if (personalizationIds.length > 0 && userScopedClient) {
      // Use user-scoped client to respect RLS policies on personalizations table
      const { data: personalizations } = await userScopedClient
        .from('personalizations')
        .select('id, text_content, font_family, font_color, font_size, position, preview_url')
        .in('id', personalizationIds)

      personalizationMap = new Map(
        (personalizations || []).map((p: any) => [
          p.id,
          {
            text: p.text_content || '',
            font: p.font_family || 'Inter',
            fontColor: p.font_color || '#000000',
            fontSize: p.font_size || 'medium',
            position: p.position || 'bottom',
            preview: p.preview_url || null,
          },
        ])
      )
    }

    // Fetch available variants for each product in the cart (for variant editing)
    const uniqueProductIds = [...new Set(productIds)]
    const availableVariants: Record<string, { sizes: string[]; colors: string[] }> = {}

    if (uniqueProductIds.length > 0) {
      const { data: allVariants } = await supabase
        .from('product_variants')
        .select('product_id, size, color')
        .in('product_id', uniqueProductIds)
        .eq('is_enabled', true)
        .eq('is_available', true)

      for (const pid of uniqueProductIds) {
        const productVariants = (allVariants || []).filter((v: any) => v.product_id === pid)
        const sizes = [...new Set(productVariants.map((v: any) => v.size).filter(Boolean))] as string[]
        const colors = [...new Set(productVariants.map((v: any) => v.color).filter(Boolean))] as string[]
        if (sizes.length > 0 || colors.length > 0) {
          availableVariants[pid] = { sizes, colors }
        }
      }
    }

    // Transform cart items to include product details
    const items = (cartItems || []).map((item: any) => {
      const productDetails = productMap.get(item.product_id) || {
        slug: '',
        title: 'Unknown Product',
        price: 0,
        image: '',
        currency: 'EUR',
        unavailable: true,
      }

      return {
        id: item.id,
        product_id: item.product_id,
        product_slug: productDetails.slug || item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        product_title: productDetails.title,
        product_price: (() => {
          if (item.variant_id) {
            const vd = variantMap.get(item.variant_id)
            if (vd?.price_cents) return vd.price_cents / 100
          }
          return productDetails.price
        })(),
        product_image: (() => {
          if (item.variant_id) {
            const vd = variantMap.get(item.variant_id)
            if (vd?.image_url) return vd.image_url
          }
          return productDetails.image || ''
        })(),
        product_currency: productDetails.currency || 'EUR',
        unavailable: productDetails.unavailable || false,
        variant_details: item.variant_id ? (variantMap.get(item.variant_id) || {}) : {},
        personalization_id: item.personalization_id,
        composition_id: item.composition_id,
        personalization: item.personalization_id
          ? personalizationMap.get(item.personalization_id)
          : undefined,
      }
    })

    const response = NextResponse.json({ items, available_variants: availableVariants })
    if (needsSessionCookie) {
      response.cookies.set('cart-session-id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }
    return response
  } catch (error) {
    console.error('Cart API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/cart - Add item to cart
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('sb-access-token')

    // Get session ID for guest carts
    let sessionId = cookieStore.get('cart-session-id')?.value
    let needsSessionCookie = false
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      needsSessionCookie = true
    }

    const supabase = supabaseAdmin

    // Try to get user from session
    let userId: string | null = null
    if (sessionCookie) {
      const { data: { user } } = await supabase.auth.getUser(sessionCookie.value)
      userId = user?.id || null
    }

    const body = await request.json()
    const { product_id, quantity, variant_details, personalization_id, composition_id } = body

    if (!product_id || !quantity || quantity < 1) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'product_id and quantity are required' },
        { status: 400 }
      )
    }

    // Validate product exists and is active
    const { data: product } = await supabase
      .from('products')
      .select('id, status')
      .eq('id', product_id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single()

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found or unavailable', code: 'PRODUCT_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Resolve variant_id from variant_details (size/color)
    let variantId: string | null = null
    if (variant_details && (variant_details.size || variant_details.color)) {
      let variantQuery = supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', product_id)
        .eq('is_enabled', true)
        .eq('is_available', true)

      if (variant_details.size) {
        variantQuery = variantQuery.eq('size', variant_details.size)
      }
      if (variant_details.color) {
        variantQuery = variantQuery.eq('color', variant_details.color)
      }

      const { data: matchedVariants } = await variantQuery.limit(1)
      if (matchedVariants && matchedVariants.length > 0) {
        variantId = matchedVariants[0].id
      }
    }

    // If variant not resolved, try autoselect or reject
    if (!variantId) {
      const { data: availableVariants } = await supabase
        .from('product_variants')
        .select('id, size, color')
        .eq('product_id', product_id)
        .eq('is_enabled', true)
        .eq('is_available', true)

      if (availableVariants && availableVariants.length === 1) {
        variantId = availableVariants[0].id
      } else if (availableVariants && availableVariants.length > 1) {
        return NextResponse.json(
          {
            error: 'Variant selection required',
            code: 'VARIANT_REQUIRED',
            message: 'This product requires selecting a size/color.',
            available_variants: availableVariants,
          },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: 'No available variants for this product', code: 'NO_VARIANTS' },
          { status: 400 }
        )
      }
    }

    // Check if item already exists in cart (same product + same variant + same personalization)
    // variantId is guaranteed non-null at this point
    const existingQuery = supabase
      .from('cart_items')
      .select('*')
      .eq('product_id', product_id)
      .eq('variant_id', variantId)

    if (personalization_id) {
      existingQuery.eq('personalization_id', personalization_id)
    } else {
      existingQuery.is('personalization_id', null)
    }

    if (composition_id) {
      existingQuery.eq('composition_id', composition_id)
    } else {
      existingQuery.is('composition_id', null)
    }

    if (userId) {
      existingQuery.eq('user_id', userId)
    } else {
      existingQuery.eq('session_id', sessionId)
    }

    const { data: existingItems } = await existingQuery

    if (existingItems && existingItems.length > 0) {
      // Update quantity if item already exists
      const existingItem = existingItems[0]
      const newQuantity = Math.min(existingItem.quantity + quantity, MAX_CART_QUANTITY)

      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', existingItem.id)

      if (updateError) {
        console.error('Cart update error:', updateError)
        return NextResponse.json(
          { error: 'Failed to update cart', message: updateError.message },
          { status: 500 }
        )
      }

      const response = NextResponse.json({ success: true, updated: true })
      if (needsSessionCookie) {
        response.cookies.set('cart-session-id', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        })
      }
      return response
    }

    // Insert new cart item (variant_id is guaranteed non-null)
    const cartItem: any = {
      product_id,
      quantity,
      variant_id: variantId,
      session_id: userId ? null : sessionId,
      user_id: userId,
      ...(personalization_id ? { personalization_id } : {}),
      ...(composition_id ? { composition_id } : {}),
    }

    const { error: insertError } = await supabase
      .from('cart_items')
      .insert(cartItem)

    if (insertError) {
      console.error('Cart insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to add to cart', message: insertError.message },
        { status: 500 }
      )
    }

    const response = NextResponse.json({ success: true, added: true })
    if (needsSessionCookie) {
      response.cookies.set('cart-session-id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }
    return response
  } catch (error) {
    console.error('Cart API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/cart - Update cart item quantity
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('sb-access-token')
    const sessionId = cookieStore.get('cart-session-id')?.value

    const supabase = supabaseAdmin

    // Try to get user from session
    let userId: string | null = null
    if (sessionCookie) {
      const { data: { user } } = await supabase.auth.getUser(sessionCookie.value)
      userId = user?.id || null
    }

    // SECURITY: Require ownership context — prevent unscoped queries
    if (!userId && !sessionId) {
      return NextResponse.json(
        { error: 'No cart found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { item_id, quantity, variant_details } = body

    if (!item_id) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'item_id is required' },
        { status: 400 }
      )
    }

    // If quantity is provided, validate it
    if (typeof quantity === 'number') {
      if (quantity < 0) {
        return NextResponse.json(
          { error: 'Invalid request', message: 'quantity must be >= 0' },
          { status: 400 }
        )
      }

      // Enforce maximum quantity limit
      if (quantity > MAX_CART_QUANTITY) {
        return NextResponse.json(
          { error: 'Quantity exceeds maximum', message: `Maximum quantity is ${MAX_CART_QUANTITY}` },
          { status: 400 }
        )
      }

      // If quantity is 0, delete the item
      if (quantity === 0) {
        const deleteQuery = supabase
          .from('cart_items')
          .delete()
          .eq('id', item_id)

        if (userId) {
          deleteQuery.eq('user_id', userId)
        } else if (sessionId) {
          deleteQuery.eq('session_id', sessionId)
        }

        const { error } = await deleteQuery

        if (error) {
          console.error('Cart item delete error:', error)
          return NextResponse.json(
            { error: 'Failed to remove item', message: error.message },
            { status: 500 }
          )
        }

        return NextResponse.json({ success: true, deleted: true })
      }
    }

    // Build update payload
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }

    if (typeof quantity === 'number') {
      updatePayload.quantity = quantity
    }

    // Handle variant change
    if (variant_details && (variant_details.size || variant_details.color)) {
      // Get the cart item to find its product_id (with ownership check)
      const cartItemQuery = supabase
        .from('cart_items')
        .select('product_id')
        .eq('id', item_id)

      if (userId) {
        cartItemQuery.eq('user_id', userId)
      } else if (sessionId) {
        cartItemQuery.eq('session_id', sessionId)
      }

      const { data: cartItem } = await cartItemQuery.single()

      if (!cartItem) {
        return NextResponse.json(
          { error: 'Cart item not found', code: 'ITEM_NOT_FOUND' },
          { status: 404 }
        )
      }

      // Resolve new variant_id from variant_details
      let variantQuery = supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', cartItem.product_id)
        .eq('is_enabled', true)
        .eq('is_available', true)

      if (variant_details.size) {
        variantQuery = variantQuery.eq('size', variant_details.size)
      }
      if (variant_details.color) {
        variantQuery = variantQuery.eq('color', variant_details.color)
      }

      const { data: matchedVariants } = await variantQuery.limit(1)

      if (!matchedVariants || matchedVariants.length === 0) {
        return NextResponse.json(
          { error: 'Variant not available', code: 'VARIANT_UNAVAILABLE' },
          { status: 400 }
        )
      }

      updatePayload.variant_id = matchedVariants[0].id
    }

    // Must have something to update
    if (Object.keys(updatePayload).length <= 1) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'quantity or variant_details required' },
        { status: 400 }
      )
    }

    // Update cart item (with ownership check)
    const updateQuery = supabase
      .from('cart_items')
      .update(updatePayload)
      .eq('id', item_id)

    if (userId) {
      updateQuery.eq('user_id', userId)
    } else if (sessionId) {
      updateQuery.eq('session_id', sessionId)
    }

    const { error } = await updateQuery

    if (error) {
      console.error('Cart item update error:', error)
      return NextResponse.json(
        { error: 'Failed to update cart item', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, updated: true })
  } catch (error) {
    console.error('Cart API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/cart - Clear all cart items
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('sb-access-token')
    const sessionId = cookieStore.get('cart-session-id')?.value

    const supabase = supabaseAdmin

    // Try to get user from session
    let userId: string | null = null
    if (sessionCookie) {
      const { data: { user } } = await supabase.auth.getUser(sessionCookie.value)
      userId = user?.id || null
    }

    // Delete cart items
    const deleteQuery = supabase.from('cart_items').delete()

    if (userId) {
      deleteQuery.eq('user_id', userId)
    } else if (sessionId) {
      deleteQuery.eq('session_id', sessionId)
    } else {
      return NextResponse.json({ error: 'No cart found' }, { status: 404 })
    }

    const { error } = await deleteQuery

    if (error) {
      console.error('Cart delete error:', error)
      return NextResponse.json(
        { error: 'Failed to clear cart', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cart API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
