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
}

/**
 * Get artifact component for a tool name
 */
export function getArtifact(toolName: string): ArtifactRegistryEntry | null {
  return artifactRegistry[toolName] || null
}
