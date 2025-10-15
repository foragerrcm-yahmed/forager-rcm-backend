# Forager RCM - Internal API Specification

## Base URL
```
http://localhost:3001/api/internal
```

## Authentication
All internal API endpoints require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <jwt-token>
```

---

## Common Response Patterns

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### List Response (with pagination)
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## 1. Organizations API

### List Organizations
**GET** `/organizations`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by name

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "ABC Medical Group",
      "address": { "street": "123 Main St", "city": "New York", "state": "NY", "zip": "10001" },
      "phone": "555-1234",
      "email": "contact@abc.com",
      "npi": "1234567890",
      "taxId": "12-3456789",
      "createdAt": 1697123456,
      "updatedAt": 1697123456
    }
  ],
  "pagination": { ... }
}
```

### Get Organization
**GET** `/organizations/:id`

### Create Organization
**POST** `/organizations`

**Request Body:**
```json
{
  "name": "ABC Medical Group",
  "address": { "street": "123 Main St", "city": "New York", "state": "NY", "zip": "10001" },
  "phone": "555-1234",
  "email": "contact@abc.com",
  "npi": "1234567890",
  "taxId": "12-3456789"
}
```

### Update Organization
**PUT** `/organizations/:id`

### Delete Organization
**DELETE** `/organizations/:id`

---

## 2. Patients API

### List Patients
**GET** `/patients`

**Query Parameters:**
- `page`, `limit` (pagination)
- `search` (optional): Search by name, email, or phone
- `organizationId` (optional): Filter by organization
- `source` (optional): Filter by data source (Forager, ForagerAPI, ForagerCSVUpload)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "dateOfBirth": 631152000,
      "gender": "Male",
      "ssn": "***-**-1234",
      "phone": "555-1234",
      "email": "john.doe@example.com",
      "address": { "street": "456 Oak Ave", "city": "Boston", "state": "MA", "zip": "02101" },
      "organizationId": "uuid",
      "source": "Forager",
      "createdAt": 1697123456,
      "updatedAt": 1697123456
    }
  ],
  "pagination": { ... }
}
```

### Get Patient
**GET** `/patients/:id`

**Query Parameters:**
- `includeVisits` (optional): Include patient visits (default: false)
- `includeClaims` (optional): Include patient claims (default: false)
- `includeInsurance` (optional): Include insurance policies (default: false)

### Create Patient
**POST** `/patients`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": 631152000,
  "gender": "Male",
  "ssn": "123-45-6789",
  "phone": "555-1234",
  "email": "john.doe@example.com",
  "address": { "street": "456 Oak Ave", "city": "Boston", "state": "MA", "zip": "02101" },
  "organizationId": "uuid",
  "source": "Forager"
}
```

### Update Patient
**PUT** `/patients/:id`

### Delete Patient
**DELETE** `/patients/:id`

---

## 3. Providers API

### List Providers
**GET** `/providers`

**Query Parameters:**
- `page`, `limit` (pagination)
- `search` (optional): Search by name or NPI
- `organizationId` (optional): Filter by organization
- `specialty` (optional): Filter by specialty
- `source` (optional): Filter by data source

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Dr. Jane Smith",
      "npi": "9876543210",
      "specialty": "Cardiology",
      "organizationId": "uuid",
      "source": "Forager",
      "createdAt": 1697123456,
      "updatedAt": 1697123456
    }
  ],
  "pagination": { ... }
}
```

### Get Provider
**GET** `/providers/:id`

**Query Parameters:**
- `includeVisits` (optional): Include provider visits
- `includeClaims` (optional): Include provider claims

### Create Provider
**POST** `/providers`

**Request Body:**
```json
{
  "name": "Dr. Jane Smith",
  "npi": "9876543210",
  "specialty": "Cardiology",
  "organizationId": "uuid",
  "source": "Forager"
}
```

### Update Provider
**PUT** `/providers/:id`

### Delete Provider
**DELETE** `/providers/:id`

---

## 4. Payors API

### List Payors
**GET** `/payors`

**Query Parameters:**
- `page`, `limit` (pagination)
- `search` (optional): Search by name or payor ID
- `planType` (optional): Filter by plan type

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Blue Cross Blue Shield",
      "payorId": "BCBS-001",
      "planType": "PPO",
      "address": { "street": "789 Insurance Blvd", "city": "Chicago", "state": "IL", "zip": "60601" },
      "phone": "555-5678",
      "createdAt": 1697123456,
      "updatedAt": 1697123456
    }
  ],
  "pagination": { ... }
}
```

