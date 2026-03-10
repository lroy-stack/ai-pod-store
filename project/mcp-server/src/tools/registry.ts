import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { ZodObject } from 'zod';
import { withAuditLog } from '../lib/audit-log.js';
import { createToolResponse } from '../lib/response.js';
import { withAuth, type AuthLevel } from '../middleware/auth.js';

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
  handler: (input: any, authInfo?: AuthInfo) => Promise<any>;
}

/**
 * All 17 tool definitions
 */
const toolDefinitions: ToolDefinition[] = [
  // === PUBLIC TOOLS (no auth required) ===
  {
    name: 'search_products',
    title: 'Search Products',
    description: 'Search for products in the store catalog by title, description, or category',
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
    description: 'List all product categories with product counts. Useful for browsing the store without a search query.',
    inputSchema: listCategoriesSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
    auth: 'none',
    handler: (input) => listCategories(input),
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
    handler: (input, authInfo) => updateCart(input, authInfo),
  },
  {
    name: 'create_checkout',
    title: 'Create Checkout',
    description: "Create a Stripe Checkout Session for cart items and return the checkout URL. NEVER processes payment directly.",
    inputSchema: createCheckoutSchema,
    annotations: { readOnlyHint: true, idempotentHint: false, destructiveHint: false, openWorldHint: true },
    auth: 'required',
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
    handler: (input, authInfo) => addToWishlist(input, authInfo),
  },
  {
    name: 'remove_from_wishlist',
    title: 'Remove from Wishlist',
    description: "Remove a product (and optionally a variant) from the authenticated user's default wishlist",
    inputSchema: removeFromWishlistSchema,
    annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: true, openWorldHint: false },
    auth: 'required',
    handler: (input, authInfo) => removeFromWishlist(input, authInfo),
  },
];

/**
 * Register all tools on the MCP server using the registry pattern.
 * Applies withAuth() + withAuditLog() + createToolResponse() wrappers.
 */
export function registerAllTools(server: McpServer): number {
  for (const tool of toolDefinitions) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        title: tool.title,
        annotations: tool.annotations,
      },
      withAuth(
        tool.auth,
        withAuditLog(tool.name, async (input: any, extra?: { authInfo?: AuthInfo }) => {
          const result = await tool.handler(input, extra?.authInfo);
          return createToolResponse(result);
        })
      )
    );
  }
  return toolDefinitions.length;
}

export { toolDefinitions };
