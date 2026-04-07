# Cloudflare Setup Guide

Quick-start guide for setting up Cloudflare protection for your POD AI store.

For detailed technical documentation, see [CLOUDFLARE-INTEGRATION.md](./CLOUDFLARE-INTEGRATION.md).

## Prerequisites

- Domain name registered
- Cloudflare account (free tier works)
- App deployed and running

## Step 1: Add Site to Cloudflare

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click "Add a Site"
3. Enter your domain (e.g., `podstore.com`)
4. Select Free plan (or Business for advanced features)
5. Click "Continue"

## Step 2: DNS Configuration

### Update Nameservers

Cloudflare will show you 2 nameservers:
```
amber.ns.cloudflare.com
ted.ns.cloudflare.com
```

1. Go to your domain registrar (Namecheap, GoDaddy, etc.)
2. Find DNS settings
3. Replace existing nameservers with Cloudflare's
4. Save changes (propagation takes 5-60 minutes)

### Add DNS Records

In Cloudflare DNS settings:

```
Type    Name    Content             Proxy Status    TTL
A       @       YOUR.SERVER.IP.V4   Proxied (☁️)    Auto
AAAA    @       YOUR:SERVER::IP:V6  Proxied (☁️)    Auto
CNAME   www     yourdomain.com      Proxied (☁️)    Auto
```

**Important**: Enable "Proxied" (orange cloud) to use Cloudflare protection!

### Verify DNS

```bash
# Check if DNS is pointing to Cloudflare
dig +short yourdomain.com

# Should return Cloudflare IPs like 104.21.x.x or 172.67.x.x
```

## Step 3: SSL/TLS Configuration

1. Go to **SSL/TLS → Overview**
2. Select **"Full (strict)"** mode

   ```
   Browser → HTTPS → Cloudflare → HTTPS → Origin Server (Caddy)
   ```

3. Wait for Cloudflare to issue certificate (automatic, ~5 minutes)

### Verify SSL

```bash
curl -I https://yourdomain.com
# Should return 200 OK with valid certificate
```

### Force HTTPS

1. Go to **SSL/TLS → Edge Certificates**
2. Enable "Always Use HTTPS"
3. Enable "HSTS" (Strict-Transport-Security)

## Step 4: Firewall & WAF Rules

### Enable Managed Rulesets

1. Go to **Security → WAF**
2. Enable:
   - ✅ Cloudflare Managed Ruleset
   - ✅ Cloudflare OWASP Core Ruleset
3. Set action to "Managed Challenge"

### Custom API Protection Rules

Create a custom rule to protect API endpoints:

**Rule Name**: Protect API Endpoints

**Expression**:
```
(http.request.uri.path contains "/api/checkout" or
 http.request.uri.path contains "/api/orders" or
 http.request.uri.path contains "/api/auth") and
not cf.client.bot and
cf.threat_score > 30
```

**Action**: JS Challenge

### Rate Limiting

1. Go to **Security → WAF → Rate Limiting Rules**
2. Create rule:

   **Name**: API Rate Limit
   **Request matching**:
   ```
   (http.request.uri.path contains "/api/")
   ```
   **Requests**: 100 requests per 1 minute
   **Action**: Block for 1 hour

### Bot Protection

1. Go to **Security → Bots**
2. Enable "Bot Fight Mode" (Free plan)
3. Or configure "Super Bot Fight Mode" (Paid plans)

## Step 5: Turnstile (CAPTCHA)

Turnstile protects login/register forms from bots.

### Create Turnstile Site

1. Go to **Turnstile → Overview**
2. Click "Add Site"
3. Enter:
   - **Site name**: POD AI Store
   - **Domain**: `yourdomain.com`
   - **Widget mode**: Managed (recommended)
4. Click "Create"

### Copy Keys

You'll get:
- **Site Key**: `0x4AAA...` (public, goes in frontend)
- **Secret Key**: `0x4BBB...` (private, server-side only)

### Add to Environment

Update your `.env.local`:

```bash
# Frontend (.env.local)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAA...

# Server-side
TURNSTILE_SECRET_KEY=0x4BBB...
```

Restart your app:
```bash
docker compose restart frontend
```

The app already has Turnstile integration — it just needs the keys!

## Step 6: Zero Trust (Optional - Advanced)

Cloudflare Zero Trust protects your admin panel and origin server.

### Protect Admin Panel

1. Go to **Zero Trust → Access → Applications**
2. Create application:
   - **Name**: POD AI Admin
   - **Domain**: `yourdomain.com`
   - **Path**: `/panel/*`
3. Add Access Policy:
   - **Rule name**: Admin Team
   - **Action**: Allow
   - **Include**: Email addresses ending in `@yourcompany.com`
   - Or: Specific emails (e.g., `admin@yourdomain.com`)
4. Click "Create"

### Protect Origin Server

Prevent direct access to your origin IP:

1. Go to **Zero Trust → Settings → Network → Firewall Policies**
2. Create policy:
   - **Name**: Block Direct Access
   - **Traffic**: All traffic
   - **Destination IP**: `YOUR.SERVER.IP.ADDRESS`
   - **Action**: Block

This forces all traffic through Cloudflare.

### Authenticated Origin Pulls (Recommended)

Ensure requests to your origin come from Cloudflare:

1. Go to **SSL/TLS → Origin Server**
2. Enable "Authenticated Origin Pulls"
3. Download the Cloudflare CA certificate
4. Upload to your server and configure Caddy