### Get Payor
**GET** `/payors/:id`

### Create Payor
**POST** `/payors`

**Request Body:**
```json
{
  "name": "Blue Cross Blue Shield",
  "payorId": "BCBS-001",
  "planType": "PPO",
  "address": { "street": "789 Insurance Blvd", "city": "Chicago", "state": "IL", "zip": "60601" },
  "phone": "555-5678"
}
```

### Update Payor
**PUT** `/payors/:id`

### Delete Payor
**DELETE** `/payors/:id`

---

## 5. Visits API

### List Visits
**GET** `/visits`

**Query Parameters:**
- `page`, `limit` (pagination)
- `patientId` (optional): Filter by patient
- `providerId` (optional): Filter by provider
- `organizationId` (optional): Filter by organization
- `status` (optional): Filter by status (Upcoming, Completed, Cancelled, NoShow)
- `location` (optional): Filter by location (InClinic, Telehealth)
- `visitType` (optional): Filter by type (FollowUp, NewPatient)
- `dateFrom` (optional): Filter visits from date (Unix timestamp)
- `dateTo` (optional): Filter visits to date (Unix timestamp)
- `source` (optional): Filter by data source

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "patientId": "uuid",
      "providerId": "uuid",
      "visitDate": 1697123456,
      "visitTime": 1697130000,
      "duration": 30,
      "visitType": "FollowUp",
      "location": "InClinic",
      "status": "Completed",
      "visitSource": "Online Booking",
      "clinicalNotes": "Patient reports improvement...",
      "followUpPlan": "Return in 3 months",
      "organizationId": "uuid",
      "source": "Forager",
      "createdAt": 1697123456,
      "updatedAt": 1697123456,
      "patient": { "firstName": "John", "lastName": "Doe" },
      "provider": { "name": "Dr. Jane Smith" }
    }
  ],
  "pagination": { ... }
}
```

### Get Visit
**GET** `/visits/:id`

**Query Parameters:**
- `includeClaims` (optional): Include associated claims

### Create Visit
**POST** `/visits`

**Request Body:**
```json
{
  "patientId": "uuid",
  "providerId": "uuid",
  "visitDate": 1697123456,
  "visitTime": 1697130000,
  "duration": 30,
  "visitType": "FollowUp",
  "location": "InClinic",
  "status": "Upcoming",
  "visitSource": "Online Booking",
  "clinicalNotes": "",
  "followUpPlan": "",
  "organizationId": "uuid",
  "source": "Forager"
}
```

### Update Visit
**PUT** `/visits/:id`

### Delete Visit
**DELETE** `/visits/:id`

---

## 6. Insurance Policies API

### List Insurance Policies
**GET** `/insurance-policies`

**Query Parameters:**
- `page`, `limit` (pagination)
- `patientId` (optional): Filter by patient
- `payorId` (optional): Filter by payor
- `policyType` (optional): Filter by type (Primary, Secondary)
- `isActive` (optional): Filter by active status (true/false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "patientId": "uuid",
      "payorId": "uuid",
      "memberId": "MEM123456",
      "groupNumber": "GRP789",
      "policyType": "Primary",
      "isActive": true,
      "effectiveDate": 1672531200,
      "terminationDate": null,
      "createdAt": 1697123456,
      "updatedAt": 1697123456,
      "patient": { "firstName": "John", "lastName": "Doe" },
      "payor": { "name": "Blue Cross Blue Shield" }
    }
  ],
  "pagination": { ... }
}
```

### Get Insurance Policy
**GET** `/insurance-policies/:id`

### Create Insurance Policy
**POST** `/insurance-policies`

**Request Body:**
```json
{
  "patientId": "uuid",
  "payorId": "uuid",
  "memberId": "MEM123456",
  "groupNumber": "GRP789",
  "policyType": "Primary",
  "isActive": true,
  "effectiveDate": 1672531200,
  "terminationDate": null
}
```

### Update Insurance Policy
**PUT** `/insurance-policies/:id`

### Delete Insurance Policy
**DELETE** `/insurance-policies/:id`

---

## 7. Claims API

### List Claims
**GET** `/claims`

