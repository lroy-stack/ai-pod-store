import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { ZodObject } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { requiredEnv } from '../lib/env.js';
import { withAuditLog } from '../lib/audit-log.js';
import { createToolResponse } from '../lib/response.js';
import { withAuth, type AuthLevel } from '../middleware/auth.js';
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';

// Import all tools
import { searchProductsSchema, searchProducts } from './search-products.js';
import { getProductDetailsSchema, getProductDetails } from './get-product-details.js';
import { getStoreInfoSchema, getStoreInfo } from './get-store-info.js';
import { getStorePoliciesSchema, getStorePolicies } from './get-store-policies.js';
import { getMyProfileSchema, getMyProfile } from './get-my-profile.js';
import { updateMyProfileSchema, updateMyProfile } from './update-my-profile.js';
import { listMyOrdersSchema, listMyOrders } from './list-my-orders.js';
import { getOrderStatusSchema, getOrderStatus } from './get-order-status.js';
import { trackShipmentSchema, trackShipment } from './track-shipment.js';
import { getCartSchema, getCart } from './get-cart.js';
import { updateCartSchema, updateCart } from './update-cart.js';
import { createCheckoutSchema, createCheckout } from './create-checkout.js';
import { listWishlistSchema, listWishlist } from './list-wishlist.js';
import { addToWishlistSchema, addToWishlist } from './add-to-wishlist.js';
import { removeFromWishlistSchema, removeFromWishlist } from './remove-from-wishlist.js';
import { listCategoriesSchema, listCategories } from './list-categories.js';
import { getProductReviewsSchema, getProductReviews } from './get-product-reviews.js';

// New tools — Block 1: Public
import { getTrendingProductsSchema, getTrendingProducts } from './get-trending-products.js';
import { getCrossSellSchema, getCrossSell } from './get-cross-sell.js';
import { estimateShippingSchema, estimateShipping } from './estimate-shipping.js';
import { validateCouponSchema, validateCoupon } from './validate-coupon.js';
import { subscribeNewsletterSchema, subscribeNewsletter } from './subscribe-newsletter.js';
// New tools — Block 2: Orders
import { requestReturnSchema, requestReturn } from './request-return.js';
import { getReturnStatusSchema, getReturnStatus } from './get-return-status.js';
import { reorderSchema, reorder } from './reorder.js';
// New tools — Block 3: Addresses
import { listShippingAddressesSchema, listShippingAddresses } from './list-shipping-addresses.js';
import { manageShippingAddressSchema, manageShippingAddress } from './manage-shipping-address.js';
// New tools — Block 4: Notifications
import { listNotificationsSchema, listNotifications } from './list-notifications.js';
import { markNotificationsReadSchema, markNotificationsRead } from './mark-notifications-read.js';
// New tools — Block 5: Reviews, Cart, Wishlist
import { submitReviewSchema, submitReview } from './submit-review.js';
import { clearCartSchema, clearCart } from './clear-cart.js';
import { getSharedWishlistSchema, getSharedWishlist } from './get-shared-wishlist.js';
// New tools — Block 6: Design Studio (MCP-exclusive)
import { saveDesignSchema, saveDesign } from './save-design.js';
import { getMyDesignsSchema, getMyDesigns } from './get-my-designs.js';
// New tools — Block 7: Category browsing
import { browseByCategorySchema, browseByCategory } from './browse-by-category.js';

/**
 * Tool annotation hints for MCP clients
 */
interface ToolAnnotations {
  readOnlyHint?: boolean;
  idempotentHint?: boolean;
  destructiveHint?: boolean;
  openWorldHint?: boolean;
}

/**
 * Tool definition for the registry
 */
export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodObject<any>;
  annotations: ToolAnnotations;
  auth: AuthLevel;
  /** JWT scopes required to call this tool (e.g. ['write'] for mutating tools) */
  scopes?: string[];
  handler: (input: any, authInfo?: AuthInfo) => Promise<any>;
}

/**
 * All 32 tool definitions
 */
