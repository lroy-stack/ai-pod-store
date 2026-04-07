# Cloudflare Integration

This document explains how the platform integrates with Cloudflare for DDoS protection, CDN, and security.

## Architecture

```
Client → Cloudflare Edge → Caddy Reverse Proxy → App Services
```

## Caddyfile Configuration

The `Caddyfile` includes a `trusted_proxies` directive that:

1. **Fetches Cloudflare IP ranges** from the official API: `https://api.cloudflare.com/client/v4/ips`
2. **Updates ranges automatically** every 12 hours
3. **Trusts X-Forwarded-For headers** only from Cloudflare IPs
4. **Sets correct remote_addr** to the real client IP from X-Forwarded-For

### Configuration

```caddy
{$CADDY_SITE_ADDRESS:http://localhost} {
    # Trust Cloudflare proxy IPs for X-Forwarded-For header
    # Automatically fetches and updates Cloudflare IP ranges every 12h
    trusted_proxies cloudflare {
        interval 12h
    }

    # ... rest of config
}
```

## Why This Matters

### Without trusted_proxies
- All requests appear to come from Cloudflare IPs
- Rate limiting breaks (all clients share same IP)
- Geo-blocking doesn't work
- Access logs show Cloudflare IPs, not real clients

### With trusted_proxies
- ✅ Real client IPs are correctly identified
- ✅ Rate limiting works per-client
- ✅ Geo-blocking works correctly
- ✅ Access logs show real client IPs
- ✅ Security headers (X-Forwarded-For) are validated

## Cloudflare IP Ranges

Caddy automatically fetches both IPv4 and IPv6 ranges. As of Feb 2026, Cloudflare uses:

**IPv4 ranges** (example - auto-updated):
- 173.245.48.0/20
- 103.21.244.0/22
- 103.22.200.0/22
- 103.31.4.0/22
- 141.101.64.0/18
- 108.162.192.0/18
- 190.93.240.0/20
- 188.114.96.0/20
- 197.234.240.0/22
- 198.41.128.0/17
- 162.158.0.0/15
- 104.16.0.0/13
- 104.24.0.0/14
- 172.64.0.0/13
- 131.0.72.0/22

**IPv6 ranges** (example - auto-updated):
- 2400:cb00::/32
- 2606:4700::/32
- 2803:f800::/32
- 2405:b500::/32
- 2405:8100::/32
- 2a06:98c0::/29
- 2c0f:f248::/32

## Cloudflare Dashboard Setup

### 1. DNS Configuration

Point your domain to Cloudflare:

```
A    @       192.0.2.1    (Proxied ☁️)
AAAA @       2001:db8::1  (Proxied ☁️)
```

The actual IPs don't matter - Cloudflare proxies all traffic.

### 2. SSL/TLS Settings

**Recommended**: Full (strict)

1. Go to SSL/TLS → Overview
2. Select "Full (strict)"
3. This ensures end-to-end encryption

Caddy auto-generates Let's Encrypt certs, so Cloudflare validates the origin cert.

### 3. Firewall Rules

#### Rate Limiting
Cloudflare's rate limiting is in addition to app-level rate limiting.

Example rule:
```
(http.request.uri.path contains "/api/") and (rate > 100/1m)
→ Block for 1 hour
```

#### Bot Protection
Enable "Bot Fight Mode" in Security → Bots.

#### DDoS Protection
Automatically enabled. Configure sensitivity in Security → DDoS.

### 4. Page Rules

**Cache static assets**:
```
URL: *.yourdomain.com/*.{jpg,jpeg,png,gif,webp,svg,css,js,woff,woff2}
Settings:
  - Cache Level: Standard
  - Browser Cache TTL: 1 year
  - Edge Cache TTL: 1 month
```

**Bypass cache for API**:
```
URL: *.yourdomain.com/api/*
Settings:
  - Cache Level: Bypass
```

