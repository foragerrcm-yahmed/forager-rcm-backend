# Forager RCM Backend — API Guide

## Live API

**Base URL:** `https://forager-rcm-backend-production.up.railway.app`

**Health Check:** `GET /health` — confirms the server is running (no auth required)

---

## Authentication

Every request to a protected endpoint requires a Bearer token in the header:

```
Authorization: Bearer <your_token>
```

Tokens expire after **7 days**. When yours expires, log in again using the login endpoint to get a fresh one.

---

## Getting Started

### Step 1 — Log In

**POST** `/api/auth/login`

No auth header needed.

**Body:**
```json
{
  "email": "yahmed@foragerrcm.com",
  "password": "your_password"
}
```

**Response:** Returns a `token` — copy it and use it as your `Authorization` header for all other requests.

---

### Step 2 — Check Your Profile

**GET** `/api/auth/profile`

Header: `Authorization: Bearer <token>`

Returns your user details and `organizationId`.

---

## All Endpoints

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | No | Log in and get a token |
| POST | `/api/auth/register` | No | Create a new user (requires existing `organizationId`) |
| GET | `/api/auth/profile` | Yes | Get your own profile |

---

### Users — `/api/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/users` | Yes | List all users in your organization |
| GET | `/api/users/:id` | Yes | Get a user by ID |
| PUT | `/api/users/:id` | Yes | Update a user |
| DELETE | `/api/users/:id` | Yes | Delete a user |

---

### Organizations — `/api/organizations`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/organizations` | Yes | List organizations |
| GET | `/api/organizations/:id` | Yes | Get organization by ID |
| POST | `/api/organizations` | Yes (Admin) | Create a new organization |
| PUT | `/api/organizations/:id` | Yes (Admin) | Update an organization |
| DELETE | `/api/organizations/:id` | Yes (Admin) | Delete an organization |

---

### Patients — `/api/patients`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/patients` | Yes | List patients (supports `?search=`, `?source=`, `?includeInsurances=true`) |
| GET | `/api/patients/:id` | Yes | Get patient by ID |
| POST | `/api/patients` | Yes | Create a patient |
| PUT | `/api/patients/:id` | Yes | Update a patient |
| DELETE | `/api/patients/:id` | Yes | Delete a patient |

**Create Patient body example:**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "dateOfBirth": 631152000,
  "gender": "Female",
  "phone": "555-123-4567",
  "email": "jane.doe@email.com",
  "organizationId": "ff145d75-192c-4a7c-afe2-01e045d1dd29",
  "source": "Forager"
}
```

> **Note:** `dateOfBirth` is a Unix timestamp (seconds since Jan 1, 1970). Use a converter like [unixtimestamp.com](https://www.unixtimestamp.com) to convert dates.

---

### Providers — `/api/providers`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/providers` | Yes | List providers |
| GET | `/api/providers/:id` | Yes | Get provider by ID |
| POST | `/api/providers` | Yes | Create a provider |
| PUT | `/api/providers/:id` | Yes | Update a provider |
| DELETE | `/api/providers/:id` | Yes | Delete a provider |

**Create Provider body example:**
```json
{
  "firstName": "Dr. John",
  "lastName": "Smith",
  "npi": "1234567890",
  "specialty": "Family Medicine",
  "licenseType": "MD",
  "organizationId": "ff145d75-192c-4a7c-afe2-01e045d1dd29",
  "source": "Forager"
}
```

---

### Payors — `/api/payors`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/payors` | Yes | List payors (insurance companies) |
| GET | `/api/payors/:id` | Yes | Get payor by ID |
| POST | `/api/payors` | Yes | Create a payor with plans |
| PUT | `/api/payors/:id` | Yes | Update a payor |
| DELETE | `/api/payors/:id` | Yes | Delete a payor |

**Create Payor body example:**
```json
{
  "name": "Blue Cross Blue Shield",
  "externalPayorId": "BCBS-001",
  "payorCategory": "Commercial",
  "billingTaxonomy": "Health Insurance",
  "organizationId": "ff145d75-192c-4a7c-afe2-01e045d1dd29",
  "plans": [
    {
      "planName": "BCBS PPO",
      "planType": "PPO",
      "isInNetwork": true
    }
  ]
}
```

---

### Visits — `/api/visits`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/visits` | Yes | List visits (supports `?patientId=`, `?providerId=`, `?status=`, `?dateFrom=`, `?dateTo=`) |
| GET | `/api/visits/:id` | Yes | Get visit by ID |
| POST | `/api/visits` | Yes | Create a visit |
| PUT | `/api/visits/:id` | Yes | Update a visit |
| DELETE | `/api/visits/:id` | Yes | Delete a visit |

