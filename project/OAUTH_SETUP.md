# OAuth Setup Guide (Google + Apple)

## Status
✅ **Code Implementation**: Complete
⚠️ **Infrastructure Configuration**: Pending (requires Supabase dashboard access)

## Implementation Summary

### Frontend Implementation (Complete)
- ✅ Login page with Google and Apple OAuth buttons (`src/components/auth/LoginForm.tsx`)
- ✅ OAuth handler using Supabase Auth SDK (`supabase.auth.signInWithOAuth()`)
- ✅ OAuth callback page at `/[locale]/auth/callback`
- ✅ Loading states during OAuth flow
- ✅ Error handling and user-friendly error messages
- ✅ Session persistence and multi-tab synchronization
- ✅ Locale-aware redirect URLs
- ✅ Provider status check endpoint (`/api/auth/providers`)

### OAuth Flow
1. User clicks "Google" or "Apple" button on login page
2. Frontend calls `supabase.auth.signInWithOAuth({ provider, redirectTo })`
3. User is redirected to OAuth provider's consent screen
4. After approval, provider redirects to `/[locale]/auth/callback`
5. Callback page exchanges OAuth code for session
6. User is redirected to homepage with active session

## Required Configuration

### Supabase Dashboard Setup

#### Google OAuth
1. **Create Google OAuth Credentials**:
   - Go to: https://console.cloud.google.com/
   - Navigate to: APIs & Services → Credentials
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Authorized redirect URIs:
     ```
     https://your-project.supabase.co/auth/v1/callback
     ```

2. **Configure in Supabase**:
   - Go to: Supabase Dashboard → Authentication → Providers
   - Find "Google" and click to expand
   - Toggle "Enable Sign in with Google"
   - Paste:
     - Client ID (from Google Console)
     - Client Secret (from Google Console)
   - Authorized Client IDs: Leave empty (default)
   - Skip nonce check: Leave unchecked (recommended for security)

#### Apple Sign-In
1. **Create Apple Services ID**:
   - Go to: https://developer.apple.com/account/resources/identifiers/list/serviceId
   - Click "+" to create a new Identifier
   - Select "Services IDs" and continue
   - Enter:
     - Description: "POD AI Sign-In"
     - Identifier: `com.podai.store` (or your preference)
   - Enable "Sign In with Apple"
   - Configure:
     - Domains and Subdomains: `your-project.supabase.co`
     - Return URLs:
       ```
       https://your-project.supabase.co/auth/v1/callback
       ```

2. **Create Private Key**:
   - Go to: Keys section in Apple Developer account
   - Click "+" to create a new key
   - Enable "Sign In with Apple"
   - Download the `.p8` private key file
   - Note the Key ID

3. **Configure in Supabase**:
   - Go to: Supabase Dashboard → Authentication → Providers
   - Find "Apple" and click to expand
   - Toggle "Enable Sign in with Apple"
   - Paste:
     - Services ID: `com.podai.store` (from step 1)
     - Team ID: Your 10-character Apple Team ID
     - Key ID: From the private key
     - Private Key: Contents of the `.p8` file

### Production URLs
When deploying to production (https://podai.com), update:
1. Authorized redirect URIs in Google Console
2. Return URLs in Apple Services ID
3. `NEXT_PUBLIC_BASE_URL` environment variable

Production callback URL will be:
```
https://podai.com/en/auth/callback
```

## Verification

### Check Provider Status
```bash
curl http://localhost:3000/api/auth/providers | jq .
```

### Test OAuth Flow
1. Navigate to: http://localhost:3000/en/auth/login
2. Click "Google" or "Apple" button
3. Should redirect to provider's consent screen
4. After approval, should redirect back with active session

### Common Issues

**Error: "Unsupported provider: provider is not enabled"**
- Solution: Enable the provider in Supabase Dashboard

**Error: "redirect_uri_mismatch"**
- Solution: Add the Supabase callback URL to provider's authorized redirects

**Error: "invalid_client"**
- Solution: Verify Client ID and Secret are correct in Supabase

## Testing Without Full OAuth Setup

For development/testing purposes, you can:
1. Use email/password authentication (already working)
2. Manually test OAuth flow in Supabase Dashboard → Authentication → Users → "Invite User"
3. Use Supabase's "Email" provider for quick testing

## Security Notes

- OAuth secrets should NEVER be committed to git
- Supabase manages all OAuth secrets on their backend
- The Next.js app does not need OAuth credentials in environment variables
- All OAuth tokens are handled by Supabase Auth (not exposed to frontend)
- Sessions are stored securely with httpOnly cookies (when configured)

## Files Modified

```
src/components/auth/LoginForm.tsx          # OAuth buttons and handlers
src/app/[locale]/(focused)/auth/callback/page.tsx  # OAuth callback handler
src/app/api/auth/providers/route.ts        # Provider status check
src/lib/supabase.ts                        # Supabase client config
```

## Next Steps

1. ✅ Code implementation complete
2. ⚠️ Configure Google OAuth in Supabase Dashboard
3. ⚠️ Configure Apple Sign-In in Supabase Dashboard
4. ✅ Test OAuth flow end-to-end
5. ✅ Update production redirect URLs when deploying
