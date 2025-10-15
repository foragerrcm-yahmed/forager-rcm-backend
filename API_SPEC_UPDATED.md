# Forager RCM - Internal API Specification (Updated)

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

## Convention-Based Error Codes

Error codes follow the pattern: `{ENTITY}_{ERROR_TYPE}`

### Error Types
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Request validation failed
- `DUPLICATE` - Resource already exists
- `FOREIGN_KEY_ERROR` - Referenced resource does not exist
- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Insufficient permissions
- `UPDATE_FAILED` - Update operation failed
- `DELETE_FAILED` - Delete operation failed
- `CREATE_FAILED` - Create operation failed

### Examples
- `ORG_NOT_FOUND` - Organization not found
- `PATIENT_VALIDATION_ERROR` - Patient validation failed
- `PROVIDER_DUPLICATE` - Provider already exists
- `PAYOR_FOREIGN_KEY_ERROR` - Referenced plan does not exist
- `USER_UNAUTHORIZED` - User not authenticated

---

## HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET, PUT, PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 422 | Validation Error |
| 500 | Internal Server Error |

---

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "PATIENT_VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "firstName",
        "message": "First name is required"
      }
    ]
  }
}
```

---

## 1. Organizations API

### List Organizations
**GET** `/organizations`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `search` (optional): Search by name
- `parentOrganizationId` (optional): Filter by parent organization

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "ABC Medical Group",
      "addresses": [
        {
          "type": "billing",
          "street": "123 Main St",
          "city": "New York",
          "state": "NY",
          "zip": "10001"
        }
      ],
      "phone": "555-1234",
      "email": "contact@abc.com",
      "npi": "1234567890",
      "parentOrganizationId": null,
      "createdById": "uuid",
      "updatedById": "uuid",
      "createdAt": 1697123456,
      "updatedAt": 1697123456,
      "createdBy": {
        "id": "uuid",
        "firstName": "Admin",
        "lastName": "User"
      },
      "childOrganizations": []
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### Get Organization
**GET** `/organizations/:id`

**Success Response (200):** Same as list item

**Error Responses:**
- `404` - `ORG_NOT_FOUND`
- `401` - `ORG_UNAUTHORIZED`

### Create Organization
**POST** `/organizations`

**Request Body:**
```json
{
  "name": "ABC Medical Group",                    // REQUIRED, string, 1-255 chars
  "addresses": [                                  // OPTIONAL, array of objects
    {
      "type": "billing",                          // REQUIRED if addresses provided
      "street": "123 Main St",                    // REQUIRED if addresses provided
      "city": "New York",                         // REQUIRED if addresses provided
      "state": "NY",                              // REQUIRED if addresses provided
      "zip": "10001"                              // REQUIRED if addresses provided
    }
  ],
  "phone": "555-1234",                            // OPTIONAL, string, 10-15 chars
  "email": "contact@abc.com",                     // OPTIONAL, valid email
  "npi": "1234567890",                            // OPTIONAL, string, 10 digits
  "parentOrganizationId": "uuid"                  // OPTIONAL, valid UUID
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "ABC Medical Group",
    "addresses": [...],
    "phone": "555-1234",
    "email": "contact@abc.com",
    "npi": "1234567890",
    "parentOrganizationId": null,
    "createdById": "uuid",
    "updatedById": null,
    "createdAt": 1697123456,
    "updatedAt": 1697123456
  }
}
```

**Error Responses:**
- `400` - `ORG_VALIDATION_ERROR` - Missing required field (name)
- `401` - `ORG_UNAUTHORIZED` - Authentication required
- `404` - `ORG_FOREIGN_KEY_ERROR` - Parent organization not found
- `422` - `ORG_VALIDATION_ERROR` - Invalid email, NPI format, etc.

### Update Organization
**PUT** `/organizations/:id`

**Request Body:** (All fields optional except updatedBy)
```json
{
  "name": "ABC Medical Group Updated",            // OPTIONAL
  "addresses": [...],                             // OPTIONAL
  "phone": "555-9999",                            // OPTIONAL
  "email": "newemail@abc.com",                    // OPTIONAL
  "npi": "9876543210",                            // OPTIONAL
  "parentOrganizationId": "uuid"                  // OPTIONAL
}
```

**Note:** `organizationId` cannot be changed. `updatedBy` is automatically set from JWT token.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "ABC Medical Group Updated",
    "updatedById": "uuid",
    "updatedAt": 1697209856
  }
}
```

