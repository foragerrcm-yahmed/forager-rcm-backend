# Forager RCM - Internal API Specification (v2)

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

## HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, PATCH requests |
| 201 | Created | Successful POST request (resource created) |
| 204 | No Content | Successful DELETE request |
| 400 | Bad Request | Invalid request body or parameters |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions for the operation |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists (e.g., duplicate email) |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "firstName",
        "message": "First name is required"
      }
    ]
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_REQUIRED` | No authentication token provided |
| `INVALID_TOKEN` | Token is invalid or expired |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| `RESOURCE_NOT_FOUND` | Requested resource does not exist |
| `DUPLICATE_RESOURCE` | Resource with same identifier already exists |
| `FOREIGN_KEY_ERROR` | Referenced resource does not exist |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Unexpected server error |

---

## Field Validation Rules

### Common Rules
- **UUID fields**: Must be valid UUID v4 format
- **Email fields**: Must be valid email format
- **Phone fields**: 10-15 digits, optional formatting
- **Dates**: Unix timestamp (seconds since epoch)
- **Monetary values**: Decimal with 2 decimal places, non-negative
- **Enum fields**: Must match one of the defined enum values

---

## 1. Organizations API

### Create Organization
**POST** `/organizations`

**Request Body:**
```json
{
  "name": "ABC Medical Group",              // REQUIRED, string, 1-255 chars
  "address": {                              // OPTIONAL, object
    "street": "123 Main St",                // REQUIRED if address provided
    "city": "New York",                     // REQUIRED if address provided
    "state": "NY",                          // REQUIRED if address provided
    "zip": "10001"                          // REQUIRED if address provided
  },
  "phone": "555-1234",                      // OPTIONAL, string, 10-15 chars
  "email": "contact@abc.com",               // OPTIONAL, valid email
  "npi": "1234567890",                      // OPTIONAL, string, 10 digits
  "taxId": "12-3456789"                     // OPTIONAL, string
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "ABC Medical Group",
    "address": { ... },
    "phone": "555-1234",
    "email": "contact@abc.com",
    "npi": "1234567890",
    "taxId": "12-3456789",
    "createdAt": 1697123456,
    "updatedAt": 1697123456
  }
}
```

**Error Responses:**
- `400` - Missing required field (name)
- `401` - Authentication required
- `422` - Validation error (invalid email, NPI format, etc.)
- `500` - Internal server error

### Update Organization
**PUT** `/organizations/:id`

**Request Body:** (All fields optional, only include fields to update)
```json
{
  "name": "ABC Medical Group Updated",      // OPTIONAL
  "phone": "555-9999"                       // OPTIONAL
}
```

**Error Responses:**
- `400` - Invalid request body
- `401` - Authentication required
- `404` - Organization not found
- `422` - Validation error
- `500` - Internal server error

---

## 2. Patients API

### Create Patient
**POST** `/patients`

**Request Body:**
```json
{
  "firstName": "John",                      // REQUIRED, string, 1-100 chars
  "lastName": "Doe",                        // REQUIRED, string, 1-100 chars
  "dateOfBirth": 631152000,                 // REQUIRED, Unix timestamp
  "gender": "Male",                         // OPTIONAL, string
  "ssn": "123-45-6789",                     // OPTIONAL, string (will be encrypted)
  "phone": "555-1234",                      // OPTIONAL, string, 10-15 chars
  "email": "john.doe@example.com",          // OPTIONAL, valid email
  "address": {                              // OPTIONAL, object
    "street": "456 Oak Ave",
    "city": "Boston",
    "state": "MA",
    "zip": "02101"
  },
  "organizationId": "uuid",                 // REQUIRED, valid UUID
  "source": "Forager"                       // OPTIONAL, enum: Forager|ForagerAPI|ForagerCSVUpload, default: Forager
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": 631152000,
    "gender": "Male",
    "ssn": "***-**-1234",                   // Masked in response
    "phone": "555-1234",
    "email": "john.doe@example.com",
    "address": { ... },
    "organizationId": "uuid",
    "source": "Forager",
    "createdAt": 1697123456,
    "updatedAt": 1697123456
  }
}
```

**Error Responses:**
- `400` - Missing required fields (firstName, lastName, dateOfBirth, organizationId)
- `401` - Authentication required
- `404` - Organization not found (invalid organizationId)
- `422` - Validation error (invalid email, date format, etc.)
- `500` - Internal server error

### Update Patient
**PUT** `/patients/:id`

**Request Body:** (All fields optional)
```json
{
  "phone": "555-9999",                      // OPTIONAL
  "email": "newemail@example.com"           // OPTIONAL
}
```

**Error Responses:**
- `400` - Invalid request body
- `401` - Authentication required
- `403` - Insufficient permissions (can only update patients in your organization)
- `404` - Patient not found
- `422` - Validation error
- `500` - Internal server error

---

## 3. Providers API

### Create Provider
**POST** `/providers`

**Request Body:**
```json
{
  "name": "Dr. Jane Smith",                 // REQUIRED, string, 1-255 chars
  "npi": "9876543210",                      // OPTIONAL, string, 10 digits
  "specialty": "Cardiology",                // OPTIONAL, string, 1-100 chars
  "organizationId": "uuid",                 // REQUIRED, valid UUID
  "source": "Forager"                       // OPTIONAL, enum: Forager|ForagerAPI|ForagerCSVUpload, default: Forager
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Dr. Jane Smith",
    "npi": "9876543210",
    "specialty": "Cardiology",
    "organizationId": "uuid",
    "source": "Forager",
    "createdAt": 1697123456,
    "updatedAt": 1697123456
  }
}
```

**Error Responses:**
- `400` - Missing required fields (name, organizationId)
- `401` - Authentication required
- `404` - Organization not found
- `409` - Provider with same NPI already exists
- `422` - Validation error (invalid NPI format)
- `500` - Internal server error

---

## 4. Payors API

### Create Payor
**POST** `/payors`

**Request Body:**
```json
{
  "name": "Blue Cross Blue Shield",         // REQUIRED, string, 1-255 chars
  "payorId": "BCBS-001",                    // REQUIRED, string, unique, 1-50 chars
  "planType": "PPO",                        // OPTIONAL, string, 1-100 chars
  "address": {                              // OPTIONAL, object
    "street": "789 Insurance Blvd",
    "city": "Chicago",
    "state": "IL",
    "zip": "60601"
  },
  "phone": "555-5678"                       // OPTIONAL, string, 10-15 chars
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Blue Cross Blue Shield",
    "payorId": "BCBS-001",
    "planType": "PPO",
    "address": { ... },
    "phone": "555-5678",
    "createdAt": 1697123456,
    "updatedAt": 1697123456
  }
}
```

**Error Responses:**
- `400` - Missing required fields (name, payorId)
- `401` - Authentication required
- `409` - Payor with same payorId already exists
- `422` - Validation error
- `500` - Internal server error

---

## 5. Visits API

### Create Visit
**POST** `/visits`

**Request Body:**
```json
{
  "patientId": "uuid",                      // REQUIRED, valid UUID
  "providerId": "uuid",                     // REQUIRED, valid UUID
  "visitDate": 1697123456,                  // REQUIRED, Unix timestamp
  "visitTime": 1697130000,                  // REQUIRED, Unix timestamp
  "duration": 30,                           // REQUIRED, integer, minutes (1-480)
  "visitType": "FollowUp",                  // REQUIRED, enum: FollowUp|NewPatient
  "location": "InClinic",                   // REQUIRED, enum: InClinic|Telehealth
  "status": "Upcoming",                     // REQUIRED, enum: Upcoming|Completed|Cancelled|NoShow
  "visitSource": "Online Booking",          // OPTIONAL, string
  "clinicalNotes": "",                      // OPTIONAL, string
  "followUpPlan": "",                       // OPTIONAL, string
  "organizationId": "uuid",                 // REQUIRED, valid UUID
  "source": "Forager"                       // OPTIONAL, enum: Forager|ForagerAPI|ForagerCSVUpload, default: Forager
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
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
    "source": "Forager",
    "createdAt": 1697123456,
    "updatedAt": 1697123456
  }
}
```

**Error Responses:**
- `400` - Missing required fields
- `401` - Authentication required
- `404` - Patient, Provider, or Organization not found
- `422` - Validation error (invalid enum values, duration out of range)
- `500` - Internal server error

---

## 6. Insurance Policies API

### Create Insurance Policy
**POST** `/insurance-policies`

**Request Body:**
```json
{
  "patientId": "uuid",                      // REQUIRED, valid UUID
  "payorId": "uuid",                        // REQUIRED, valid UUID
  "memberId": "MEM123456",                  // REQUIRED, string, 1-50 chars
  "groupNumber": "GRP789",                  // OPTIONAL, string, 1-50 chars
  "policyType": "Primary",                  // REQUIRED, enum: Primary|Secondary
  "isActive": true,                         // OPTIONAL, boolean, default: true
  "effectiveDate": 1672531200,              // REQUIRED, Unix timestamp
  "terminationDate": null                   // OPTIONAL, Unix timestamp
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
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
    "updatedAt": 1697123456
  }
}
```

**Error Responses:**
- `400` - Missing required fields (patientId, payorId, memberId, policyType, effectiveDate)
- `401` - Authentication required
- `404` - Patient or Payor not found
- `422` - Validation error (terminationDate before effectiveDate, invalid enum)
- `500` - Internal server error

---

## 7. Claims API

### Create Claim
**POST** `/claims`

**Request Body:**
```json
{
  "claimNumber": "CLM-2024-001234",         // REQUIRED, string, unique, 1-50 chars
  "visitId": "uuid",                        // OPTIONAL, valid UUID
  "patientId": "uuid",                      // REQUIRED, valid UUID
  "providerId": "uuid",                     // REQUIRED, valid UUID
  "payorId": "uuid",                        // REQUIRED, valid UUID
  "serviceDate": 1697123456,                // REQUIRED, Unix timestamp
  "billedAmount": 500.00,                   // REQUIRED, decimal, >= 0
  "status": "Pending",                      // REQUIRED, enum: Pending|Submitted|Paid|Denied|ShortPaid|Overpaid
  "notes": "",                              // OPTIONAL, string
  "organizationId": "uuid",                 // REQUIRED, valid UUID
  "source": "Forager",                      // OPTIONAL, enum: Forager|ForagerAPI|ForagerCSVUpload, default: Forager
  "services": [                             // REQUIRED, array, min 1 item
    {
      "cptCode": "99213",                   // REQUIRED, valid CPT code
      "description": "Office visit",        // OPTIONAL, string
      "quantity": 1,                        // REQUIRED, integer, >= 1
      "unitPrice": 150.00,                  // REQUIRED, decimal, >= 0
      "totalPrice": 150.00,                 // REQUIRED, decimal, >= 0
      "contractedRate": 135.00,             // OPTIONAL, decimal, >= 0
      "modifiers": null                     // OPTIONAL, JSON object
    }
  ]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "claimNumber": "CLM-2024-001234",
    "visitId": "uuid",
    "patientId": "uuid",
    "providerId": "uuid",
    "payorId": "uuid",
    "serviceDate": 1697123456,
    "submissionDate": null,
    "creationDate": 1697123456,
    "billedAmount": 500.00,
    "allowedAmount": null,
    "paidAmount": null,
    "adjustmentAmount": null,
    "patientResponsibility": null,
    "status": "Pending",
    "denialCode": null,
    "denialReason": null,
    "notes": "",
    "organizationId": "uuid",
    "source": "Forager",
    "createdAt": 1697123456,
    "updatedAt": 1697123456,
    "services": [
      {
        "id": "uuid",
        "cptCode": "99213",
        "description": "Office visit",
        "quantity": 1,
        "unitPrice": 150.00,
        "totalPrice": 150.00,
        "contractedRate": 135.00,
        "modifiers": null,
        "createdAt": 1697123456
      }
    ]
  }
}
```

**Error Responses:**
- `400` - Missing required fields or empty services array
- `401` - Authentication required
- `404` - Patient, Provider, Payor, Visit, or CPT Code not found
- `409` - Claim with same claimNumber already exists
- `422` - Validation error (negative amounts, invalid status, services total doesn't match billedAmount)
- `500` - Internal server error

### Update Claim Status
**PATCH** `/claims/:id/status`

**Request Body:**
```json
{
  "status": "Submitted",                    // REQUIRED, enum: Pending|Submitted|Paid|Denied|ShortPaid|Overpaid
  "submissionDate": 1697209856,             // OPTIONAL, Unix timestamp (required if status=Submitted)
  "paidAmount": 400.00,                     // OPTIONAL, decimal (required if status=Paid)
  "allowedAmount": 450.00,                  // OPTIONAL, decimal
  "adjustmentAmount": 50.00,                // OPTIONAL, decimal
  "patientResponsibility": 50.00,           // OPTIONAL, decimal
  "denialCode": "CO-45",                    // OPTIONAL, string (required if status=Denied)
  "denialReason": "Lack of documentation",  // OPTIONAL, string (required if status=Denied)
  "notes": "Submitted via clearinghouse"    // OPTIONAL, string
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "Submitted",
    "submissionDate": 1697209856,
    "updatedAt": 1697209856
  }
}
```

**Error Responses:**
- `400` - Missing required fields for status transition
- `401` - Authentication required
- `404` - Claim not found
- `422` - Invalid status transition or validation error
- `500` - Internal server error

---

## 8. CPT Codes API

### Create CPT Code
**POST** `/cpt-codes`

**Request Body:**
```json
{
  "code": "99213",                          // REQUIRED, string, unique, 5 chars
  "description": "Office visit, 20-29 min", // REQUIRED, string, 1-500 chars
  "category": "Evaluation and Management",  // OPTIONAL, string, 1-100 chars
  "standardPrice": 150.00                   // REQUIRED, decimal, >= 0
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "code": "99213",
    "description": "Office or other outpatient visit, established patient, 20-29 minutes",
    "category": "Evaluation and Management",
    "standardPrice": 150.00,
    "createdAt": 1697123456,
    "updatedAt": 1697123456
  }
}
```

**Error Responses:**
- `400` - Missing required fields (code, description, standardPrice)
- `401` - Authentication required
- `409` - CPT code already exists
- `422` - Validation error (invalid code format, negative price)
- `500` - Internal server error

---

## 9. Attachments API

### Upload Attachment
**POST** `/attachments`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: File to upload                   // REQUIRED, max size: 10MB
- `claimId`: "uuid"                        // OPTIONAL, valid UUID (must provide claimId OR visitId)
- `visitId`: "uuid"                        // OPTIONAL, valid UUID (must provide claimId OR visitId)

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "claimId": "uuid",
    "visitId": null,
    "fileName": "medical-record.pdf",
    "fileType": "application/pdf",
    "fileSize": 1024000,
    "filePath": "/uploads/2024/10/medical-record.pdf",
    "uploadedById": "uuid",
    "createdAt": 1697123456
  }
}
```

