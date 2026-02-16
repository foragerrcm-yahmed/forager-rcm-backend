# Forager RCM - Remaining API Specification

This document outlines the API specifications for the remaining CRUD operations needed for a fully functioning RCM prototype.

---

## 1. Visits API

### GET /api/visits
List all visits with filtering and pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by patient name or visit ID
- `organizationId` (optional): Filter by organization
- `patientId` (optional): Filter by patient
- `providerId` (optional): Filter by provider
- `status` (optional): Filter by status (Scheduled, Completed, Cancelled, NoShow)
- `dateFrom` (optional): Filter by start date (Unix timestamp)
- `dateTo` (optional): Filter by end date (Unix timestamp)
- `source` (optional): Filter by data source (Forager, ForagerAPI, ForagerCSVUpload)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "patientId": "uuid",
      "providerId": "uuid",
      "organizationId": "uuid",
      "visitDate": 1707000000,
      "visitType": "Office Visit",
      "location": "Main Clinic",
      "status": "Completed",
      "notes": "Patient follow-up",
      "source": "Forager",
      "createdAt": 1707000000,
      "updatedAt": 1707000000,
      "createdBy": { "id": "uuid", "firstName": "John", "lastName": "Doe" },
      "updatedBy": { "id": "uuid", "firstName": "Jane", "lastName": "Smith" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 100 }
}
```

### GET /api/visits/:id
Get a specific visit by ID.

### POST /api/visits
Create a new visit.

**Request Body:**
```json
{
  "patientId": "uuid (required)",
  "providerId": "uuid (required)",
  "organizationId": "uuid (required)",
  "visitDate": 1707000000,
  "visitType": "Office Visit (required)",
  "location": "Main Clinic (optional)",
  "status": "Scheduled (required)",
  "notes": "Patient notes (optional)",
  "source": "Forager (required)"
}
```

**Required Fields:** patientId, providerId, organizationId, visitDate, visitType, status, source

### PUT /api/visits/:id
Update an existing visit.

### DELETE /api/visits/:id
Delete a visit.

---

## 2. Claims API

### GET /api/claims
List all claims with advanced filtering.

**Query Parameters:**
- `page`, `limit`, `search`, `organizationId`, `patientId`, `providerId`, `payorId`
- `status`: Filter by status (Draft, Submitted, Accepted, Denied, Appealed, Paid)
- `dateFrom`, `dateTo`, `amountMin`, `amountMax`
- `includeServices`, `includeTimeline`

### GET /api/claims/:id
Get a specific claim by ID.

### POST /api/claims
Create a new claim.

**Request Body:**
```json
{
  "claimNumber": "CLM-2024-001 (required, unique)",
  "patientId": "uuid (required)",
  "providerId": "uuid (required)",
  "payorId": "uuid (required)",
  "organizationId": "uuid (required)",
  "visitId": "uuid (optional)",
  "serviceDate": 1707000000,
  "billedAmount": 5000,
  "paidAmount": 0,
  "status": "Draft (required)",
  "notes": "Claim notes (optional)",
  "source": "Forager (required)",
  "submissionDate": 1707086400,
  "services": [
    {
      "cptCode": "99213 (required)",
      "quantity": 1,
      "unitPrice": 150,
      "totalPrice": 150
    }
  ]
}
```

### PUT /api/claims/:id
Update an existing claim.

### PUT /api/claims/:id/status
Update only the claim status.

**Request Body:**
```json
{
  "status": "Paid (required)",
  "notes": "Status change notes (optional)"
}
```

### DELETE /api/claims/:id
Delete a claim.

---

## 3. CPT Codes API

### GET /api/cpt-codes
List all CPT codes.

### GET /api/cpt-codes/:id
Get a specific CPT code.

### POST /api/cpt-codes
Create a new CPT code.

**Request Body:**
```json
{
  "code": "99213 (required, unique)",
  "description": "Office visit for established patient (required)",
  "specialty": "General Medicine (optional)",
  "basePrice": 150 (required)",
  "organizationId": "uuid (required)"
}
```

### PUT /api/cpt-codes/:id
Update an existing CPT code.

### DELETE /api/cpt-codes/:id
Delete a CPT code.

---

## 4. Rules API

### GET /api/rules
List all rules.

### GET /api/rules/:id
Get a specific rule.

### POST /api/rules
Create a new rule.

**Request Body:**
```json
{
  "name": "Auto-approve claims under $500 (required)",
  "description": "Rule description (optional)",
  "organizationId": "uuid (required)",
  "isActive": true,
  "flowData": {
    "nodes": [...],
    "edges": [...]
  }
}
```

### PUT /api/rules/:id
Update an existing rule.

### PUT /api/rules/:id/toggle
Toggle the active status of a rule.

### DELETE /api/rules/:id
Delete a rule.

---

## 5. Rule Executions API

### GET /api/rule-executions
List all rule executions.

### GET /api/rule-executions/:id
Get a specific rule execution.

---

## 6. Insurance Policies API

### GET /api/insurance-policies
List all insurance policies.

### GET /api/insurance-policies/:id
Get a specific insurance policy.

### PUT /api/insurance-policies/:id
Update an insurance policy.

### DELETE /api/insurance-policies/:id
Delete an insurance policy.

---

## 7. Attachments API

### GET /api/attachments
List all attachments.

### POST /api/attachments
Upload a new attachment (multipart form data).

**Form Fields:**
- `file`: File to upload (required, max 10MB)
- `claimId`: Claim ID (optional)
- `patientId`: Patient ID (optional)

### GET /api/attachments/:id/download
Download an attachment.

### DELETE /api/attachments/:id
Delete an attachment.

---

## Error Codes

All endpoints use convention-based error codes (e.g., VISIT_NOT_FOUND, CLAIM_VALIDATION_ERROR, etc.)

---

## Rate Limiting

- Standard operations: 1000 requests/hour
- File uploads: 100 requests/hour

---

## Authentication

All endpoints require JWT token in Authorization header.