**Error Responses:**
- `400` - `ORG_VALIDATION_ERROR`
- `401` - `ORG_UNAUTHORIZED`
- `404` - `ORG_NOT_FOUND`
- `422` - `ORG_VALIDATION_ERROR`

### Delete Organization
**DELETE** `/organizations/:id`

**Success Response (204):** No content

**Error Responses:**
- `401` - `ORG_UNAUTHORIZED`
- `404` - `ORG_NOT_FOUND`
- `409` - `ORG_DELETE_FAILED` - Organization has dependent records

---

## 2. Patients API

### List Patients
**GET** `/patients`

**Query Parameters:**
- `page`, `limit` (pagination)
- `search` (optional): Search by name, email, or phone
- `organizationId` (optional): Filter by organization
- `source` (optional): Filter by data source

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "prefix": "Mr.",
      "firstName": "John",
      "middleName": "Michael",
      "lastName": "Doe",
      "suffix": "Jr.",
      "dateOfBirth": 631152000,
      "gender": "Male",
      "ssn": "***-**-1234",
      "phone": "555-1234",
      "email": "john.doe@example.com",
      "address": { "street": "456 Oak Ave", "city": "Boston", "state": "MA", "zip": "02101" },
      "organizationId": "uuid",
      "source": "Forager",
      "createdById": "uuid",
      "updatedById": "uuid",
      "createdAt": 1697123456,
      "updatedAt": 1697123456,
      "insurances": [
        {
          "id": "uuid",
          "planId": "uuid",
          "isPrimary": true,
          "insuredType": "Subscriber",
          "subscriberName": null,
          "subscriberDob": null,
          "memberId": "MEM123456",
          "insuranceCardPath": "/uploads/insurance-cards/card123.jpg",
          "plan": {
            "id": "uuid",
            "planName": "Blue Cross PPO",
            "planType": "PPO",
            "payor": {
              "name": "Blue Cross Blue Shield"
            }
          }
        }
      ]
    }
  ],
  "pagination": { ... }
}
```

### Get Patient
**GET** `/patients/:id`

**Query Parameters:**
- `includeInsurances` (optional): Include insurance policies (default: true)

**Success Response (200):** Same as list item

**Error Responses:**
- `404` - `PATIENT_NOT_FOUND`
- `401` - `PATIENT_UNAUTHORIZED`

### Create Patient
**POST** `/patients`

**Request Body:**
```json
{
  "prefix": "Mr.",                                // OPTIONAL, string, max 10 chars
  "firstName": "John",                            // REQUIRED, string, 1-100 chars
  "middleName": "Michael",                        // OPTIONAL, string, max 100 chars
  "lastName": "Doe",                              // REQUIRED, string, 1-100 chars
  "suffix": "Jr.",                                // OPTIONAL, string, max 10 chars
  "dateOfBirth": 631152000,                       // REQUIRED, Unix timestamp
  "gender": "Male",                               // OPTIONAL, string
  "ssn": "123-45-6789",                           // OPTIONAL, string (encrypted)
  "phone": "555-1234",                            // OPTIONAL, string, 10-15 chars
  "email": "john.doe@example.com",                // OPTIONAL, valid email
  "address": {                                    // OPTIONAL, object
    "street": "456 Oak Ave",
    "city": "Boston",
    "state": "MA",
    "zip": "02101"
  },
  "organizationId": "uuid",                       // REQUIRED, valid UUID
  "source": "Forager",                            // REQUIRED, enum: Forager|ForagerAPI|ForagerCSVUpload
  "insurances": [                                 // OPTIONAL, array of objects
    {
      "planId": "uuid",                           // REQUIRED, valid UUID (must exist in PayorPlan)
      "isPrimary": true,                          // REQUIRED, boolean
      "insuredType": "Subscriber",                // REQUIRED, enum: Subscriber|Dependent
      "subscriberName": "Jane Doe",               // REQUIRED if insuredType=Dependent
      "subscriberDob": 631152000,                 // REQUIRED if insuredType=Dependent, Unix timestamp
      "memberId": "MEM123456",                    // REQUIRED, string
      "insuranceCard": "base64-encoded-image"     // OPTIONAL, base64 string or file upload
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
    "prefix": "Mr.",
    "firstName": "John",
    "middleName": "Michael",
    "lastName": "Doe",
    "suffix": "Jr.",
    "dateOfBirth": 631152000,
    "gender": "Male",
    "ssn": "***-**-1234",
    "phone": "555-1234",
    "email": "john.doe@example.com",
    "address": { ... },
    "organizationId": "uuid",
    "source": "Forager",
    "createdById": "uuid",
    "updatedById": null,
    "createdAt": 1697123456,
    "updatedAt": 1697123456,
    "insurances": [...]
  }
}
```

**Error Responses:**
- `400` - `PATIENT_VALIDATION_ERROR` - Missing required fields
- `401` - `PATIENT_UNAUTHORIZED`
- `404` - `PATIENT_FOREIGN_KEY_ERROR` - Organization or Plan not found
- `422` - `PATIENT_VALIDATION_ERROR` - Invalid email, date format, missing dependent fields

### Update Patient
**PUT** `/patients/:id`

**Request Body:** (All fields optional)
```json
{
  "phone": "555-9999",                            // OPTIONAL
  "email": "newemail@example.com",                // OPTIONAL
  "address": { ... }                              // OPTIONAL
}
```

**Note:** `organizationId` cannot be changed. `updatedBy` is automatically set from JWT token.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "phone": "555-9999",
    "updatedById": "uuid",
    "updatedAt": 1697209856
  }
}
```

**Error Responses:**
- `400` - `PATIENT_VALIDATION_ERROR`
- `401` - `PATIENT_UNAUTHORIZED`
- `403` - `PATIENT_FORBIDDEN` - Can only update patients in your organization
- `404` - `PATIENT_NOT_FOUND`

### Delete Patient
**DELETE** `/patients/:id`

**Success Response (204):** No content

**Error Responses:**
- `401` - `PATIENT_UNAUTHORIZED`
- `404` - `PATIENT_NOT_FOUND`
- `409` - `PATIENT_DELETE_FAILED` - Patient has dependent records

---

## 3. Providers API

### List Providers
**GET** `/providers`

**Query Parameters:**
- `page`, `limit` (pagination)
- `search` (optional): Search by name or NPI
- `organizationId` (optional): Filter by organization
- `specialty` (optional): Filter by specialty
- `licenseType` (optional): Filter by license type
- `source` (optional): Filter by data source

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "firstName": "Jane",
      "middleName": "Marie",
      "lastName": "Smith",
      "npi": "9876543210",
      "specialty": "Cardiology",
      "licenseType": "MD",
      "organizationId": "uuid",
      "source": "Forager",
      "createdById": "uuid",
      "updatedById": "uuid",
      "createdAt": 1697123456,
      "updatedAt": 1697123456
    }
  ],
  "pagination": { ... }
}
```

### Get Provider
**GET** `/providers/:id`

**Success Response (200):** Same as list item

**Error Responses:**
- `404` - `PROVIDER_NOT_FOUND`
- `401` - `PROVIDER_UNAUTHORIZED`

### Create Provider
**POST** `/providers`

**Request Body:**
```json
{
  "firstName": "Jane",                            // REQUIRED, string, 1-100 chars
  "middleName": "Marie",                          // OPTIONAL, string, max 100 chars
  "lastName": "Smith",                            // REQUIRED, string, 1-100 chars
  "npi": "9876543210",                            // OPTIONAL, string, 10 digits
  "specialty": "Cardiology",                      // OPTIONAL, string, 1-100 chars
  "licenseType": "MD",                            // REQUIRED, enum: MD|DO|NP|PA_C|RN|LPN|PT|OT|DC|DPM|DDS|DMD|PharmD|PsyD|PhD|LCSW|LMFT|Other
  "organizationId": "uuid",                       // REQUIRED, valid UUID
  "source": "Forager"                             // REQUIRED, enum: Forager|ForagerAPI|ForagerCSVUpload
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "Jane",
    "middleName": "Marie",
    "lastName": "Smith",
    "npi": "9876543210",
    "specialty": "Cardiology",
    "licenseType": "MD",
    "organizationId": "uuid",
    "source": "Forager",
    "createdById": "uuid",
    "updatedById": null,
    "createdAt": 1697123456,
    "updatedAt": 1697123456
  }
}
```

**Error Responses:**
- `400` - `PROVIDER_VALIDATION_ERROR` - Missing required fields
- `401` - `PROVIDER_UNAUTHORIZED`
- `404` - `PROVIDER_FOREIGN_KEY_ERROR` - Organization not found
- `409` - `PROVIDER_DUPLICATE` - Provider with same NPI already exists
- `422` - `PROVIDER_VALIDATION_ERROR` - Invalid NPI format or enum value

### Update Provider
**PUT** `/providers/:id`

**Request Body:** (All fields optional)
```json
{
  "specialty": "Internal Medicine",               // OPTIONAL
  "npi": "1234567890"                             // OPTIONAL
}
```

**Note:** `organizationId` cannot be changed. `updatedBy` is automatically set from JWT token.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "specialty": "Internal Medicine",
    "updatedById": "uuid",
    "updatedAt": 1697209856
  }
}
```

