/**
 * Artifact Registry - Maps tool names to artifact components
 *
 * Used by ChatArea to render tool-invocation results inline in chat messages
 *
 * Pattern:
 * - Each tool that produces a visual artifact has an entry here
 * - Each entry includes: Component (full result), Skeleton (loading state)
 * - ChatArea uses message.parts.map() to render artifacts
 */

import { ProductGridArtifact, ProductGridSkeleton } from './ProductGridArtifact'
import { ProductDetailArtifact, ProductDetailSkeleton } from './ProductDetailArtifact'
import { ComparisonTableArtifact, ComparisonTableSkeleton } from './ComparisonTableArtifact'
import { SizeGuideArtifact, SizeGuideSkeleton } from './SizeGuideArtifact'
import { CartSummaryArtifact, CartSummarySkeleton } from './CartSummaryArtifact'
import { PricingTableArtifact, PricingTableSkeleton } from './PricingTableArtifact'
import { ApprovalCardArtifact, ApprovalCardSkeleton } from './ApprovalCardArtifact'
import { OrderTimelineArtifact, OrderTimelineSkeleton } from './OrderTimelineArtifact'
import { OrderListArtifact, OrderListSkeleton } from './OrderListArtifact'
import { ReturnRequestArtifact, ReturnRequestSkeleton } from './ReturnRequestArtifact'
import { DesignPreviewArtifact, DesignPreviewSkeleton } from './DesignPreviewArtifact'
import { ProductMockupArtifact, ProductMockupSkeleton } from './ProductMockupArtifact'

export interface ArtifactRegistryEntry {
  Component: React.ComponentType<any>
  Skeleton: React.ComponentType<any>
}

export const artifactRegistry: Record<string, ArtifactRegistryEntry> = {
  product_search: {
    Component: ProductGridArtifact,
    Skeleton: ProductGridSkeleton,
  },
  browse_catalog: {
    Component: ProductGridArtifact,
    Skeleton: ProductGridSkeleton,
  },
  get_recommendations: {
    Component: ProductGridArtifact,
    Skeleton: ProductGridSkeleton,
  },
  get_product_detail: {
    Component: ProductDetailArtifact,
    Skeleton: ProductDetailSkeleton,
  },
  compare_products: {
    Component: ComparisonTableArtifact,
    Skeleton: ComparisonTableSkeleton,
  },
  get_size_guide: {
    Component: SizeGuideArtifact,
    Skeleton: SizeGuideSkeleton,
  },
  get_cart: {
    Component: CartSummaryArtifact,
    Skeleton: CartSummarySkeleton,
  },
  estimate_shipping: {
    Component: PricingTableArtifact,
    Skeleton: PricingTableSkeleton,
  },
  create_checkout: {
    Component: ApprovalCardArtifact,
    Skeleton: ApprovalCardSkeleton,
  },
  track_order: {
    Component: OrderTimelineArtifact,
    Skeleton: OrderTimelineSkeleton,
  },
  get_order_history: {
    Component: OrderListArtifact,
    Skeleton: OrderListSkeleton,
  },
  request_return: {
    Component: ReturnRequestArtifact,
    Skeleton: ReturnRequestSkeleton,
  },
  generate_design: {
    Component: DesignPreviewArtifact,
    Skeleton: DesignPreviewSkeleton,
  },
  customize_design: {
    Component: DesignPreviewArtifact,
    Skeleton: DesignPreviewSkeleton,
  },
  remove_background: {
    Component: DesignPreviewArtifact,
    Skeleton: DesignPreviewSkeleton,
  },
  ai_design_generate: {
    Component: DesignPreviewArtifact,
    Skeleton: DesignPreviewSkeleton,
  },
  apply_design_to_product: {
    Component: ProductMockupArtifact,
    Skeleton: ProductMockupSkeleton,
  },
}

/**
 * Get artifact component for a tool name
 */
export function getArtifact(toolName: string): ArtifactRegistryEntry | null {
  return artifactRegistry[toolName] || null
}
