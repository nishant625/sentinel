# TODO

## Schema cleanup
- [ ] Remove `Token` model from `prisma/schema.prisma` — JWTs are self-contained, no DB storage needed
- [ ] Create and run migration to drop the `Token` table
- [ ] Remove any leftover `prisma.token` references (already cleaned from authService, double-check)

## Security — open routes
- [ ] `POST /oauth/introspect` — requires client credentials per RFC 7662 (currently unauthenticated, anyone can introspect any token)
- [ ] `POST /oauth/revoke` — requires client credentials per RFC 7009 (currently unauthenticated)
- [ ] Add client auth middleware: validate `client_id` + `client_secret` (confidential) or just `client_id` (public) on both endpoints

## General refinement
- [ ] Rate limiting on `/oauth/token`, `/oauth/authz-direct`, `/admin` — brute force protection
- [ ] Add `expires_at` index on `RefreshToken` table for efficient cleanup queries
- [ ] Cleanup job for expired/used refresh tokens (they accumulate forever right now)
- [ ] Timing-safe comparison for admin secret (`crypto.timingSafeEqual`)
- [ ] Fix XSS in admin.js — `esc()` doesn't escape single quotes in `onclick` handlers