**Error Responses:**
- `400` - `PROVIDER_VALIDATION_ERROR`
- `401` - `PROVIDER_UNAUTHORIZED`
- `404` - `PROVIDER_NOT_FOUND`

### Delete Provider
**DELETE** `/providers/:id`

**Success Response (204):** No content

**Error Responses:**
- `401` - `PROVIDER_UNAUTHORIZED`
- `404` - `PROVIDER_NOT_FOUND`
- `409` - `PROVIDER_DELETE_FAILED` - Provider has dependent records

---

## 4. Payors API

### List Payors
**GET** `/payors`

**Query Parameters:**
- `page`, `limit` (pagination)
- `search` (optional): Search by name or external payor ID
- `organizationId` (optional): Filter by organization
- `payorCategory` (optional): Filter by category

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Blue Cross Blue Shield",
      "externalPayorId": "BCBS-001",
      "payorCategory": "Commercial",
      "billingTaxonomy": "Health Insurance",
      "address": { "street": "789 Insurance Blvd", "city": "Chicago", "state": "IL", "zip": "60601" },
      "phone": "555-5678",
      "portalUrl": "https://portal.bcbs.com",
      "organizationId": "uuid",
      "createdById": "uuid",
      "updatedById": "uuid",
      "createdAt": 1697123456,
      "updatedAt": 1697123456,
      "plans": [
        {
          "id": "uuid",
          "planName": "Blue Cross PPO",
          "planType": "PPO",
          "isInNetwork": true,
          "createdAt": 1697123456,
          "updatedAt": 1697123456
        }
      ]
    }
  ],
  "pagination": { ... }
}
```

### Get Payor
**GET** `/payors/:id`

**Query Parameters:**
- `includePlans` (optional): Include payor plans (default: true)

**Success Response (200):** Same as list item

**Error Responses:**
- `404` - `PAYOR_NOT_FOUND`
- `401` - `PAYOR_UNAUTHORIZED`

### Create Payor
**POST** `/payors`

**Request Body:**
```json
{
  "name": "Blue Cross Blue Shield",               // REQUIRED, string, 1-255 chars
  "externalPayorId": "BCBS-001",                  // REQUIRED, string, unique, 1-50 chars
  "payorCategory": "Commercial",                  // REQUIRED, string, 1-100 chars
  "billingTaxonomy": "Health Insurance",          // REQUIRED, string, 1-100 chars
  "address": {                                    // OPTIONAL, object
    "street": "789 Insurance Blvd",
    "city": "Chicago",
    "state": "IL",
    "zip": "60601"
  },
  "phone": "555-5678",                            // OPTIONAL, string, 10-15 chars
  "portalUrl": "https://portal.bcbs.com",         // OPTIONAL, string, valid URL
  "organizationId": "uuid",                       // REQUIRED, valid UUID
  "plans": [                                      // REQUIRED, array, min 1 item
    {
      "planName": "Blue Cross PPO",               // REQUIRED, string, 1-255 chars
      "planType": "PPO",                          // REQUIRED, enum: PPO|HMO|EPO|POS|HDHP|Medicaid|Medicare|Other
      "isInNetwork": true                         // REQUIRED, boolean
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
    "name": "Blue Cross Blue Shield",
    "externalPayorId": "BCBS-001",
    "payorCategory": "Commercial",
    "billingTaxonomy": "Health Insurance",
    "address": { ... },
    "phone": "555-5678",
    "portalUrl": "https://portal.bcbs.com",
    "organizationId": "uuid",
    "createdById": "uuid",
    "updatedById": null,
    "createdAt": 1697123456,
    "updatedAt": 1697123456,
    "plans": [
      {
        "id": "uuid",
        "planName": "Blue Cross PPO",
        "planType": "PPO",
        "isInNetwork": true,
        "createdAt": 1697123456,
        "updatedAt": 1697123456
      }
    ]
  }
}
```

**Error Responses:**
- `400` - `PAYOR_VALIDATION_ERROR` - Missing required fields or empty plans array
- `401` - `PAYOR_UNAUTHORIZED`
- `404` - `PAYOR_FOREIGN_KEY_ERROR` - Organization not found
- `409` - `PAYOR_DUPLICATE` - Payor with same externalPayorId already exists
- `422` - `PAYOR_VALIDATION_ERROR` - Invalid URL, enum value, etc.

### Update Payor
**PUT** `/payors/:id`

**Request Body:** (All fields optional)
```json
{
  "name": "Blue Cross Blue Shield Updated",       // OPTIONAL
  "phone": "555-9999",                            // OPTIONAL
  "portalUrl": "https://newportal.bcbs.com"       // OPTIONAL
}
```

**Note:** `organizationId` cannot be changed. `updatedBy` is automatically set from JWT token.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Blue Cross Blue Shield Updated",
    "updatedById": "uuid",
    "updatedAt": 1697209856
  }
}
```

**Error Responses:**
- `400` - `PAYOR_VALIDATION_ERROR`
- `401` - `PAYOR_UNAUTHORIZED`
- `404` - `PAYOR_NOT_FOUND`

### Delete Payor
**DELETE** `/payors/:id`

**Success Response (204):** No content

**Error Responses:**
- `401` - `PAYOR_UNAUTHORIZED`
- `404` - `PAYOR_NOT_FOUND`
- `409` - `PAYOR_DELETE_FAILED` - Payor has dependent records

---

## 5. Users API

### List Users
**GET** `/users`

**Query Parameters:**
- `page`, `limit` (pagination)
- `search` (optional): Search by name or email
- `organizationId` (optional): Filter by organization
- `role` (optional): Filter by role

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "admin@forager.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "Admin",
      "organizationId": "uuid",
      "createdAt": 1697123456,
      "updatedAt": 1697123456,
      "organization": {
        "id": "uuid",
        "name": "ABC Medical Group"
      }
    }
  ],
  "pagination": { ... }
}
```

### Get User
**GET** `/users/:id`

**Success Response (200):** Same as list item

**Error Responses:**
- `404` - `USER_NOT_FOUND`
- `401` - `USER_UNAUTHORIZED`

### Create User
**POST** `/users`

**Request Body:**
```json
{
  "email": "newuser@forager.com",                 // REQUIRED, valid email, unique
  "password": "SecurePassword123!",               // REQUIRED, string, min 8 chars
  "firstName": "John",                            // REQUIRED, string, 1-100 chars
  "lastName": "Doe",                              // REQUIRED, string, 1-100 chars
  "role": "Biller",                               // REQUIRED, enum: Admin|Biller|Provider|FrontDesk
  "organizationId": "uuid"                        // REQUIRED, valid UUID
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "newuser@forager.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "Biller",
    "organizationId": "uuid",
    "createdAt": 1697123456,
    "updatedAt": 1697123456
  }
}
```

**Error Responses:**
- `400` - `USER_VALIDATION_ERROR` - Missing required fields
- `401` - `USER_UNAUTHORIZED`
- `404` - `USER_FOREIGN_KEY_ERROR` - Organization not found
- `409` - `USER_DUPLICATE` - User with email already exists
- `422` - `USER_VALIDATION_ERROR` - Invalid email, weak password, invalid role

### Update User
**PUT** `/users/:id`

**Request Body:** (All fields optional)
```json
{
  "firstName": "Jane",                            // OPTIONAL
  "lastName": "Smith",                            // OPTIONAL
  "role": "Admin"                                 // OPTIONAL
}
```

**Note:** `organizationId` and `email` cannot be changed.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "Admin",
    "updatedAt": 1697209856
  }
}
```

