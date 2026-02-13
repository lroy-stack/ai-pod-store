#!/usr/bin/env node
/**
 * Seed Database Script
 * ====================
 * Populates the database with test data for development
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from frontend/.env.local
config({ path: resolve(process.cwd(), '../frontend/.env.local') })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function seedDatabase() {
  console.log('🌱 Starting database seed...\n')

  try {
    // 1. Create test admin user
    console.log('Creating test admin user...')
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .upsert([
        {
          email: 'admin@podplatform.test',
          name: 'Admin User',
          role: 'admin',
          locale: 'en',
          currency: 'USD',
          email_verified: true,
          notification_preferences: { email: true, push: true, sms: false },
        },
      ], { onConflict: 'email', ignoreDuplicates: false })
      .select()
      .single()

    if (adminError && adminError.code !== '23505') {
      console.error('❌ Error creating admin user:', adminError)
    } else {
      console.log('✓ Admin user created/updated:', adminUser?.email || 'admin@podplatform.test')
    }

    // 2. Create test customer users
    console.log('Creating test customer users...')
    const { data: customers, error: customersError } = await supabase
      .from('users')
      .upsert([
        {
          email: 'customer1@podplatform.test',
          name: 'John Doe',
          role: 'customer',
          locale: 'en',
          currency: 'USD',
          email_verified: true,
        },
        {
          email: 'customer2@podplatform.test',
          name: 'Jane Smith',
          role: 'customer',
          locale: 'es',
          currency: 'EUR',
          email_verified: true,
        },
      ], { onConflict: 'email', ignoreDuplicates: false })
      .select()

    if (customersError && customersError.code !== '23505') {
      console.error('❌ Error creating customer users:', customersError)
    } else {
      console.log(`✓ ${customers?.length || 2} customer users created/updated`)
    }

    // 3. Check if products already exist
    console.log('Checking for existing products...')
    const { data: existingProducts, count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .limit(10)

    let products = existingProducts || []

    if (productCount && productCount > 0) {
      console.log(`✓ Products already exist (${productCount} found), skipping insert`)
    } else {
      // Insert new products
      console.log('Creating test products...')
      const { data: newProducts, error: productsError } = await supabase
        .from('products')
        .insert([
          {
            title: 'Classic T-Shirt',
            description: 'A comfortable classic t-shirt perfect for everyday wear',
            category: 'Apparel',
            tags: ['t-shirt', 'classic', 'casual'],
            base_price_cents: 1999,
            currency: 'usd',
            status: 'active',
            images: [
              { url: 'https://placehold.co/600x600/teal/white?text=Classic+T-Shirt', alt: 'Classic T-Shirt' }
            ],
            avg_rating: 4.5,
            review_count: 24,
          },
          {
            title: 'Custom Mug',
            description: 'Personalized coffee mug with your own design',
            category: 'Drinkware',
            tags: ['mug', 'coffee', 'custom'],
            base_price_cents: 1499,
            currency: 'usd',
            status: 'active',
            images: [
              { url: 'https://placehold.co/600x600/coral/white?text=Custom+Mug', alt: 'Custom Mug' }
            ],
            avg_rating: 4.8,
            review_count: 156,
          },
          {
            title: 'Canvas Poster',
            description: 'High-quality canvas print for your wall',
            category: 'Home & Living',
            tags: ['poster', 'canvas', 'art'],
            base_price_cents: 2999,
            currency: 'usd',
            status: 'active',
            images: [
              { url: 'https://placehold.co/600x600/indigo/white?text=Canvas+Poster', alt: 'Canvas Poster' }
            ],
            avg_rating: 4.7,
            review_count: 89,
          },
          {
            title: 'Phone Case',
            description: 'Protective phone case with custom design',
            category: 'Accessories',
            tags: ['phone', 'case', 'protection'],
            base_price_cents: 1299,
            currency: 'usd',
            status: 'active',
            images: [
              { url: 'https://placehold.co/600x600/violet/white?text=Phone+Case', alt: 'Phone Case' }
            ],
            avg_rating: 4.3,
            review_count: 42,
          },
          {
            title: 'Tote Bag',
            description: 'Eco-friendly tote bag for your daily errands',
            category: 'Accessories',
            tags: ['bag', 'tote', 'eco-friendly'],
            base_price_cents: 1799,
            currency: 'usd',
            status: 'active',
            images: [
              { url: 'https://placehold.co/600x600/emerald/white?text=Tote+Bag', alt: 'Tote Bag' }
            ],
            avg_rating: 4.6,
            review_count: 67,
          },
        ])
        .select()

      if (productsError) {
        console.error('❌ Error creating products:', productsError)
      } else {
        products = newProducts || []
        console.log(`✓ ${products.length} products created`)
      }
    }

    // 4. Create product variants for the first product (if exists)
    if (products && products.length > 0) {
      const firstProduct = products[0]

      // Check if variants already exist
      const { count: variantCount } = await supabase
        .from('product_variants')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', firstProduct.id)

      if (variantCount && variantCount > 0) {
        console.log(`✓ Product variants already exist (${variantCount} found), skipping insert`)
      } else {
        console.log('Creating product variants...')
        const { data: variants, error: variantsError } = await supabase
          .from('product_variants')
          .insert([
            {
              product_id: firstProduct.id,
              title: 'Small / Black',
              size: 'S',
              color: 'Black',
              price_cents: 1999,
              sku: `TSHIRT-S-BLK-${firstProduct.id.substring(0, 8)}`,
              is_enabled: true,
              is_available: true,
            },
            {
              product_id: firstProduct.id,
              title: 'Medium / Black',
              size: 'M',
              color: 'Black',
              price_cents: 1999,
              sku: `TSHIRT-M-BLK-${firstProduct.id.substring(0, 8)}`,
              is_enabled: true,
              is_available: true,
            },
            {
              product_id: firstProduct.id,
              title: 'Large / White',
              size: 'L',
              color: 'White',
              price_cents: 1999,
              sku: `TSHIRT-L-WHT-${firstProduct.id.substring(0, 8)}`,
              is_enabled: true,
              is_available: true,
            },
          ])
          .select()

        if (variantsError) {
          console.error('❌ Error creating product variants:', variantsError)
        } else {
          console.log(`✓ ${variants?.length || 3} product variants created`)
        }
      }
    }

    console.log('\n✅ Database seeding completed successfully!')
  } catch (error) {
    console.error('\n❌ Seed script failed:', error)
    process.exit(1)
  }
}

// Run the seed function
seedDatabase()
