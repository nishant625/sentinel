# Sentinel

OAuth 2.0 Authorization Server with PKCE support.

## Features

- OAuth 2.0 Authorization Code Flow
- PKCE (Proof Key for Code Exchange) with S256
- Opaque access tokens
- Token introspection endpoint (RFC 7662)
- PostgreSQL database with Prisma ORM
- bcrypt password hashing

## Prerequisites

- Node.js (v14 or higher)
- Docker (for running PostgreSQL)

## Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/database_name
PORT=4000
```

### Configuration Details

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5433/auth_db` |
| `PORT` | Server port | `4000` |

The defaults match the Docker setup above.

## Installation

```bash
npm install
```

## Database Setup

Start the PostgreSQL container:

```bash
docker run -d \
  --name auth-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=auth_db \
  -p 5433:5432 \
  -v auth-db-data:/var/lib/postgresql/data \
  postgres:16-alpine
```

Run migrations and optionally seed test users:

```bash
npm run db:migrate
npm run db:seed
```

The seed command creates test users with password `password123`:
- alice@example.com
- bob@example.com
- nishant@example.com

## Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## API Endpoints

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-02-21T10:30:00.000Z"
}
```

### OAuth 2.0 Authorization

```
GET /oauth/authorize
```

**Query Parameters:**
- `client_id` (required)
- `redirect_uri` (required)
- `response_type` (required) - must be `code`
- `state` (required)
- `code_challenge` (required)
- `code_challenge_method` (required) - must be `S256`
- `scope` (optional) - defaults to `openid`

**Response:**
Returns HTML login form.

### Token Exchange

```
POST /oauth/token
Content-Type: application/json
```

**Request Body:**
```json
{
  "grant_type": "authorization_code",
  "code": "auth_code_here",
  "redirect_uri": "https://your-app.com/callback",
  "client_id": "your_client_id",
  "code_verifier": "pkce_verifier"
}
```

**Response:**
```json
{
  "access_token": "opaque_token_here",
  "token_type": "Bearer",
  "expires_in": 86400,
  "scope": "openid"
}
```

### Token Introspection

```
POST /oauth/introspect
Content-Type: application/json
```

**Request Body:**
```json
{
  "token": "access_token_here"
}
```

**Response (Active Token):**
```json
{
  "active": true,
  "scope": "openid",
  "client_id": "your_client_id",
  "username": "user@example.com",
  "user_id": 1,
  "exp": 1708617600,
  "iat": 1708531200
}
```

**Response (Inactive/Expired Token):**
```json
{
  "active": false
}
```

## Database Schema

### User
- `id` - Primary key
- `email` - Unique user email
- `passwordHash` - bcrypt hashed password
- `createdAt` - Account creation timestamp

### AuthCode
- `id` - Primary key
- `code` - Unique authorization code
- `userId` - Foreign key to User
- `clientId` - OAuth client identifier
- `redirectUri` - Registered redirect URI
- `codeChallenge` - PKCE challenge
- `codeChallengeMethod` - PKCE method (S256)
- `scope` - Requested scopes
- `expiresAt` - Code expiration (5 minutes)
- `used` - One-time use flag
- `createdAt` - Creation timestamp

### Token
- `id` - Primary key
- `token` - Opaque access token
- `userId` - Foreign key to User
- `clientId` - OAuth client identifier
- `scope` - Granted scopes
- `expiresAt` - Token expiration (24 hours)
- `createdAt` - Creation timestamp

## Security Features

- PKCE implementation prevents authorization code interception
- One-time use authorization codes
- Time-limited auth codes (5 minutes) and tokens (24 hours)
- bcrypt password hashing with salt rounds
- Opaque tokens (require introspection for validation)

## Development

```bash
# Run Prisma Studio (database GUI)
npm run db:studio
```

## License

ISC