**Error Responses:**
- `400` - `USER_VALIDATION_ERROR`
- `401` - `USER_UNAUTHORIZED`
- `404` - `USER_NOT_FOUND`

### Delete User
**DELETE** `/users/:id`

**Success Response (204):** No content

**Error Responses:**
- `401` - `USER_UNAUTHORIZED`
- `404` - `USER_NOT_FOUND`
- `409` - `USER_DELETE_FAILED` - User has dependent records

---

## Summary of Required Fields

### Organizations
- **Required:** name
- **Optional:** addresses, phone, email, npi, parentOrganizationId

### Patients
- **Required:** firstName, lastName, dateOfBirth, organizationId, source
- **Optional:** prefix, middleName, suffix, gender, ssn, phone, email, address, insurances

### Patient Insurance (if provided)
- **Required:** planId, isPrimary, insuredType, memberId
- **Conditionally Required:** subscriberName, subscriberDob (if insuredType=Dependent)
- **Optional:** insuranceCard

### Providers
- **Required:** firstName, lastName, licenseType, organizationId, source
- **Optional:** middleName, npi, specialty

### Payors
- **Required:** name, externalPayorId, payorCategory, billingTaxonomy, organizationId, plans (array with min 1 item)
- **Optional:** address, phone, portalUrl

### Payor Plans (nested in Payors)
- **Required:** planName, planType, isInNetwork

### Users
- **Required:** email, password, firstName, lastName, role, organizationId
- **Optional:** None

---

## Notes

- All timestamps are Unix timestamps (seconds since epoch)
- All monetary amounts are in USD with 2 decimal places
- Pagination defaults: page=1, limit=20, max limit=100
- `createdBy` and `updatedBy` are automatically set from JWT token
- `organizationId` cannot be changed through PUT endpoints
- SSN fields are encrypted at rest and masked in responses
- Insurance card images are stored securely and paths returned in responses