See [CLOUDFLARE-INTEGRATION.md](./CLOUDFLARE-INTEGRATION.md) for Caddy configuration.

## Step 7: Performance & Caching

### Page Rules

1. Go to **Rules → Page Rules**
2. Create rules:

**Cache Static Assets**:
```
URL: *.yourdomain.com/*.{jpg,png,gif,webp,svg,css,js,woff,woff2}
Settings:
  - Cache Level: Standard
  - Browser Cache TTL: 1 year
  - Edge Cache TTL: 1 month
```

**Bypass Cache for API**:
```
URL: *.yourdomain.com/api/*
Settings:
  - Cache Level: Bypass
```

**Bypass Cache for Admin**:
```
URL: *.yourdomain.com/panel/*
Settings:
  - Cache Level: Bypass
```

### Auto Minify

1. Go to **Speed → Optimization**
2. Enable:
   - ✅ Auto Minify: JavaScript, CSS, HTML
   - ✅ Brotli compression

### Rocket Loader (Optional)

1. Go to **Speed → Optimization → Content Optimization**
2. Enable "Rocket Loader"

**Warning**: Test thoroughly - may break some scripts.

## Step 8: Monitoring & Health Checks

### Create Health Check

1. Go to **Traffic → Health Checks**
2. Create monitor:
   - **Name**: Frontend Health
   - **Monitor Type**: HTTPS
   - **Path**: `/api/ping`
   - **Host Header**: `yourdomain.com`
   - **Interval**: 60 seconds
   - **Retries**: 2

### Set Up Notifications

1. Go to **Notifications**
2. Add webhook/email for:
   - ✅ Origin health alerts
   - ✅ DDoS attacks
   - ✅ SSL certificate expiration
   - ✅ Rate limiting threshold

### Analytics

Monitor your site:
1. Go to **Analytics & Logs → Traffic**
2. View:
   - Requests, bandwidth, cache ratio
   - Top countries, paths, status codes
   - Security events (firewall blocks)

## Step 9: Email Security (If Using Resend)

### SPF Record

Add TXT record:
```
Type: TXT
Name: @
Content: v=spf1 include:_spf.resend.com ~all
```

### DKIM Records

Resend will provide DKIM records. Add them to Cloudflare DNS.

### DMARC Record

Add TXT record:
```
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

## Step 10: Test Your Setup

### DNS Propagation
```bash
dig +short yourdomain.com
# Should return Cloudflare IPs (104.21.x.x or 172.67.x.x)
```

### SSL Certificate
```bash
curl -I https://yourdomain.com
# Should return 200 OK with valid certificate
```

### Security Headers
```bash
curl -I https://yourdomain.com | grep -E "(X-Content-Type-Options|Strict-Transport-Security)"
# Should show security headers
```

### Turnstile
1. Visit `https://yourdomain.com/en/auth/login`
2. Should see Turnstile widget
3. Complete challenge and verify login works

### WAF
Trigger a test:
```bash
curl -I "https://yourdomain.com/api/test?id=1%20OR%201=1"
# Should be blocked by WAF (403 or challenge)
```

## Troubleshooting

### SSL Error: "Too Many Redirects"

**Cause**: SSL mode mismatch

**Fix**:
1. Go to SSL/TLS → Overview
2. Change to "Full (strict)"
3. Wait 5 minutes for changes to propagate

### Error 521: Web Server Is Down

**Cause**: Origin server not reachable

**Fix**:
1. Verify origin server is running: `docker compose ps`
2. Check firewall allows Cloudflare IPs
3. Verify DNS A/AAAA records point to correct IP

### Error 525: SSL Handshake Failed

**Cause**: Origin certificate invalid

**Fix**:
1. Check Caddy logs: `docker compose logs caddy`
2. Verify `CADDY_SITE_ADDRESS` env var is set correctly
3. Ensure domain in Caddy matches DNS

### Turnstile Not Showing

**Cause**: Keys not configured or incorrect domain

**Fix**:
1. Verify `.env.local` has correct keys
2. Check Turnstile site domain matches your domain
3. Clear browser cache and reload

### Real Client IPs Not Showing in Logs

**Cause**: `trusted_proxies` not configured

**Fix**:
Already configured in `Caddyfile`! Just restart Caddy:
```bash
docker compose restart caddy
```

## Security Checklist

Before going live, verify:

- ✅ DNS records proxied through Cloudflare (orange cloud)
- ✅ SSL mode: Full (strict)
- ✅ HSTS enabled
- ✅ Firewall enabled (Managed Rulesets)
- ✅ Rate limiting configured
- ✅ Turnstile on login/register forms
- ✅ Bot Fight Mode enabled
- ✅ Direct IP access blocked (Zero Trust)
- ✅ Health checks configured
- ✅ Email SPF/DKIM/DMARC records added
- ✅ Monitoring/notifications set up

## Next Steps

- **Advanced caching**: See [CLOUDFLARE-INTEGRATION.md](./CLOUDFLARE-INTEGRATION.md)
- **Load balancing**: Set up multiple origin servers
- **Argo Smart Routing**: Reduce latency (paid feature)
- **Image Optimization**: Use Cloudflare Images or Polish

## Support

- [Cloudflare Documentation](https://developers.cloudflare.com/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Turnstile Docs](https://developers.cloudflare.com/turnstile/)
- [Zero Trust Docs](https://developers.cloudflare.com/cloudflare-one/)
