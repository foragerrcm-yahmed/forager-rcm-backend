# Forager RCM - Authentication API Documentation

## Base URL
```
http://localhost:3001
```

## Authentication Endpoints

### 1. User Registration

**Endpoint:** `POST /api/auth/register`

**Description:** Create a new user account

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "Admin",
  "organizationId": "org-uuid-here"
}
```

**Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "Admin",
    "organizationId": "org-uuid-here"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields
- `409 Conflict`: User with email already exists
- `500 Internal Server Error`: Server error

---

### 2. User Login

**Endpoint:** `POST /api/auth/login`

**Description:** Authenticate a user and receive a JWT token

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "Admin",
    "organizationId": "org-uuid-here"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing email or password
- `401 Unauthorized`: Invalid email or password
- `500 Internal Server Error`: Server error

---

### 3. Get User Profile

**Endpoint:** `GET /api/auth/profile`

**Description:** Get the current authenticated user's profile

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "user-uuid",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "Admin",
    "organizationId": "org-uuid-here",
    "createdAt": 1697123456,
    "updatedAt": 1697123456
  }
}
```

**Error Responses:**
- `401 Unauthorized`: No token provided
- `403 Forbidden`: Invalid or expired token
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

---

## Authentication Flow

1. **Register a new user** using `/api/auth/register`
2. **Login** using `/api/auth/login` to receive a JWT token
3. **Include the token** in the `Authorization` header for all protected endpoints:
   ```
   Authorization: Bearer <your-jwt-token>
   ```

## User Roles

The system supports the following user roles:
- `Admin`: Full system access
- `Biller`: Billing and claims management
- `Provider`: Provider-specific access
- `FrontDesk`: Front desk operations

## Security Notes

- Passwords are hashed using bcrypt with 10 salt rounds
- JWT tokens expire after 7 days
- Tokens are signed with a secret key (configured in `.env`)
- All timestamps are stored as Unix timestamps (BigInt)

## Example cURL Commands

### Register a User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User",
    "role": "Admin",
    "organizationId": "test-org-id"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

### Get Profile (replace TOKEN with actual JWT)
```bash
curl -X GET http://localhost:3001/api/auth/profile \
  -H "Authorization: Bearer TOKEN"
```

## Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

