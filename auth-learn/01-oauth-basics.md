# 01 — OAuth Basics: The Problem It Solves

## Why does OAuth exist?

Before OAuth, if you wanted an app to access your data somewhere, you gave it your password. Gmail wanted to read your contacts? Give it your Google password. That app now has your password forever, can do anything with it, and you can't revoke it without changing your password everywhere.

OAuth solves this: **users grant apps limited access without giving them passwords.**

The user proves who they are to one trusted place. That place issues a token. Apps use that token. The user can revoke it anytime. Apps never see the password.

---

## The 4 Actors

Every OAuth flow involves these four things:

**Resource Owner** — the human. The person clicking login. They own the data.

**Authorization Server** — the thing that authenticates the user and issues tokens. This is the trusted center of the whole system. Examples: Google's login, GitHub's login, Auth0, Keycloak. *Sentinel is this.*

**Client** — the app that wants to act on behalf of the user. Despite the name, this is not the browser — it's the registered application. Your React app is the client. A mobile app is the client. A backend service calling another service is a client.

**Resource Server** — the API that holds protected data. It receives tokens and validates them. Your backend API is this.

> The authorization server and resource server are sometimes the same system, sometimes separate. In simple setups they're the same server.

---

## What a Token Is

A token is a credential — just a string. It proves that a user authenticated and granted permission.

```
8f3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c
```

When your frontend calls your API, it sends this token. The API validates it — either by checking with the auth server or by verifying a cryptographic signature. If valid, the API knows who the user is and what they're allowed to do.

The key point: **your API never handles passwords. It only handles tokens.** All the messy auth logic stays in the authorization server.

---

## What a Scope Is

A scope is a permission label. When a user logs in, the client requests specific scopes:

```
scope=openid profile email
```

The auth server checks if the client is allowed to ask for those scopes, and if the user consents. The token is then labeled with those scopes.

When the API validates the token, it sees the scopes and decides what to return.

Standard scopes (defined by OIDC):
- `openid` — "I want to know who the user is" (minimum for login)
- `profile` — name, picture, etc.
- `email` — email address
- `offline_access` — I want a refresh token

Apps can also define custom scopes: `read:orders`, `write:inventory`, etc.

*Sentinel currently only implements `openid`.*

---

## The Big Picture

```
User          Your App (Client)      Auth Server         Your API
  |                  |                    |                   |
  | clicks login     |                    |                   |
  |----------------> |                    |                   |
  |                  | redirect to login  |                   |
  |                  |------------------> |                   |
  | sees login page  |                    |                   |
  | <-----------------------------------------               |
  | enters password  |                    |                   |
  | ----------------------------------------->               |
  |                  | redirect + code    |                   |
  |                  | <----------------- |                   |
  |                  | exchange code      |                   |
  |                  | -----------------> |                   |
  |                  | access token       |                   |
  |                  | <----------------- |                   |
  |                  |                    |     API call      |
  |                  | ------------------------------------> |
  |                  |                    |  validate token   |
  |                  |                    | <---------------- |
  |                  |                    |  user info        |
  |                  |                    | ----------------> |
  |                  |      response      |                   |
  |                  | <----------------------------------------|
```

This full dance is called the **Authorization Code Flow**. It's the standard, most secure OAuth flow and what you should use for any app with a user login.

---

Next: [02 — Authorization Code Flow](./02-authorization-code-flow.md)