**Error Responses:**
- `400` - No file provided or missing claimId/visitId
- `401` - Authentication required
- `404` - Claim or Visit not found
- `413` - File too large (max 10MB)
- `422` - Invalid file type (only PDF, PNG, JPG, DOCX allowed)
- `500` - Internal server error

---

## 10. Rules API

### Create Rule
**POST** `/rules`

**Request Body:**
```json
{
  "name": "Auto-flag high-value claims",   // REQUIRED, string, 1-255 chars
  "description": "Flag claims over $10k",  // OPTIONAL, string
  "triggerType": "claim_creation",         // REQUIRED, string, 1-50 chars
  "conditions": {                          // OPTIONAL, JSON object
    "billedAmount": { "gt": 10000 }
  },
  "actions": {                             // OPTIONAL, JSON object
    "setStatus": "Pending",
    "addNote": "Requires manual review"
  },
  "isActive": true,                        // OPTIONAL, boolean, default: true
  "flowData": {                            // OPTIONAL, JSON object (React Flow data)
    "nodes": [...],
    "edges": [...]
  },
  "organizationId": "uuid"                 // REQUIRED, valid UUID
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Auto-flag high-value claims",
    "description": "Flag claims over $10k",
    "triggerType": "claim_creation",
    "conditions": { ... },
    "actions": { ... },
    "isActive": true,
    "flowData": { ... },
    "organizationId": "uuid",
    "createdAt": 1697123456,
    "updatedAt": 1697123456
  }
}
```

