import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase.js';
import { randomUUID } from 'node:crypto';

export const subscribeNewsletterSchema = z.object({
  email: z.string().email().describe('Email address to subscribe'),
  locale: z.enum(['en', 'es', 'de']).optional().default('en').describe('Preferred language'),
});

export type SubscribeNewsletterInput = z.infer<typeof subscribeNewsletterSchema>;

export interface SubscribeNewsletterResult {
  success: boolean;
  error?: string;
  message?: string;
  already_subscribed?: boolean;
}

export async function subscribeNewsletter(
  input: SubscribeNewsletterInput
): Promise<SubscribeNewsletterResult> {
  try {
    const supabase = getSupabaseClient();
    const { email, locale } = input;

    const normalizedEmail = email.trim().toLowerCase();

    // Check if already subscribed
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'confirmed' || existing.status === 'pending') {
        return {
          success: true,
          message: 'This email is already subscribed to the newsletter',
          already_subscribed: true,
        };
      }
      // Resubscribe if previously unsubscribed
      const { error: updateError } = await supabase
        .from('newsletter_subscribers')
        .update({
          status: 'pending',
          locale,
          confirmation_token: randomUUID(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('[subscribe_newsletter] Update error:', updateError);
        return { success: false, error: 'Failed to resubscribe' };
      }

      return { success: true, message: 'Successfully resubscribed to the newsletter' };
    }

    // Insert new subscriber
    const { error: insertError } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email: normalizedEmail,
        locale,
        status: 'pending',
        confirmation_token: randomUUID(),
      });

    if (insertError) {
      // Handle unique constraint violation
      if (insertError.code === '23505') {
        return {
          success: true,
          message: 'This email is already subscribed to the newsletter',
          already_subscribed: true,
        };
      }
      console.error('[subscribe_newsletter] Insert error:', insertError);
      return { success: false, error: 'Failed to subscribe' };
    }

    return { success: true, message: 'Successfully subscribed! Check your email for confirmation.' };
  } catch (err) {
    console.error('[subscribe_newsletter] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
