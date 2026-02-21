/**
 * Stripe Checkout Session Creation API
 *
 * POST /api/checkout/create-session
 * Creates a Stripe Checkout session for payment processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { printify } from '@/lib/printify';
import { STORE_DEFAULTS, ALLOWED_SHIPPING_COUNTRIES } from '@/lib/store-config';
import { createCanvas, registerFont } from 'canvas';
import path from 'path';
import fs from 'fs';

// Font mapping for personalization
const FONT_FILES: Record<string, string> = {
  'Inter': 'Inter-Regular.ttf',
  'Roboto': 'Roboto-Regular.ttf',
  'Playfair Display': 'PlayfairDisplay-Regular.ttf',
  'Montserrat': 'Montserrat-Regular.ttf',
  'Oswald': 'Oswald-Regular.ttf',
  'Lato': 'Lato-Regular.ttf',
};

// Register all fonts once at module load
Object.entries(FONT_FILES).forEach(([fontName, fileName]) => {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
  if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: fontName });
  }
});

/**
 * Generate a high-resolution PNG with personalization text
 * Returns base64 string (without data:image/png;base64, prefix)
 */
function generatePersonalizationPNG(
  text: string,
  font: string,
  fontSize: number,
  fontColor: string,
  width: number,
  height: number
): string {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, width, height);

  // Set font properties
  const selectedFont = FONT_FILES[font] ? font : 'Inter';
  ctx.font = `${fontSize}px "${selectedFont}"`;
  ctx.fillStyle = fontColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Render multi-line text
  const lineHeight = fontSize * 1.3;
  const textLines = text.split('\n');
  const totalHeight = textLines.length * lineHeight;
  const startY = (height / 2) - (totalHeight / 2) + (lineHeight / 2);

  textLines.forEach((line, index) => {
    const y = startY + (index * lineHeight);
    ctx.fillText(line, width / 2, y);
  });

  // Convert to base64 (without data URL prefix)
  const buffer = canvas.toBuffer('image/png');
  return buffer.toString('base64');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cartItems, shippingAddress, locale = 'en', currency = STORE_DEFAULTS.stripeCurrency, customerEmail, gift_message } = body;

    // Validate required fields
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json(
        { error: 'Cart items are required' },
        { status: 400 }
      );
    }

    // Stock validation: check variant availability before creating payment session
    const productIds = [...new Set(cartItems.map((item: any) => item.product_id).filter(Boolean))];
    if (productIds.length > 0) {
      const { data: variants } = await supabaseAdmin
        .from('product_variants')
        .select('product_id, color, size, is_available')
        .in('product_id', productIds)
        .eq('is_enabled', true);

      const unavailableItems: Array<{ productId: string; color?: string; size?: string; name?: string }> = [];

      for (const item of cartItems) {
        if (!item.product_id) continue;
        const itemColor = item.variant_details?.color || item.color;
        const itemSize = item.variant_details?.size || item.size;

        // Find matching variant
        const matchingVariant = variants?.find(v =>
          v.product_id === item.product_id &&
          (!itemColor || v.color === itemColor) &&
          (!itemSize || v.size === itemSize)
        );

        // If no variant found or variant is unavailable
        if (!matchingVariant || !matchingVariant.is_available) {
          unavailableItems.push({
            productId: item.product_id,
            color: itemColor,
            size: itemSize,
            name: item.product_name || item.name,
          });
        }
      }

      if (unavailableItems.length > 0) {
        return NextResponse.json(
          {
            error: 'ITEMS_UNAVAILABLE',
            unavailableItems,
          },
          { status: 409 }
        );
      }
    }

    // --- Personalization: create Printify temp products for personalized items ---
    const yMap: Record<string, number> = { top: 0.15, center: 0.5, bottom: 0.85 }
    const sizeMap: Record<string, number> = { small: 72, medium: 96, large: 120 } // High-res sizes

    for (const item of cartItems) {
      const personalizationId = item.personalization_id
      if (!personalizationId) continue

      try {
        // Load personalization from DB
        const { data: pz } = await supabaseAdmin
          .from('personalizations')
          .select('*')
          .eq('id', personalizationId)
          .single()

        if (!pz || !pz.text_content) continue
        // Skip if already has a Printify temp product
        if (pz.printify_temp_product_id) continue

        // Load product from DB
        const { data: dbProduct } = await supabaseAdmin
          .from('products')
          .select('id, printify_id, blueprint_id, print_provider_id, title')
          .eq('id', pz.product_id)
          .single()

        if (!dbProduct?.printify_id || !dbProduct?.blueprint_id || !dbProduct?.print_provider_id) continue

        // Get original product from Printify
        const printifyProduct = await printify.getProduct(dbProduct.printify_id)
        const originalPrintAreas = (printifyProduct as any).print_areas || []

        // Get placeholder dimensions from the first front placeholder
        let placeholderWidth = 3000 // Default high-res width
        let placeholderHeight = 3000 // Default high-res height
        const frontPlaceholder = originalPrintAreas[0]?.placeholders?.find((p: any) => p.position === 'front')
        if (frontPlaceholder?.width && frontPlaceholder?.height) {
          placeholderWidth = frontPlaceholder.width
          placeholderHeight = frontPlaceholder.height
        }

        // Generate high-resolution PNG with personalization text
        const fontSize = sizeMap[pz.font_size || 'medium'] ?? 96
        const base64PNG = generatePersonalizationPNG(
          pz.text_content,
          pz.font_family || 'Inter',
          fontSize,
          pz.font_color || '#000000',
          placeholderWidth,
          placeholderHeight
        )

        // Upload PNG to Printify
        const uploadResult = await printify.uploadImageFromBase64(
          base64PNG,
          `personalization-${personalizationId}.png`
        )

        // Build modified print_areas with uploaded image
        const modifiedPrintAreas = originalPrintAreas.map((area: any) => {
          const modifiedPlaceholders = area.placeholders.map((placeholder: any) => {
            if (placeholder.position === 'front') {
              const images = [...(placeholder.images || [])]
              // Add personalization image overlay
              images.push({
                id: uploadResult.id, // Use upload_id from Printify
                x: 0.5,
                y: yMap[pz.position || 'bottom'] ?? 0.85,
                scale: 0.3,
                angle: 0,
                // DO NOT include input_text, font_family, font_size, font_color (READ-ONLY)
              })
              return { ...placeholder, images }
            }
            return placeholder
          })
          return { ...area, placeholders: modifiedPlaceholders }
        })

        // Get variants from original Printify product
        const originalVariants = (printifyProduct as any).variants || []
        const enabledVariants = originalVariants
          .filter((v: any) => v.is_enabled)
          .map((v: any) => ({ id: v.id, price: v.price, is_enabled: true }))

        // Create temp product in Printify
        const tempProduct = await printify.createProduct({
          title: `${dbProduct.title} (Personalized)`,
          description: `Personalized: ${pz.text_content}`,
          blueprint_id: dbProduct.blueprint_id,
          print_provider_id: dbProduct.print_provider_id,
          variants: enabledVariants,
          print_areas: modifiedPrintAreas,
          tags: ['personalized'],
        })

        // Update personalization record
        await supabaseAdmin
          .from('personalizations')
          .update({
            printify_temp_product_id: tempProduct.id,
            printify_upload_id: uploadResult.id,
            status: 'ready',
          })
          .eq('id', personalizationId)

        // Attach temp product ID to the cart item for order metadata
        item._printify_temp_id = tempProduct.id
      } catch (pzError) {
        console.error(`Personalization ${personalizationId} Printify creation failed:`, pzError)
        // Continue with checkout even if personalization fails
      }
    }

    // Create line items for Stripe Checkout
    const lineItems = cartItems.map((item: any) => {
      const productData: any = {
        name: item.product_name || item.name || 'Product',
      };

      if (item.variant_name) {
        productData.description = item.variant_name;
      }

      if (item.product_image && !item.product_image.includes('placeholder')) {
        productData.images = [item.product_image];
      }

      // Calculate unit amount including personalization surcharge
      const basePrice = item.product_price || 0;
      const personalizationSurcharge = item.personalization?.surcharge || 0;
      const totalUnitPrice = basePrice + personalizationSurcharge;

      return {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: productData,
          unit_amount: Math.round(totalUnitPrice * 100), // Convert to cents
        },
        quantity: item.quantity || 1,
      };
    });

    // Build success and cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const successUrl = `${baseUrl}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/${locale}/checkout/cancel`;

    // Create Stripe Checkout session
    const sessionConfig: any = {
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: locale === 'es' ? 'es' : locale === 'de' ? 'de' : 'en',
      currency: currency.toLowerCase(),
      // Automatic tax calculation (if Stripe Tax is enabled)
      automatic_tax: {
        enabled: false, // Disabled for now, will enable when Stripe Tax is activated
      },
      // Shipping address collection
      shipping_address_collection: shippingAddress
        ? undefined
        : {
            allowed_countries: ALLOWED_SHIPPING_COUNTRIES as unknown as string[],
          },
      // Pre-fill shipping address if provided
      ...(shippingAddress && {
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: {
                amount: 0, // Free shipping for now
                currency: currency.toLowerCase(),
              },
              display_name: 'Standard Shipping',
              delivery_estimate: {
                minimum: {
                  unit: 'business_day',
                  value: 5,
                },
                maximum: {
                  unit: 'business_day',
                  value: 7,
                },
              },
            },
          },
        ],
      }),
      metadata: {
        locale,
        cart_items: JSON.stringify(cartItems.map((item: any) => ({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: item.quantity,
          personalization_id: item.personalization_id || null,
          printify_temp_id: item._printify_temp_id || null,
        }))),
        ...(gift_message && typeof gift_message === 'string' && { gift_message: gift_message.slice(0, 200) }),
      },
    };

    // Add customer email for guest checkout
    if (customerEmail && typeof customerEmail === 'string') {
      sessionConfig.customer_email = customerEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Stripe session creation error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
