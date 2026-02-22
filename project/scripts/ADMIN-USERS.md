# Admin User Management

## Security Policy

🔒 **NEVER use hardcoded passwords in production!**

All admin users must be created with cryptographically secure random passwords.

## Creating Admin Users

### Production / Secure Method

Use the secure admin creation script:

```bash
cd project
node scripts/create-secure-admin.mjs admin@example.com
```

This script:
- Generates a cryptographically secure random password
- Uses bcrypt with cost factor 12
- Displays the password ONCE (save it immediately!)
- Never stores passwords in plain text

Example output:
```
🔐 Creating admin user with secure random password...

✅ Admin user created successfully!
╔════════════════════════════════════════════════════════════╗
║                    ADMIN CREDENTIALS                       ║
╠════════════════════════════════════════════════════════════╣
║ Email:    admin@example.com                                ║
║ Password: forest-mountain-river-cloud-8472                 ║
╠════════════════════════════════════════════════════════════╣
║ ⚠️  IMPORTANT: Save these credentials securely!            ║
║ This password will NOT be shown again.                    ║
║ Access admin panel at: http://localhost:3001              ║
╚════════════════════════════════════════════════════════════╝
```

### Development / Testing Only

For E2E tests or local development, you can create a test admin user:

**Frontend E2E Tests:**
```bash
cd project/frontend
node scripts/create-test-user.mjs
```

**⚠️  DO NOT use test credentials in production!**

## Password Rotation

If an admin password is compromised:

1. Delete the compromised admin user:
   ```sql
   DELETE FROM users WHERE email = 'compromised@example.com';
   ```

2. Create a new admin with a secure password:
   ```bash
   node scripts/create-secure-admin.mjs newadmin@example.com
   ```

3. Document the incident in your security log

## Migration Notes

### Removed Hardcoded Passwords

- ✅ Migration `20260213000000_initial_schema.sql` - Commented out default admin insert
- ✅ Migration `20260221191452_fix_admin_password_hash.sql` - Deprecated (no-op)
- ✅ Migration `20260221213301_remove_hardcoded_admin_password.sql` - Added `must_change_password` flag
- ✅ Script `scripts/create-admin-user.mjs` - Deprecated with error message
- ✅ Script `admin/create-admin.mjs` - Deprecated with error message

### Database Schema

The `users` table now includes:
- `must_change_password` (BOOLEAN) - Forces password change on next login
- Index on `must_change_password` for performance

Admin users created with the secure script have `must_change_password = FALSE`
since they already use cryptographically secure random passwords.

## Future Enhancements

- [ ] Implement forced password change flow in admin login
- [ ] Add password expiration (rotate every 90 days)
- [ ] Add multi-factor authentication (MFA/2FA)
- [ ] Add audit log for admin actions
- [ ] Add IP allowlist for admin access