**Query Parameters:**
- `page`, `limit` (pagination)
- `patientId` (optional): Filter by patient
- `providerId` (optional): Filter by provider
- `payorId` (optional): Filter by payor
- `visitId` (optional): Filter by visit
- `organizationId` (optional): Filter by organization
- `status` (optional): Filter by status (Pending, Submitted, Paid, Denied, ShortPaid, Overpaid)
- `dateFrom` (optional): Filter by service date from
- `dateTo` (optional): Filter by service date to
- `source` (optional): Filter by data source
- `search` (optional): Search by claim number

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "claimNumber": "CLM-2024-001234",
      "visitId": "uuid",
      "patientId": "uuid",
      "providerId": "uuid",
      "payorId": "uuid",
      "serviceDate": 1697123456,
      "submissionDate": 1697209856,
      "creationDate": 1697123456,
      "billedAmount": 500.00,
      "allowedAmount": 450.00,
      "paidAmount": 400.00,
      "adjustmentAmount": 50.00,
      "patientResponsibility": 50.00,
      "status": "Paid",
      "denialCode": null,
      "denialReason": null,
      "notes": "",
      "organizationId": "uuid",
      "source": "Forager",
      "createdAt": 1697123456,
      "updatedAt": 1697209856,
      "patient": { "firstName": "John", "lastName": "Doe" },
      "provider": { "name": "Dr. Jane Smith" },
      "payor": { "name": "Blue Cross Blue Shield" }
    }
  ],
  "pagination": { ... }
}
```

### Get Claim
**GET** `/claims/:id`

**Query Parameters:**
- `includeServices` (optional): Include claim services/line items
- `includeTimeline` (optional): Include claim timeline/history
- `includeAttachments` (optional): Include claim attachments

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "claimNumber": "CLM-2024-001234",
    "...": "...",
    "services": [
      {
        "id": "uuid",
        "cptCode": "99213",
        "description": "Office visit, established patient",
        "quantity": 1,
        "unitPrice": 150.00,
        "totalPrice": 150.00,
        "contractedRate": 135.00,
        "modifiers": null
      }
    ],
    "timeline": [
      {
        "id": "uuid",
        "action": "Claim Created",
        "userId": "uuid",
        "notes": "Initial claim submission",
        "createdAt": 1697123456,
        "user": { "firstName": "Admin", "lastName": "User" }
      }
    ],
    "attachments": [...]
  }
}
```

### Create Claim
**POST** `/claims`

**Request Body:**
```json
{
  "claimNumber": "CLM-2024-001234",
  "visitId": "uuid",
  "patientId": "uuid",
  "providerId": "uuid",
  "payorId": "uuid",
  "serviceDate": 1697123456,
  "billedAmount": 500.00,
  "status": "Pending",
  "notes": "",
  "organizationId": "uuid",
  "source": "Forager",
  "services": [
    {
      "cptCode": "99213",
      "description": "Office visit, established patient",
      "quantity": 1,
      "unitPrice": 150.00,
      "totalPrice": 150.00,
      "contractedRate": 135.00
    }
  ]
}
```

### Update Claim
**PUT** `/claims/:id`

### Update Claim Status
**PATCH** `/claims/:id/status`

**Request Body:**
```json
{
  "status": "Submitted",
  "submissionDate": 1697209856,
  "notes": "Submitted to payor via clearinghouse"
}
```

### Delete Claim
**DELETE** `/claims/:id`

---

## 8. CPT Codes API

### List CPT Codes
**GET** `/cpt-codes`

**Query Parameters:**
- `page`, `limit` (pagination)
- `search` (optional): Search by code or description
- `category` (optional): Filter by category

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "code": "99213",
      "description": "Office or other outpatient visit, established patient, 20-29 minutes",
      "category": "Evaluation and Management",
      "standardPrice": 150.00,
      "createdAt": 1697123456,
      "updatedAt": 1697123456
    }
  ],
  "pagination": { ... }
}
```

### Get CPT Code
**GET** `/cpt-codes/:code`

### Create CPT Code
**POST** `/cpt-codes`

**Request Body:**
```json
{
  "code": "99213",
  "description": "Office or other outpatient visit, established patient, 20-29 minutes",
  "category": "Evaluation and Management",
  "standardPrice": 150.00
}
```

### Update CPT Code
**PUT** `/cpt-codes/:code`

### Delete CPT Code
**DELETE** `/cpt-codes/:code`

---

## 9. Attachments API

### List Attachments
**GET** `/attachments`

**Query Parameters:**
- `page`, `limit` (pagination)
- `claimId` (optional): Filter by claim
- `visitId` (optional): Filter by visit

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "claimId": "uuid",
      "visitId": null,
      "fileName": "medical-record.pdf",
      "fileType": "application/pdf",
      "fileSize": 1024000,
      "filePath": "/uploads/2024/10/medical-record.pdf",
      "uploadedById": "uuid",
      "createdAt": 1697123456,
      "uploadedBy": { "firstName": "Admin", "lastName": "User" }
    }
  ],
  "pagination": { ... }
}
```