const toolDefinitions: ToolDefinition[] = [
  // === PUBLIC TOOLS (no auth required) ===
  {
    name: 'search_products',
    title: 'Search Products',
    description: 'Search products by name or description. Query MUST be in English — translate user input first. Supports optional category filter (slug from list_categories). If 0 results, returns suggested categories. For browsing by type (e.g. user says "gorras", "hoodies"), prefer browse_by_category with the right slug instead.',
    inputSchema: searchProductsSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'none',

    handler: (input) => searchProducts(input),
  },
  {
    name: 'get_product_details',
    title: 'Get Product Details',
    description: 'Get detailed information about a specific product, including variants, images, and pricing',
    inputSchema: getProductDetailsSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'none',

    handler: (input) => getProductDetails(input),
  },
  {
    name: 'get_store_info',
    title: 'Get Store Info',
    description: 'Get general information about the store, including name, description, supported currencies, and features',
    inputSchema: getStoreInfoSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'none',
    handler: (input) => getStoreInfo(input),
  },
  {
    name: 'get_store_policies',
    title: 'Get Store Policies',
    description: 'Get store policies including shipping, returns/refunds, and privacy information',
    inputSchema: getStorePoliciesSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'none',
    handler: (input) => getStorePolicies(input),
  },
  {
    name: 'list_categories',
    title: 'List Categories',
    description: 'List all product categories with product counts, localized names, and parent/child hierarchy. Call this FIRST when user asks for products by type. Categories have hierarchy: use PARENT slugs (e.g. "headwear", "hoodies-sweatshirts", "t-shirts") with browse_by_category to get ALL products of that type in one call. Child categories (e.g. "snapbacks", "beanies") return subsets.',
    inputSchema: listCategoriesSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'none',
    handler: (input) => listCategories(input),
  },
  {
    name: 'browse_by_category',
    title: 'Browse Products by Category',
    description: 'Browse products by category slug. Use PARENT slugs to get all products of a type in ONE call (e.g. "headwear" returns all caps+beanies+snapbacks, "hoodies-sweatshirts" returns all hoodies+crewnecks). Call list_categories first to see available parent slugs. Supports sorting by price, rating, or newest.',
    inputSchema: browseByCategorySchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'none',
    handler: (input) => browseByCategory(input),
  },
  {
    name: 'get_product_reviews',
    title: 'Get Product Reviews',
    description: 'Get reviews for a product. Returns paginated list of reviews with rating, text, and author name.',
    inputSchema: getProductReviewsSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'none',
    handler: (input) => getProductReviews(input),
  },
  {
    name: 'get_trending_products',
    title: 'Get Trending Products',
    description: 'Get trending products based on 7-day weighted score (views, sales, reviews). Great for homepage recommendations.',
    inputSchema: getTrendingProductsSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'none',

    handler: (input) => getTrendingProducts(input),
  },
  {
    name: 'get_cross_sell',
    title: 'Get Cross-Sell Recommendations',
    description: 'Get product recommendations based on cross-sell rules or same-category products. Useful for "You may also like" suggestions.',
    inputSchema: getCrossSellSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'none',

    handler: (input) => getCrossSell(input),
  },
  {
    name: 'estimate_shipping',
    title: 'Estimate Shipping',
    description: 'Estimate shipping cost and delivery time for a given country, zip code, and cart total. Shows free shipping eligibility.',
    inputSchema: estimateShippingSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'none',
    handler: (input) => estimateShipping(input),
  },
  {
    name: 'validate_coupon',
    title: 'Validate Coupon',
    description: 'Validate a coupon code and calculate the discount amount for a given cart total. Returns discount details if valid.',
    inputSchema: validateCouponSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'none',
    handler: (input) => validateCoupon(input),
  },
  {
    name: 'subscribe_newsletter',
    title: 'Subscribe to Newsletter',
    description: 'Subscribe an email address to the store newsletter. Supports English, Spanish, and German.',
    inputSchema: subscribeNewsletterSchema,
    annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
    auth: 'none',
    handler: (input) => subscribeNewsletter(input),
  },
  {
    name: 'get_shared_wishlist',
    title: 'Get Shared Wishlist',
    description: 'View a shared wishlist by its share token. Returns wishlist items with product details. No authentication needed.',
    inputSchema: getSharedWishlistSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'none',

    handler: (input) => getSharedWishlist(input),
  },

  // === PROTECTED TOOLS (auth required) ===
  {
    name: 'get_my_profile',
    title: 'Get My Profile',
    description: "Get the authenticated user's profile information including name, email, locale, and currency preferences",
    inputSchema: getMyProfileSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'required',
    handler: (input, authInfo) => getMyProfile(input, authInfo),
  },
  {
    name: 'update_my_profile',
    title: 'Update My Profile',
    description: "Update the authenticated user's profile information (name, locale). Uses context injection - userId comes from auth token.",
    inputSchema: updateMyProfileSchema,
    annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    auth: 'required',
    handler: (input, authInfo) => updateMyProfile(input, authInfo),
  },
  {
    name: 'list_my_orders',
    title: 'List My Orders',
    description: "Get the authenticated user's order history with optional filters for status and limit",
    inputSchema: listMyOrdersSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'required',
    handler: (input, authInfo) => listMyOrders(input, authInfo),
  },
  {
    name: 'get_order_status',
    title: 'Get Order Status',
    description: 'Get detailed information about a specific order by ID, including status and line items.',
    inputSchema: getOrderStatusSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'required',
    handler: (input, authInfo) => getOrderStatus(input, authInfo),
  },
  {
    name: 'track_shipment',
    title: 'Track Shipment',
    description: 'Get shipment tracking information for a specific order by ID. Returns tracking number, carrier, estimated delivery.',
    inputSchema: trackShipmentSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: true },
    auth: 'required',
    handler: (input, authInfo) => trackShipment(input, authInfo),
  },
  {
    name: 'get_cart',
    title: 'Get Cart',
    description: "Get the authenticated user's current shopping cart contents, including product details, quantities, and prices",
    inputSchema: getCartSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'required',

    handler: (input, authInfo) => getCart(input, authInfo),
  },
  {
    name: 'update_cart',
    title: 'Update Cart',
    description: 'Add, update, or remove items from the shopping cart. Set quantity > 0 to add/update, or quantity = 0 to remove.',
    inputSchema: updateCartSchema,
    annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
    auth: 'required',
    scopes: ['write'],
    handler: (input, authInfo) => updateCart(input, authInfo),
  },
  {
    name: 'create_checkout',
    title: 'Create Checkout',
    description: "Create a Stripe Checkout Session for cart items and return the checkout URL. NEVER processes payment directly.",
    inputSchema: createCheckoutSchema,
    annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },
    auth: 'required',
    scopes: ['write'],
    handler: (input, authInfo) => createCheckout(input, authInfo),
  },
  {
    name: 'list_wishlist',
    title: 'List Wishlist',
    description: "List all items in the authenticated user's default wishlist with product details",
    inputSchema: listWishlistSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'required',

    handler: (input, authInfo) => listWishlist(input, authInfo),
  },
  {
    name: 'add_to_wishlist',
    title: 'Add to Wishlist',
    description: "Add a product (and optionally a variant) to the authenticated user's default wishlist",
    inputSchema: addToWishlistSchema,
    annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
    auth: 'required',
    scopes: ['write'],
    handler: (input, authInfo) => addToWishlist(input, authInfo),
  },
  {
    name: 'remove_from_wishlist',
    title: 'Remove from Wishlist',
    description: "Remove a product (and optionally a variant) from the authenticated user's default wishlist",
    inputSchema: removeFromWishlistSchema,
    annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: true, openWorldHint: false },
    auth: 'required',
    scopes: ['write'],
    handler: (input, authInfo) => removeFromWishlist(input, authInfo),
  },

  // === NEW PROTECTED TOOLS ===
  {
    name: 'request_return',
    title: 'Request Return',
    description: 'Submit a return request for a delivered or shipped order. Validates order ownership and eligibility.',
    inputSchema: requestReturnSchema,
    annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
    auth: 'required',
    scopes: ['write'],
    handler: (input, authInfo) => requestReturn(input, authInfo),
  },
  {
    name: 'get_return_status',
    title: 'Get Return Status',
    description: 'Get the status of a return request for a specific order. Shows reason, admin notes, and current status.',
    inputSchema: getReturnStatusSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'required',
    handler: (input, authInfo) => getReturnStatus(input, authInfo),
  },
  {
    name: 'reorder',
    title: 'Reorder',
    description: 'Copy items from a past order into the current cart. Merges with existing cart items and caps quantity at 10.',
    inputSchema: reorderSchema,
    annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
    auth: 'required',
    scopes: ['write'],
    handler: (input, authInfo) => reorder(input, authInfo),
  },
  {
    name: 'list_shipping_addresses',
    title: 'List Shipping Addresses',
    description: "List the authenticated user's saved shipping addresses, ordered by default first.",
    inputSchema: listShippingAddressesSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'required',
    handler: (input, authInfo) => listShippingAddresses(input, authInfo),
  },
  {
    name: 'manage_shipping_address',
    title: 'Manage Shipping Address',
    description: 'Create, update, or delete a shipping address. For create: full_name, street_line1, city, postal_code, country_code are required.',
    inputSchema: manageShippingAddressSchema,
    annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    auth: 'required',
    scopes: ['write'],
    handler: (input, authInfo) => manageShippingAddress(input, authInfo),
  },
  {
    name: 'list_notifications',
    title: 'List Notifications',
    description: "List the authenticated user's notifications with unread count. Supports pagination.",
    inputSchema: listNotificationsSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'required',
    handler: (input, authInfo) => listNotifications(input, authInfo),
  },
  {
    name: 'mark_notifications_read',
    title: 'Mark Notifications Read',
    description: 'Mark a specific notification or all notifications as read. Omit notification_id to mark all.',
    inputSchema: markNotificationsReadSchema,
    annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'required',
    scopes: ['write'],
    handler: (input, authInfo) => markNotificationsRead(input, authInfo),
  },
  {
    name: 'submit_review',
    title: 'Submit Review',
    description: 'Submit a product review with rating and comment. Verifies purchase history. Reviews start in pending status.',
    inputSchema: submitReviewSchema,
    annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
    auth: 'required',
    scopes: ['write'],
    handler: (input, authInfo) => submitReview(input, authInfo),
  },
  {
    name: 'clear_cart',
    title: 'Clear Cart',
    description: "Remove all items from the authenticated user's shopping cart.",
    inputSchema: clearCartSchema,
    annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    auth: 'required',
    scopes: ['write'],
    handler: (input, authInfo) => clearCart(input, authInfo),
  },

  // === DESIGN STUDIO TOOLS (MCP-exclusive) ===
  {
    name: 'save_design',
    title: 'Save Design',
    description: 'Save an image (from a URL) as a design in your store portfolio. Downloads the image, persists it to storage, and creates a design record. Use this after generating an image with DALL-E, Midjourney, or any other tool.',
    inputSchema: saveDesignSchema,
    annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
    auth: 'required',
    scopes: ['write'],
    handler: (input, authInfo) => saveDesign(input, authInfo),
  },
  {
    name: 'get_my_designs',
    title: 'Get My Designs',
    description: "List the authenticated user's saved designs with pagination. Shows prompt, style, image URL, and moderation status.",
    inputSchema: getMyDesignsSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'required',

    handler: (input, authInfo) => getMyDesigns(input, authInfo),
  },
];

