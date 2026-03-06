# API Endpoints Reference

This document describes the public-facing API of the Legal Intake Voice Service. The API is intended for **authorized personnel** (e.g., attorneys and staff) to retrieve and review redacted intake call records. All returned data is PII-redacted in compliance with FRBP 9037.

## Overview

- **Base URL (local):** `http://localhost:8000` (or the host/port where the application is running)
- **Purpose:** Provide read-only access to redacted `IntakeCall` records for human oversight and auditing of the AI intake process.
- **Authentication:** Required for all endpoints. Supported methods: API Key (header) or JWT; see per-endpoint details below.

---

## GET /api/calls

Retrieves a list of redacted intake call records for attorney review. Results are paginated and can be filtered by date range and legal-questions-flagged status.

### HTTP Method and URL

```
GET /api/calls
```

### Authentication

Requests must include one of the following:

| Method | How to send |
|--------|-------------|
| **API Key** | Header: `X-API-Key: <your-api-key>` |
| **JWT** | Header: `Authorization: Bearer <jwt-token>` |

- **401 Unauthorized** — Missing or invalid API key or JWT.

### Request parameters

All parameters are optional query parameters.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Maximum number of records to return (1–100). |
| `offset` | integer | 0 | Number of records to skip (for pagination). |
| `since` | string (ISO 8601 date) | — | Return only calls with `start_time` on or after this date (e.g. `2026-03-01`). |
| `until` | string (ISO 8601 date) | — | Return only calls with `start_time` on or before this date. |
| `flagged` | boolean | — | If `true`, return only calls with `specific_legal_questions_flagged = true`. If `false`, only unflagged. Omit for all. |

### Example request (curl)

**Using API Key:**

```bash
curl -X GET "http://localhost:8000/api/calls?limit=10&offset=0" \
  -H "X-API-Key: your-api-key-here"
```

**Using JWT:**

```bash
curl -X GET "http://localhost:8000/api/calls?limit=10&flagged=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**With date filter:**

```bash
curl -X GET "http://localhost:8000/api/calls?since=2026-03-01&until=2026-03-05" \
  -H "X-API-Key: your-api-key-here"
```

### Response format

**Success: 200 OK**

JSON body: an object with a `calls` array and optional pagination metadata.

| Field | Type | Description |
|-------|------|-------------|
| `calls` | array | List of `IntakeCall` objects (see schema below). |
| `total` | integer (optional) | Total number of records matching the query (for pagination). |

**IntakeCall object schema:**

| Field | Type | Description |
|-------|------|-------------|
| `call_id` | string (UUID) | Unique identifier for the call. |
| `start_time` | string (ISO 8601) | Call start time. |
| `end_time` | string (ISO 8601) | Call end time. |
| `redacted_transcript` | string | Full transcript with PII redacted (e.g., SSN as XXX-XX-1234, DOB as YYYY). |
| `client_name_provided` | string \| null | Name as provided by the caller (if any). |
| `debt_details_summary` | string \| null | Summary of debt-related information gathered. |
| `income_details_summary` | string \| null | Summary of income-related information. |
| `asset_details_summary` | string \| null | Summary of asset-related information. |
| `specific_legal_questions_flagged` | boolean | Whether the caller asked questions that were flagged for attorney review (UPL deflection). |
| `flagged_questions_summary` | string \| null | Summary of flagged legal questions, if any. |

### Example successful response (200 OK)

```json
{
  "calls": [
    {
      "call_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "start_time": "2026-03-05T14:30:00Z",
      "end_time": "2026-03-05T14:35:22Z",
      "redacted_transcript": "[Redacted conversation. SSN masked to XXX-XX-1234.]",
      "client_name_provided": "Jane Doe",
      "debt_details_summary": "Credit cards, medical debt.",
      "income_details_summary": "W-2 employment.",
      "asset_details_summary": "Primary residence, one vehicle.",
      "specific_legal_questions_flagged": true,
      "flagged_questions_summary": "Caller asked whether to include tax refund in filing."
    }
  ],
  "total": 1
}
```

### Error responses

| Status | Meaning | Typical cause |
|--------|---------|----------------|
| **401 Unauthorized** | Authentication required or invalid. | Missing or invalid `X-API-Key` or `Authorization` header. |
| **403 Forbidden** | Authenticated but not allowed. | Valid token but insufficient permissions. |
| **404 Not Found** | Resource not found. | Invalid path (e.g. typo in URL). |
| **422 Unprocessable Entity** | Validation error. | Invalid query parameters (e.g. `limit` &gt; 100). |
| **500 Internal Server Error** | Server error. | Application or database failure; check logs. |

**Example 401 response body:**

```json
{
  "detail": "Invalid or missing API key"
}
```

---

## Summary

- **GET /api/calls** — List redacted intake calls with optional pagination and filters; requires API Key or JWT. Use for attorney review and auditing of the AI intake process.