### Get Attachment
**GET** `/attachments/:id`

### Upload Attachment
**POST** `/attachments`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: File to upload
- `claimId` (optional): Associated claim ID
- `visitId` (optional): Associated visit ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fileName": "medical-record.pdf",
    "fileType": "application/pdf",
    "fileSize": 1024000,
    "filePath": "/uploads/2024/10/medical-record.pdf",
    "createdAt": 1697123456
  }
}
```

### Download Attachment
**GET** `/attachments/:id/download`

**Response:** Binary file stream

### Delete Attachment
**DELETE** `/attachments/:id`

---

## 10. Rules API

### List Rules
**GET** `/rules`

**Query Parameters:**
- `page`, `limit` (pagination)
- `organizationId` (optional): Filter by organization
- `triggerType` (optional): Filter by trigger type
- `isActive` (optional): Filter by active status

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Auto-deny claims over $10,000",
      "description": "Automatically flag claims exceeding $10,000 for manual review",
      "triggerType": "claim_creation",
      "conditions": { "billedAmount": { "gt": 10000 } },
      "actions": { "setStatus": "Pending", "addNote": "Requires manual review" },
      "isActive": true,
      "flowData": { "nodes": [...], "edges": [...] },
      "organizationId": "uuid",
      "createdAt": 1697123456,
      "updatedAt": 1697123456
    }
  ],
  "pagination": { ... }
}
```

### Get Rule
**GET** `/rules/:id`

**Query Parameters:**
- `includeExecutions` (optional): Include recent executions

### Create Rule
**POST** `/rules`

**Request Body:**
```json
{
  "name": "Auto-deny claims over $10,000",
  "description": "Automatically flag claims exceeding $10,000 for manual review",
  "triggerType": "claim_creation",
  "conditions": { "billedAmount": { "gt": 10000 } },
  "actions": { "setStatus": "Pending", "addNote": "Requires manual review" },
  "isActive": true,
  "flowData": { "nodes": [...], "edges": [...] },
  "organizationId": "uuid"
}
```

### Update Rule
**PUT** `/rules/:id`

### Toggle Rule Status
**PATCH** `/rules/:id/toggle`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "isActive": false
  }
}
```

### Delete Rule
**DELETE** `/rules/:id`

---

## 11. Rule Executions API

### List Rule Executions
**GET** `/rule-executions`

**Query Parameters:**
- `page`, `limit` (pagination)
- `ruleId` (optional): Filter by rule
- `entityType` (optional): Filter by entity type (e.g., "claim", "visit")
- `entityId` (optional): Filter by entity ID
- `result` (optional): Filter by result (e.g., "success", "failure")
- `dateFrom` (optional): Filter from date
- `dateTo` (optional): Filter to date

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "ruleId": "uuid",
      "entityType": "claim",
      "entityId": "uuid",
      "result": "success",
      "executedAt": 1697123456,
      "rule": { "name": "Auto-deny claims over $10,000" }
    }
  ],
  "pagination": { ... }
}
```

### Get Rule Execution
**GET** `/rule-executions/:id`

---

## 12. Dashboard & Analytics API

### Get Dashboard Stats
**GET** `/dashboard/stats`

**Query Parameters:**
- `organizationId` (optional): Filter by organization
- `dateFrom` (optional): Start date for stats
- `dateTo` (optional): End date for stats

**Response:**
```json
{
  "success": true,
  "data": {
    "totalClaims": 1250,
    "totalBilledAmount": 625000.00,
    "totalPaidAmount": 550000.00,
    "claimsByStatus": {
      "Pending": 150,
      "Submitted": 200,
      "Paid": 800,
      "Denied": 100
    },
    "avgProcessingTime": 14.5,
    "denialRate": 8.0,
    "collectionRate": 88.0
  }
}
```

### Get Claims by Status
**GET** `/dashboard/claims-by-status`

### Get Revenue Trends
**GET** `/dashboard/revenue-trends`

**Query Parameters:**
- `period` (optional): "daily", "weekly", "monthly" (default: "monthly")
- `dateFrom`, `dateTo` (optional)

---

## Notes

- All timestamps are Unix timestamps (seconds since epoch)
- All monetary amounts are in USD with 2 decimal places
- Pagination defaults: page=1, limit=20, max limit=100
- All DELETE operations are soft deletes where applicable
- All endpoints require valid JWT authentication
- Role-based access control is enforced on all endpoints