/** CSP for store UI widgets — allows loading images from the store API domain */
const STORE_UI_CSP = {
  resourceDomains: [process.env.NEXT_PUBLIC_API_BASE_URL || ''],
};

/** Map tool names to their UI widget bundle filename */
const TOOL_UI_MAP: Record<string, string> = {
  search_products: 'product-grid',
  get_product_details: 'product-detail',
  get_trending_products: 'product-grid',
  get_cross_sell: 'product-grid',
  browse_by_category: 'product-grid',
  get_cart: 'cart-view',
  list_wishlist: 'product-grid',
  get_shared_wishlist: 'product-grid',
  get_my_designs: 'product-grid',
};

/**
 * Register all tools on the MCP server using the registry pattern.
 * Tools with UI use registerAppTool() for MCP Apps (interactive widgets with images).
 * Tools without UI use standard registerTool() with withAuth + withAuditLog wrappers.
 */
export function registerAllTools(server: McpServer): number {
  const registeredResources = new Set<string>();

  for (const tool of toolDefinitions) {
    const uiWidget = TOOL_UI_MAP[tool.name];

    const wrappedHandler = withAuth(
      tool.auth,
      withAuditLog(tool.name, async (input: any, extra?: { authInfo?: AuthInfo }) => {
        const result = await tool.handler(input, extra?.authInfo);
        return createToolResponse(result);
      }),
      tool.scopes,
    );

    if (uiWidget) {
      const resourceUri = `ui://${requiredEnv('STORE_DOMAIN')}/${uiWidget}.html`;

      registerAppTool(server, tool.name, {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        _meta: {
          ui: {
            resourceUri,
            csp: STORE_UI_CSP,
          },
        },
      }, wrappedHandler);

      if (!registeredResources.has(resourceUri)) {
        registeredResources.add(resourceUri);
        registerAppResource(server, resourceUri, resourceUri,
          {},
          async () => {
            const htmlPath = path.join(import.meta.dirname, '../../dist/uis/uis', uiWidget, 'index.html');
            const html = await fs.readFile(htmlPath, 'utf-8');
            return {
              contents: [{
                uri: resourceUri,
                mimeType: RESOURCE_MIME_TYPE,
                text: html,
                _meta: {
                  ui: {
                    csp: STORE_UI_CSP,
                  },
                },
              }],
            };
          },
        );
      }
    } else {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputSchema,
          title: tool.title,
          annotations: tool.annotations,
        },
        wrappedHandler,
      );
    }
  }
  return toolDefinitions.length;
}

export { toolDefinitions };
