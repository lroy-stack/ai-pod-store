/**
 * Zustand store for Design Studio V2 state management.
 * Manages tool selection, object selection, canvas dirty state, history flags,
 * multi-panel state, and layers.
 */

import { create } from 'zustand'

export type DesignTool = 'select' | 'text' | 'image' | 'layers' | 'templates' | 'clipart' | 'my-designs'

export interface SelectedObjectInfo {
  type: 'text' | 'image'
  id: string
  // Text properties
  text?: string
  fontFamily?: string
  fontSize?: number
  fill?: string
  textAlign?: string
  fontWeight?: string
  fontStyle?: string
  // Text effects
  shadow?: { color: string; blur: number; offsetX: number; offsetY: number } | null
  stroke?: string
  strokeWidth?: number
  // Gradient info
  fillMode?: 'solid' | 'linear' | 'radial'
  gradientStartColor?: string
  gradientEndColor?: string
  gradientAngle?: number
  // Image properties
  src?: string
  // Opacity
  opacity?: number
  // Transform properties
  left: number
  top: number
  width: number
  height: number
  angle: number
  scaleX: number
  scaleY: number
}

export interface LayerInfo {
  id: string
  type: string
  name: string
  visible: boolean
  locked: boolean
}

interface PanelState {
  fabricJson: object | null
  isDirty: boolean
  compositionId: string | null
  productionDataUrl?: string | null
}

interface ProductInfo {
  id: string
  title: string
  category: string
  image: string
  basePriceCents: number
  productType: string
}

interface DesignEditorState {
  // Product context
  productId: string
  productTitle: string
  productCategory: string
  productImage: string
  productType: string
  basePriceCents: number

  // Garment color
  variantColor: string

  // Tool state
  activeTool: DesignTool

  // Selection
  selectedObject: SelectedObjectInfo | null

  // Canvas state
  isDirty: boolean
  compositionId: string | null
  isSaving: boolean

  // History
  canUndo: boolean
  canRedo: boolean

  // Auto-save
  lastSavedAt: number | null

  // Print area validation
  printAreaWarning: string | null

  // Zoom
  zoomLevel: number

  // Multi-panel
  activePanel: string
  availablePanels: string[]
  panelStates: Record<string, PanelState>

  // Layers
  layers: LayerInfo[]

  // Actions
  setActiveTool: (tool: DesignTool) => void
  setSelectedObject: (obj: SelectedObjectInfo | null) => void
  setDirty: (dirty: boolean) => void
  setCompositionId: (id: string | null) => void
  setSaving: (saving: boolean) => void
  setHistoryState: (canUndo: boolean, canRedo: boolean) => void
  setLastSavedAt: (timestamp: number | null) => void
  setPrintAreaWarning: (warning: string | null) => void
  setZoomLevel: (zoom: number) => void
  setVariantColor: (color: string) => void
  setActivePanel: (panel: string) => void
  setAvailablePanels: (panels: string[]) => void
  setPanelState: (panel: string, state: Partial<PanelState>) => void
  setLayers: (layers: LayerInfo[]) => void
  initProduct: (product: ProductInfo) => void
  reset: () => void
}

const initialState = {
  productId: '',
  productTitle: '',
  productCategory: '',
  productImage: '',
  productType: 'tshirt',
  basePriceCents: 0,
  variantColor: 'white',
  activeTool: 'select' as DesignTool,
  selectedObject: null,
  isDirty: false,
  compositionId: null,
  isSaving: false,
  canUndo: false,
  canRedo: false,
  lastSavedAt: null,
  printAreaWarning: null,
  zoomLevel: 1,
  activePanel: 'front',
  availablePanels: ['front'],
  panelStates: {} as Record<string, PanelState>,
  layers: [] as LayerInfo[],
}

export const useDesignEditor = create<DesignEditorState>((set) => ({
  ...initialState,

  setActiveTool: (tool) => set({ activeTool: tool }),

  setSelectedObject: (obj) => set({ selectedObject: obj }),

  setDirty: (dirty) => set({ isDirty: dirty }),

  setCompositionId: (id) => set({ compositionId: id }),

  setSaving: (saving) => set({ isSaving: saving }),

  setHistoryState: (canUndo, canRedo) => set({ canUndo, canRedo }),

  setLastSavedAt: (timestamp) => set({ lastSavedAt: timestamp }),

  setPrintAreaWarning: (warning) => set({ printAreaWarning: warning }),

  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

  setVariantColor: (color) => set({ variantColor: color }),

  setActivePanel: (panel) => set({ activePanel: panel }),

  setAvailablePanels: (panels) => set({ availablePanels: panels }),

  setPanelState: (panel, state) => set((prev) => ({
    panelStates: {
      ...prev.panelStates,
      [panel]: { ...prev.panelStates[panel], ...state } as PanelState,
    },
  })),

  setLayers: (layers) => set({ layers }),

  initProduct: (product) => set({
    productId: product.id,
    productTitle: product.title,
    productCategory: product.category,
    productImage: product.image,
    productType: product.productType,
    basePriceCents: product.basePriceCents,
  }),

  reset: () => set(initialState),
}))