**Error Responses:**
- `400` - Missing required fields (name, triggerType, organizationId)
- `401` - Authentication required
- `404` - Organization not found
- `422` - Validation error (invalid JSON in conditions/actions/flowData)
- `500` - Internal server error

---

## Summary of Required Fields by Entity

### Organizations
- **Required:** name
- **Optional:** address, phone, email, npi, taxId

### Patients
- **Required:** firstName, lastName, dateOfBirth, organizationId
- **Optional:** gender, ssn, phone, email, address, source

### Providers
- **Required:** name, organizationId
- **Optional:** npi, specialty, source

### Payors
- **Required:** name, payorId
- **Optional:** planType, address, phone

### Visits
- **Required:** patientId, providerId, visitDate, visitTime, duration, visitType, location, status, organizationId
- **Optional:** visitSource, clinicalNotes, followUpPlan, source

### Insurance Policies
- **Required:** patientId, payorId, memberId, policyType, effectiveDate
- **Optional:** groupNumber, isActive, terminationDate

### Claims
- **Required:** claimNumber, patientId, providerId, payorId, serviceDate, billedAmount, status, organizationId, services (array with at least 1 item)
- **Optional:** visitId, notes, source

### Claim Services (nested in Claims)
- **Required:** cptCode, quantity, unitPrice, totalPrice
- **Optional:** description, contractedRate, modifiers

### CPT Codes
- **Required:** code, description, standardPrice
- **Optional:** category

### Attachments
- **Required:** file, (claimId OR visitId)
- **Optional:** N/A

### Rules
- **Required:** name, triggerType, organizationId
- **Optional:** description, conditions, actions, isActive, flowData

---

## Rate Limiting

- **Authenticated requests:** 1000 requests per hour per user
- **File uploads:** 100 uploads per hour per user
- **Bulk operations:** 10 requests per hour per user

When rate limit is exceeded, API returns:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 3600 seconds.",
    "retryAfter": 3600
  }
}
```

