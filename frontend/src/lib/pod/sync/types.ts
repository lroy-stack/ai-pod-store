/**
 * Sync engine types — provider-agnostic sync result and report models.
 */

export interface SyncResult {
  action: 'created' | 'updated' | 'skipped'
  providerProductId: string
  error?: string
}

export interface SyncReport {
  providerTotal: number
  supabaseTotal: number
  created: number
  updated: number
  deleted: number
  marginFixed: number
  errors: string[]
  startedAt: string
  completedAt: string
  durationMs: number
}

export interface SyncOptions {
  /** Margin threshold. Default: 0.35 */
  marginThreshold?: number
}