### 5. Turnstile (CAPTCHA)

1. Go to Turnstile → Overview
2. Create a new site
3. Copy Site Key and Secret Key
4. Add to `.env.local`:
   ```
   TURNSTILE_SITE_KEY=0x4AAA...
   TURNSTILE_SECRET_KEY=0x4BBB...
   ```

The app already includes Turnstile on login/register forms (see `frontend/src/components/auth/TurnstileWidget.tsx`).

### 6. WAF (Web Application Firewall)

Enable managed rulesets:
- Cloudflare Managed Ruleset
- Cloudflare OWASP Core Ruleset

Custom rules for API protection:
```
(http.request.uri.path matches "^/api/(auth|checkout|orders)") and
(not cf.client.bot) and
(cf.threat_score > 50)
→ JS Challenge
```

### 7. Email Security (Optional)

If using Resend for transactional emails:
1. Add SPF record: `v=spf1 include:_spf.resend.com ~all`
2. Add DKIM records (provided by Resend)
3. Add DMARC record: `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com`

## Testing X-Forwarded-For

To test that real client IPs are being captured:

```bash
# Locally (without Cloudflare)
curl -H "X-Forwarded-For: 203.0.113.1" http://localhost/api/health

# This should NOT trust the header (not from Cloudflare IP)
# Caddy will use the actual socket IP
```

```bash
# In production (through Cloudflare)
curl https://yourdomain.com/api/health

# Check access logs - should show your real IP, not Cloudflare IP
docker compose logs caddy | tail -20
```

## Security Considerations

### ✅ DO:
- Use Cloudflare Proxy (orange cloud) for all public endpoints
- Enable "Full (strict)" SSL/TLS mode
- Configure firewall rules for API endpoints
- Use Turnstile on login/register forms
- Monitor rate limiting in Cloudflare Analytics

### ❌ DON'T:
- Expose origin server IPs (use DNS proxy)
- Use "Flexible" SSL mode (insecure origin)
- Disable Bot Fight Mode without good reason
- Trust X-Forwarded-For from non-Cloudflare IPs (Caddyfile handles this)

## Monitoring

### Cloudflare Analytics
- Security → Events (firewall blocks)
- Analytics → Traffic (requests, bandwidth, cache ratio)
- Speed → Performance (response times, Core Web Vitals)

### App Logs
```bash
# Check if Caddy is correctly identifying client IPs
docker compose logs caddy | grep "remote_addr"

# Should show real client IPs, not Cloudflare ranges
```

### Health Checks
The app exposes:
- `/api/health` - Full health check with dependency latencies
- `/api/ping` - Lightweight ping (no DB connection)

Cloudflare can monitor these:
1. Go to Traffic → Health Checks
2. Add monitor for `https://yourdomain.com/api/ping`
3. Set interval: 60 seconds

## Troubleshooting

### Issue: All requests show Cloudflare IPs in logs

**Cause**: `trusted_proxies` not configured

**Fix**: Already configured in `Caddyfile`. Restart Caddy:
```bash
docker compose restart caddy
```

### Issue: Rate limiting blocks legitimate users

**Cause**: All users share same Cloudflare IP

**Fix**: Ensure `trusted_proxies cloudflare` is in Caddyfile (already done)

### Issue: SSL/TLS errors

**Cause**: Origin cert doesn't match Cloudflare expectations

**Fix**:
1. Ensure Cloudflare SSL mode is "Full (strict)"
2. Verify Caddy is generating certs: `docker compose logs caddy | grep "certificate obtained"`
3. Check domain in `CADDY_SITE_ADDRESS` env var matches Cloudflare DNS

## References

- [Cloudflare IP Ranges](https://www.cloudflare.com/ips/)
- [Caddy trusted_proxies docs](https://caddyserver.com/docs/caddyfile/directives/trusted_proxies)
- [Cloudflare SSL/TLS Modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/)
- [Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
