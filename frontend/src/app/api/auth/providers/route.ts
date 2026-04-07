import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BASE_URL } from '@/lib/store-config'

/**
 * GET /api/auth/providers
 *
 * Returns the list of enabled OAuth providers and their configuration status.
 * This helps verify which social login providers are available.
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Try to get OAuth provider settings
    // Note: Supabase client doesn't expose provider configuration directly
    // We can only test if providers work by attempting to sign in

    const providers = {
      google: {
        enabled: false,
        configured: false,
        message: 'Configure in Supabase Dashboard: Authentication → Providers → Google',
      },
      apple: {
        enabled: false,
        configured: false,
        message: 'Configure in Supabase Dashboard: Authentication → Providers → Apple',
      },
    }

    // Test Google OAuth availability
    try {
      // Check if we can get the Google OAuth URL
      // This will fail if Google provider is not enabled
      const { data: googleData, error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${BASE_URL}/en/auth/callback`,
          skipBrowserRedirect: true,
        },
      })

      if (googleData?.url) {
        providers.google.enabled = true
        providers.google.configured = true
        providers.google.message = 'Google OAuth is configured and ready'
      } else if (googleError) {
        providers.google.message = `Google OAuth error: ${googleError.message}`
      }
    } catch (err) {
      providers.google.message = `Google OAuth not configured: ${err instanceof Error ? err.message : 'Unknown error'}`
    }

    // Test Apple Sign-In availability
    try {
      const { data: appleData, error: appleError } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${BASE_URL}/en/auth/callback`,
          skipBrowserRedirect: true,
        },
      })

      if (appleData?.url) {
        providers.apple.enabled = true
        providers.apple.configured = true
        providers.apple.message = 'Apple Sign-In is configured and ready'
      } else if (appleError) {
        providers.apple.message = `Apple Sign-In error: ${appleError.message}`
      }
    } catch (err) {
      providers.apple.message = `Apple Sign-In not configured: ${err instanceof Error ? err.message : 'Unknown error'}`
    }

    return NextResponse.json({
      providers,
      supabaseUrl,
      callbackUrl: `${BASE_URL}/en/auth/callback`,
      setupInstructions: {
        google: {
          step1: 'Go to https://console.cloud.google.com/ and create OAuth 2.0 credentials',
          step2: `Add authorized redirect URI: ${supabaseUrl}/auth/v1/callback`,
          step3: 'Copy Client ID and Client Secret',
          step4: 'Go to Supabase Dashboard → Authentication → Providers → Google',
          step5: 'Enable Google provider and paste credentials',
        },
        apple: {
          step1: 'Go to https://developer.apple.com/ and create a Services ID',
          step2: 'Configure Sign in with Apple and add redirect URI',
          step3: 'Create a private key and download it',
          step4: 'Go to Supabase Dashboard → Authentication → Providers → Apple',
          step5: 'Enable Apple provider and paste credentials',
        },
      },
    })
  } catch (error) {
    console.error('Error checking OAuth providers:', error)
    return NextResponse.json(
      { error: 'Failed to check OAuth providers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
