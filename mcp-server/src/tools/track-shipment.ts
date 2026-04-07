import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { userContent } from '../lib/product-helpers.js';

/**
 * MCP Tool: track_shipment
 *
 * Get shipment tracking information for a specific order.
 *
 * This is a PROTECTED tool — authentication required.
 * Returns 401 error if no valid Bearer token provided.
 * Returns 403 error if the order belongs to another user.
 */

export const trackShipmentSchema = z.object({
  order_id: z.string().uuid().describe('The UUID of the order to track'),
});

export type TrackShipmentInput = z.infer<typeof trackShipmentSchema>;

export interface ShipmentInfo {
  order_id: string;
  status: string;
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;
  shipped_at?: string;
  shipping_destination?: {
    city?: string;
    country?: string;
  };
}

export interface TrackShipmentResult {
  success: boolean;
  error?: string;
  shipment?: ShipmentInfo;
}

export async function trackShipment(
  input: TrackShipmentInput,
  authInfo?: AuthInfo
): Promise<TrackShipmentResult> {
  // Check authentication
  if (!authInfo || !authInfo.extra?.userId) {
    return {
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    };
  }

  const userId = authInfo.extra.userId as string;
  const { order_id } = input;

  try {
    const supabase = getSupabaseClient();

    // Fetch the order with tracking info (ownership enforced in query)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, status, tracking_number, tracking_url, carrier, shipped_at, shipping_address'
      )
      .eq('id', order_id)
      .eq('user_id', userId)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return {
          success: false,
          error: 'Order not found',
        };
      }
      console.error('[track_shipment] Database error:', orderError);
      return {
        success: false,
        error: 'Failed to fetch order',
      };
    }

    if (!orderData) {
      return {
        success: false,
        error: 'Order not found',
      };
    }

    // Check if order has been shipped
    if (!orderData.shipped_at && !orderData.tracking_number) {
      return {
        success: true,
        shipment: {
          order_id: orderData.id,
          status: orderData.status,
        },
      };
    }

    // Parse shipping destination (city + country only — no PII)
    let shippingDestination: ShipmentInfo['shipping_destination'] | undefined;
    if (orderData.shipping_address && typeof orderData.shipping_address === 'object') {
      const addr = orderData.shipping_address as Record<string, unknown>;
      shippingDestination = {
        city: userContent(addr.city as string) || undefined,
        country: userContent(addr.country as string) || undefined,
      };
    }

    // Build shipment info
    const shipment: ShipmentInfo = {
      order_id: orderData.id,
      status: orderData.status,
      ...(orderData.tracking_number && { tracking_number: orderData.tracking_number }),
      ...(orderData.tracking_url && { tracking_url: orderData.tracking_url }),
      ...(orderData.carrier && { carrier: orderData.carrier }),
      ...(orderData.shipped_at && { shipped_at: orderData.shipped_at }),
      ...(shippingDestination && { shipping_destination: shippingDestination }),
    };

    return {
      success: true,
      shipment,
    };
  } catch (err) {
    console.error('[track_shipment] Unexpected error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
