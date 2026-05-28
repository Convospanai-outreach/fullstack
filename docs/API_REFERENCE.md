# CraftMyFunnel API Reference

Complete API documentation for CraftMyFunnel endpoints.

**Base URL**: `http://localhost:3000` (development) | `https://yourdomain.com` (production)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Campaigns](#campaigns)
3. [Leads](#leads)
4. [Billing](#billing)
5. [Inbox](#inbox)
6. [Health & Monitoring](#health--monitoring)

---

## Authentication

### POST /api/register

Create a new user account.

**Authentication**: None (public)

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response** (201):
```json
{
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "name": "John Doe"
  },
  "message": "Account created! Please check your email to verify your account."
}
```

**Errors**:
- `400`: Missing required fields or user already exists
- `500`: Internal server error

---

### GET /api/auth/verify-email

Verify user email address using token from email.

**Authentication**: None (public)

**Query Parameters**:
- `token` (string, required) - Verification token from email

**Response** (200):
```json
{
  "success": true,
  "message": "Email verified successfully",
  "email": "john@example.com"
}
```

**Errors**:
- `400`: Invalid or expired token
- `500`: Server error

---

### POST /api/auth/resend-verification

Resend verification email to authenticated user.

**Authentication**: Required (session)

**Response** (200):
```json
{
  "success": true,
  "message": "Verification email sent"
}
```

**Errors**:
- `401`: Unauthorized
- `400`: Email already verified
- `404`: User not found
- `500`: Failed to send email

---

## Campaigns

### GET /api/campaigns

Get all campaigns for the authenticated user's team.

**Authentication**: Required (session)

**Response** (200):
```json
{
  "ok": true,
  "campaigns": [
    {
      "id": "uuid",
      "name": "Q1 Outreach",
      "status": "active",
      "type": "standard",
      "targetCount": 100,
      "completedCount": 45,
      "leads": 100,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

**Errors**:
- `401`: Unauthorized
- `500`: Server error

---

### GET /api/campaigns/[id]

Get a specific campaign by ID.

**Authentication**: Required (session)

**Path Parameters**:
- `id` (string) - Campaign UUID

**Response** (200):
```json
{
  "ok": true,
  "campaign": {
    "id": "uuid",
    "name": "Q1 Outreach",
    "description": "Targeting tech companies",
    "status": "active",
    "variants": [...],
    "leads": [...]
  }
}
```

**Errors**:
- `401`: Unauthorized
- `404`: Campaign not found
- `500`: Server error

---

## Leads

### GET /api/leads

Get all leads for the authenticated user's team.

**Authentication**: Required (session)

**Response** (200):
```json
{
  "ok": true,
  "leads": [
    {
      "id": "uuid",
      "fullName": "Jane Smith",
      "email": "jane@company.com",
      "company": "Tech Corp",
      "jobTitle": "CTO",
      "status": "NEW",
      "isEnriched": false,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

**Errors**:
- `401`: Unauthorized
- `500`: Server error

---

### POST /api/leads/enrich

Enrich lead data using AI.

**Authentication**: Required (session)

**Request Body**:
```json
{
  "leadId": "uuid"
}
```

**Response** (200):
```json
{
  "ok": true,
  "lead": {
    "id": "uuid",
    "isEnriched": true,
    "enrichedData": {
      "linkedin": "...",
      "bio": "...",
      "interests": [...]
    }
  }
}
```

**Errors**:
- `401`: Unauthorized
- `404`: Lead not found
- `500`: Enrichment failed

---

## Billing

### GET /api/billing/subscription

Get current subscription details.

**Authentication**: Required (session)

**Response** (200):
```json
{
  "ok": true,
  "subscription": {
    "plan": "PRO",
    "status": "active",
    "currentPeriodEnd": "2026-02-01T00:00:00.000Z",
    "credits": 500
  }
}
```

**Errors**:
- `401`: Unauthorized
- `404`: No subscription found
- `500`: Server error

---

### POST /api/billing/topup

Create Razorpay order for credit top-up.

**Authentication**: Required (session)

**Request Body**:
```json
{
  "amount": 1000,
  "credits": 100
}
```

**Response** (200):
```json
{
  "ok": true,
  "order": {
    "id": "order_xxxxx",
    "amount": 1000,
    "currency": "INR"
  }
}
```

**Errors**:
- `401`: Unauthorized
- `400`: Invalid amount
- `500`: Failed to create order

---

## Inbox

### GET /api/inbox/threads

Get all message threads.

**Authentication**: Required (session)

**Response** (200):
```json
{
  "ok": true,
  "threads": [
    {
      "id": "uuid",
      "leadId": "uuid",
      "lead": {
        "fullName": "Jane Smith",
        "company": "Tech Corp"
      },
      "lastMessage": {
        "content": "Thanks for reaching out!",
        "createdAt": "2026-01-01T12:00:00.000Z"
      },
      "unreadCount": 2
    }
  ]
}
```

**Errors**:
- `401`: Unauthorized
- `500`: Server error

---

### POST /api/inbox/[threadId]/send

Send a message in a thread.

**Authentication**: Required (session)

**Path Parameters**:
- `threadId` (string) - Thread UUID

**Request Body**:
```json
{
  "content": "Hello! Thanks for your interest.",
  "platform": "EMAIL"
}
```

**Response** (200):
```json
{
  "ok": true,
  "message": {
    "id": "uuid",
    "content": "Hello! Thanks for your interest.",
    "direction": "OUTBOUND",
    "status": "sent",
    "createdAt": "2026-01-01T12:00:00.000Z"
  }
}
```

**Errors**:
- `401`: Unauthorized
- `404`: Thread not found
- `500`: Failed to send message

---

## Dashboard

### GET /api/dashboard/stats

Get dashboard statistics.

**Authentication**: Required (session)

**Response** (200):
```json
{
  "ok": true,
  "stats": {
    "campaignsCount": 5,
    "leadsCount": 250,
    "recentCampaigns": [...],
    "recentLeads": [...],
    "dailyActivity": [...]
  }
}
```

**Errors**:
- `401`: Unauthorized
- `500`: Server error

---

## Health & Monitoring

### GET /api/health

Check system health status.

**Authentication**: None (public)

**Response** (200):
```json
{
  "status": "ok",
  "timestamp": "2026-01-01T12:00:00.000Z",
  "database": "connected",
  "version": "1.0.0"
}
```

**Response** (503 - Service Unavailable):
```json
{
  "status": "error",
  "timestamp": "2026-01-01T12:00:00.000Z",
  "database": "disconnected",
  "error": "Connection timeout"
}
```

---

## Error Responses

All endpoints may return these standard error responses:

### 400 Bad Request
```json
{
  "error": "Invalid request parameters"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting

- **Authenticated requests**: 100 requests per minute
- **Public endpoints**: 20 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## Authentication

Most endpoints require authentication via NextAuth session cookies.

**Login Flow**:
1. User logs in via `/api/auth/signin`
2. Session cookie is set automatically
3. Include cookie in subsequent requests

**Session Cookie**: `next-auth.session-token`

---

## Webhooks (Future)

Webhook endpoints for external integrations will be documented here.

---

## Support

For API support:
- **Email**: api-support@craftmyfunnel.com
- **Documentation**: https://docs.craftmyfunnel.com
- **Status Page**: https://status.craftmyfunnel.com