**Create Visit body example:**
```json
{
  "patientId": "<patient_id>",
  "providerId": "<provider_id>",
  "organizationId": "ff145d75-192c-4a7c-afe2-01e045d1dd29",
  "visitDate": 1773850277,
  "visitTime": 1773850277,
  "duration": 30,
  "visitType": "OfficeVisit",
  "location": "InPerson",
  "status": "Scheduled",
  "source": "Forager"
}
```

---

### Claims — `/api/claims`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/claims` | Yes | List claims (supports `?status=`, `?patientId=`, `?providerId=`) |
| GET | `/api/claims/:id` | Yes | Get claim by ID |
| POST | `/api/claims` | Yes | Create a claim |
| PUT | `/api/claims/:id` | Yes | Update a claim |
| DELETE | `/api/claims/:id` | Yes | Delete a claim |

---

### CPT Codes — `/api/cpt-codes`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/cpt-codes` | Yes | List CPT codes (supports `?search=`) |
| GET | `/api/cpt-codes/:code` | Yes | Get CPT code by code (e.g. `99213`) |
| POST | `/api/cpt-codes` | Yes (Admin) | Create a CPT code |
| PUT | `/api/cpt-codes/:code` | Yes (Admin) | Update a CPT code |
| DELETE | `/api/cpt-codes/:code` | Yes (Admin) | Delete a CPT code |

---

### Insurance Policies — `/api/insurance-policies`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/insurance-policies` | Yes | List insurance policies (supports `?patientId=`) |
| GET | `/api/insurance-policies/:id` | Yes | Get policy by ID |
| POST | `/api/insurance-policies` | Yes | Create a policy |
| PUT | `/api/insurance-policies/:id` | Yes | Update a policy |
| DELETE | `/api/insurance-policies/:id` | Yes | Delete a policy |

---

### Rules — `/api/rules`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/rules` | Yes | List rules |
| GET | `/api/rules/:id` | Yes | Get rule by ID |
| POST | `/api/rules` | Yes (Admin) | Create a rule |
| PUT | `/api/rules/:id` | Yes (Admin) | Update a rule |
| DELETE | `/api/rules/:id` | Yes (Admin) | Delete a rule |
| PATCH | `/api/rules/:id/activate` | Yes (Admin) | Activate a rule |
| PATCH | `/api/rules/:id/deactivate` | Yes (Admin) | Deactivate a rule |

---

### Rule Executions — `/api/rule-executions`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/rule-executions` | Yes | List rule execution history |
| GET | `/api/rule-executions/:id` | Yes | Get execution by ID |

---

### Attachments — `/api/attachments`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/attachments` | Yes | List attachments (supports `?patientId=`, `?visitId=`, `?claimId=`) |
| GET | `/api/attachments/:id` | Yes | Get attachment by ID |
| POST | `/api/attachments` | Yes | Upload an attachment (multipart/form-data) |
| DELETE | `/api/attachments/:id` | Yes | Delete an attachment |

---

## Pagination

All list endpoints support pagination via query parameters:

| Parameter | Default | Description |
|---|---|---|
| `page` | `1` | Page number |
| `limit` | `20` | Results per page (max 100) |

**Example:** `GET /api/patients?page=2&limit=10`

**Response format:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

---

## User Roles

| Role | Access Level |
|---|---|
| `Admin` | Full access to all endpoints |
| `Biller` | Read/write access to claims, patients, visits |
| `Provider` | Read/write access to visits and patients |
| `FrontDesk` | Read/write access to patients and scheduling |

---

## Recommended API Testing Tool

[Hoppscotch](https://hoppscotch.io) — free, browser-based, no install required.

1. Set the base URL to `https://forager-rcm-backend-production.up.railway.app`
2. Add a header `Authorization: Bearer <your_token>` to all protected requests
3. Set `Content-Type: application/json` for POST/PUT requests

---

## Your Account Details

| Field | Value |
|---|---|
| Email | `yahmed@foragerrcm.com` |
| Role | `Admin` |
| Organization ID | `ff145d75-192c-4a7c-afe2-01e045d1dd29` |
| Organization Name | Forager Family Care |

> Keep your `organizationId` handy — you will need to include it in the body of most POST requests (patients, providers, payors, visits, etc.).
