# 03 — PKCE: The Math Explained Simply

PKCE = Proof Key for Code Exchange. Pronounced "pixie."

---

## The Problem It Solves

The Authorization Code Flow has a weak point: step 4, where the auth server redirects back to your app with the code in the URL.

On mobile, multiple apps can register for the same URL scheme. A malicious app could intercept that redirect and grab the code before your real app does. On the web, browser extensions or injected scripts could do the same.

The attacker now has the code. In the old flow (no PKCE), they can exchange it for a token. Game over.

PKCE solves this: even if someone steals the code, **they can't exchange it** without a secret that only the real app generated at the start of the flow.

---

## The Three Pieces

### `code_verifier`

A random string your app generates right before starting the login flow.

```
dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXkiCvXy8zKm...
```

Requirements:
- Cryptographically random (not Math.random())
- 43–128 characters
- Only URL-safe characters: A-Z, a-z, 0-9, `-`, `.`, `_`, `~`

Your app **keeps this secret** in memory. It never goes in a URL. It only goes in the token exchange POST body.

### `code_challenge`

A one-way transformation of the verifier:

```
code_challenge = BASE64URL( SHA256( code_verifier ) )
```

This gets sent to the auth server in step 1. It's safe to send because SHA-256 is a **one-way function** — knowing the challenge tells you nothing about the verifier.

Result looks like:
```
E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
```

### `code_challenge_method`

Always `S256`. This tells the auth server you used SHA-256.

There's also `plain` where `code_challenge = code_verifier`. Useless for security — avoid it. *Sentinel correctly requires S256.*

---

## The Full Flow With PKCE

```
YOUR APP                              AUTH SERVER
    |                                      |
    |  1. generate code_verifier           |
    |     random, keep it in memory        |
    |                                      |
    |  2. code_challenge = SHA256(verifier)|
    |     (safe to share)                  |
    |                                      |
    |  3. GET /authorize                   |
    |     ?code_challenge=E9Mel...         |
    |     &code_challenge_method=S256      |
    |------------------------------------> |
    |                                      |  stores code_challenge
    |                                      |  with the auth code
    |  4. redirect back with code          |
    |  <---------------------------------- |
    |                                      |
    |  [attacker intercepts the code here] |
    |                                      |
    |  5. POST /token                      |
    |     code=a7f3b2                      |
    |     code_verifier=dBjft...           |
    |------------------------------------> |
    |                                      |  SHA256(dBjft...) = E9Mel...
    |                                      |  compare with stored: E9Mel...
    |                                      |  ✓ match → issue token
    |  6. access_token                     |
    |  <---------------------------------- |
```

If the attacker tries to exchange the stolen code, they don't have the `code_verifier`. They'd need to reverse SHA-256 to find it — which is computationally impossible.

---

## The Math: One-Way Functions

SHA-256 takes any input and produces a fixed 256-bit output:

```
SHA256("hello")  →  2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
SHA256("hello!") →  ce06092fb948d9af0bd68c6b26c4b0c3f8c27e0d...
```

Properties that make this useful for PKCE:
1. **Deterministic** — same input always gives same output
2. **One-way** — can't reverse it. Can't go from hash back to input.
3. **Avalanche effect** — changing one character completely changes the output

So the auth server can verify that `SHA256(verifier) == stored_challenge` without ever knowing the verifier during the authorize step.

---

## In JavaScript (how your frontend should do it)

```js
// Step 1: Generate verifier
function generateVerifier() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// Step 2: Generate challenge
async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}
```

---

## Summary in One Sentence

Your app generates a secret, sends a hash of it upfront, then proves it knows the secret during token exchange — so only the original requester can complete the flow, even if the code is stolen.

---

Next: [04 — Tokens: Opaque vs JWT](./04-tokens.md)
