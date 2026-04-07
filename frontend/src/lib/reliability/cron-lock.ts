/**
 * CronLockManager — Prevents overlapping cron job executions
 *
 * Uses PostgreSQL advisory locks to ensure only one instance of a cron job
 * runs at a time. Tracks execution in the cron_runs table.
 *
 * @module reliability/cron-lock
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

export interface AcquireLockResult {
  acquired: boolean
  runId?: string
  error?: string
}

export interface RecordRunResult {
  success: boolean
  runId?: string
  error?: string
}

/**
 * Acquire a cron job lock using PostgreSQL advisory locks
 *
 * @param cronName - Unique name of the cron job
 * @returns Promise<AcquireLockResult> - {acquired: true, runId} if lock acquired, {acquired: false} if already running
 *
 * @example
 * ```typescript
 * const lock = await acquireLock('zombie-reaper')
 * if (!lock.acquired) {
 *   console.log('Job already running, skipping')
 *   return
 * }
 * try {
 *   await executeCronJob()
 * } finally {
 *   await recordRun(cronName, 'completed', Date.now() - startTime)
 * }
 * ```
 */
export async function acquireLock(cronName: string): Promise<AcquireLockResult> {
  try {
    // Call the try_cron_lock PostgreSQL function
    const { data, error } = await supabaseAdmin.rpc('try_cron_lock', {
      p_cron_name: cronName,
    })

    if (error) {
      console.error(`[CronLockManager] Failed to acquire lock for ${cronName}:`, error)
      return {
        acquired: false,
        error: error.message,
      }
    }

    // data is a boolean: true if lock acquired, false if already held
    if (!data) {
      // Lock not acquired - another instance is running
      return {
        acquired: false,
      }
    }

    // Lock acquired - create a cron_runs record
    const { data: runData, error: runError } = await supabaseAdmin
      .from('cron_runs')
      .insert({
        cron_name: cronName,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (runError) {
      console.error(`[CronLockManager] Failed to create run record for ${cronName}:`, runError)
      // Lock was acquired but run record creation failed
      // The advisory lock will be released when the transaction ends
      return {
        acquired: true,
        error: runError.message,
      }
    }

    return {
      acquired: true,
      runId: runData.id,
    }
  } catch (err: any) {
    console.error(`[CronLockManager] Unexpected error acquiring lock for ${cronName}:`, err)
    return {
      acquired: false,
      error: err?.message || 'Unexpected error',
    }
  }
}

/**
 * Record the completion of a cron job run
 *
 * @param cronName - Name of the cron job
 * @param status - Final status: 'completed', 'failed', or 'skipped'
 * @param durationMs - Optional duration in milliseconds
 * @param errorMessage - Optional error message for failed runs
 * @param rowsAffected - Optional count of rows affected
 * @returns Promise<RecordRunResult> - {success: true} if recorded successfully
 *
 * @example
 * ```typescript
 * const startTime = Date.now()
 * try {
 *   const result = await executeCronJob()
 *   await recordRun('zombie-reaper', 'completed', Date.now() - startTime, undefined, result.count)
 * } catch (error) {
 *   await recordRun('zombie-reaper', 'failed', Date.now() - startTime, error.message)
 * }
 * ```
 */
export async function recordRun(
  cronName: string,
  status: 'completed' | 'failed' | 'skipped',
  durationMs?: number,
  errorMessage?: string,
  rowsAffected?: number
): Promise<RecordRunResult> {
  try {
    // Find the most recent running record for this cron job
    const { data: runningRun, error: findError } = await supabaseAdmin
      .from('cron_runs')
      .select('id')
      .eq('cron_name', cronName)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError) {
      console.error(`[CronLockManager] Error finding run record for ${cronName}:`, findError)
      return {
        success: false,
        error: findError.message,
      }
    }

    if (!runningRun) {
      // No running record found - create a new completed record
      const { data: newRun, error: insertError } = await supabaseAdmin
        .from('cron_runs')
        .insert({
          cron_name: cronName,
          status,
          started_at: new Date(Date.now() - (durationMs || 0)).toISOString(),
          finished_at: new Date().toISOString(),
          duration_ms: durationMs,
          error_message: errorMessage,
          rows_affected: rowsAffected,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error(`[CronLockManager] Error creating run record for ${cronName}:`, insertError)
        return {
          success: false,
          error: insertError.message,
        }
      }

      return {
        success: true,
        runId: newRun.id,
      }
    }

    // Update the running record
    const { error: updateError } = await supabaseAdmin
      .from('cron_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        error_message: errorMessage,
        rows_affected: rowsAffected,
        // duration_ms will be calculated by the database trigger
      })
      .eq('id', runningRun.id)

    if (updateError) {
      console.error(`[CronLockManager] Error updating run record for ${cronName}:`, updateError)
      return {
        success: false,
        error: updateError.message,
      }
    }

    return {
      success: true,
      runId: runningRun.id,
    }
  } catch (err: any) {
    console.error(`[CronLockManager] Unexpected error recording run for ${cronName}:`, err)
    return {
      success: false,
      error: err?.message || 'Unexpected error',
    }
  }
}

/**
 * Release a cron job lock (advisory lock)
 * Note: Advisory locks are automatically released when the session ends
 *
 * @param cronName - Name of the cron job
 * @returns Promise<boolean> - true if lock released
 */
export async function releaseLock(cronName: string): Promise<boolean> {
  try {
    // Convert cron name to lock key (same hash as try_cron_lock)
    // PostgreSQL provides pg_advisory_unlock but we need the lock key
    // In practice, advisory locks are session-based and auto-release
    // This function is provided for completeness but may not be necessary

    // Note: We could implement pg_advisory_unlock via a custom RPC function
    // For now, rely on automatic session cleanup
    console.warn(`[CronLockManager] releaseLock() called for ${cronName} - advisory locks auto-release on session end`)
    return true
  } catch (err: any) {
    console.error(`[CronLockManager] Error releasing lock for ${cronName}:`, err)
    return false
  }
}
