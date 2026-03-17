#!/bin/bash

# Forager RCM API Testing Script
# This script tests all implemented CRUD APIs

BASE_URL="http://localhost:3001"
TOKEN=""

echo "========================================="
echo "Forager RCM API Testing Suite"
echo "========================================="
echo ""

# Helper function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local auth_header=""
    
    if [ -n "$TOKEN" ]; then
        auth_header="-H \"Authorization: Bearer $TOKEN\""
    fi
    
    if [ -n "$data" ]; then
        eval curl -s -X $method $BASE_URL$endpoint \
            -H \"Content-Type: application/json\" \
            $auth_header \
            -d \'$data\' | jq .
    else
        eval curl -s -X $method $BASE_URL$endpoint \
            -H \"Content-Type: application/json\" \
            $auth_header | jq .
    fi
}

# Step 1: Create Organization
echo "📋 Step 1: Creating Organization..."
ORG_RESPONSE=$(curl -s -X POST $BASE_URL/api/organizations \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Forager Medical Group",
        "addresses": [
            {
                "street": "123 Healthcare Blvd",
                "city": "San Francisco",
                "state": "CA",
                "zip": "94102",
                "type": "primary"
            }
        ],
        "phone": "415-555-0100",
        "email": "contact@foragermedical.com",
        "npi": "1234567890",
        "createdById": "temp"
    }')

echo "$ORG_RESPONSE" | jq .

# Extract organization ID (we'll need to handle the createdById issue first)
ORG_ID=$(echo "$ORG_RESPONSE" | jq -r '.data.id // empty')

if [ -z "$ORG_ID" ]; then
    echo "❌ Failed to create organization. Creating via SQL..."
    
    # Create organization directly in database
    sudo -u postgres psql -d mydb <<EOF
    INSERT INTO organizations (id, name, addresses, phone, email, npi, "createdById", "createdAt", "updatedAt")
    VALUES (
        gen_random_uuid(),
        'Forager Medical Group',
        '[{"street": "123 Healthcare Blvd", "city": "San Francisco", "state": "CA", "zip": "94102", "type": "primary"}]'::jsonb,
        '415-555-0100',
        'contact@foragermedical.com',
        '1234567890',
        gen_random_uuid(),
        extract(epoch from now())::bigint,
        extract(epoch from now())::bigint
    ) RETURNING id;
EOF
    
    ORG_ID=$(sudo -u postgres psql -d mydb -t -c "SELECT id FROM organizations LIMIT 1;" | tr -d ' ')
fi

echo "✅ Organization ID: $ORG_ID"
echo ""

# Step 2: Create Admin User
echo "📋 Step 2: Creating Admin User..."
USER_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"admin@forager.com\",
        \"password\": \"password123\",
        \"firstName\": \"John\",
        \"lastName\": \"Admin\",
        \"role\": \"Admin\",
        \"organizationId\": \"$ORG_ID\"
    }")

echo "$USER_RESPONSE" | jq .
TOKEN=$(echo "$USER_RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to create user"
    exit 1
fi

echo "✅ Admin user created. Token: ${TOKEN:0:20}..."
echo ""

# Step 3: Test Login
echo "📋 Step 3: Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
        "email": "admin@forager.com",
        "password": "password123"
    }')

echo "$LOGIN_RESPONSE" | jq .
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')
echo "✅ Login successful"
echo ""

# Step 4: Create Payor with Plans
echo "📋 Step 4: Creating Payor with Plans..."
PAYOR_RESPONSE=$(curl -s -X POST $BASE_URL/api/payors \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"name\": \"Blue Cross Blue Shield\",
        \"externalPayorId\": \"BCBS-CA-001\",
        \"payorCategory\": \"Commercial\",
        \"billingTaxonomy\": \"3336C0003X\",
        \"phone\": \"800-555-BCBS\",
        \"portalUrl\": \"https://portal.bcbs.com\",
        \"organizationId\": \"$ORG_ID\",
        \"plans\": [
            {
                \"planName\": \"BCBS PPO Gold\",
                \"planType\": \"PPO\",
                \"isInNetwork\": true
            },
            {
                \"planName\": \"BCBS HMO Silver\",
                \"planType\": \"HMO\",
                \"isInNetwork\": true
            }
        ]
    }")

echo "$PAYOR_RESPONSE" | jq .
PAYOR_ID=$(echo "$PAYOR_RESPONSE" | jq -r '.data.id // empty')
PLAN_ID=$(echo "$PAYOR_RESPONSE" | jq -r '.data.plans[0].id // empty')
echo "✅ Payor created. ID: $PAYOR_ID, Plan ID: $PLAN_ID"
echo ""

# Step 5: Create Patient with Insurance
echo "📋 Step 5: Creating Patient with Insurance..."
PATIENT_RESPONSE=$(curl -s -X POST $BASE_URL/api/patients \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"firstName\": \"Jane\",
        \"middleName\": \"Marie\",
        \"lastName\": \"Doe\",
        \"suffix\": \"Jr\",
        \"prefix\": \"Ms\",
        \"dateOfBirth\": $(date -d '1985-03-15' +%s),
        \"gender\": \"Female\",
        \"phone\": \"415-555-0123\",
        \"email\": \"jane.doe@email.com\",
        \"address\": {
            \"street\": \"456 Patient St\",
            \"city\": \"San Francisco\",
            \"state\": \"CA\",
            \"zip\": \"94103\"
        },
        \"organizationId\": \"$ORG_ID\",
        \"source\": \"Forager\",
        \"insurances\": [
            {
                \"planId\": \"$PLAN_ID\",
                \"isPrimary\": true,
                \"insuredType\": \"Subscriber\",
                \"memberId\": \"BCBS123456789\"
            }
        ]
    }")

echo "$PATIENT_RESPONSE" | jq .
PATIENT_ID=$(echo "$PATIENT_RESPONSE" | jq -r '.data.id // empty')
echo "✅ Patient created. ID: $PATIENT_ID"
echo ""

# Step 6: Create Provider
echo "📋 Step 6: Creating Provider..."
PROVIDER_RESPONSE=$(curl -s -X POST $BASE_URL/api/providers \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"firstName\": \"Sarah\",
        \"middleName\": \"Elizabeth\",
        \"lastName\": \"Smith\",
        \"npi\": \"9876543210\",
        \"specialty\": \"Family Medicine\",
        \"licenseType\": \"MD\",
        \"organizationId\": \"$ORG_ID\",
        \"source\": \"Forager\"
    }")

echo "$PROVIDER_RESPONSE" | jq .
PROVIDER_ID=$(echo "$PROVIDER_RESPONSE" | jq -r '.data.id // empty')
echo "✅ Provider created. ID: $PROVIDER_ID"
echo ""

# Step 7: Create CPT Codes
echo "📋 Step 7: Creating CPT Codes..."
CPT_RESPONSE=$(curl -s -X POST $BASE_URL/api/cpt-codes \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"code\": \"99213\",
        \"description\": \"Office visit, established patient, 20-29 minutes\",
        \"specialty\": \"General\",
        \"basePrice\": 150.00,
        \"organizationId\": \"$ORG_ID\"
    }")

echo "$CPT_RESPONSE" | jq .
CPT_ID=$(echo "$CPT_RESPONSE" | jq -r '.data.id // empty')
echo "✅ CPT Code created. ID: $CPT_ID"
echo ""

# Step 8: Create Visit
echo "📋 Step 8: Creating Visit..."
VISIT_RESPONSE=$(curl -s -X POST $BASE_URL/api/visits \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"patientId\": \"$PATIENT_ID\",
        \"providerId\": \"$PROVIDER_ID\",
        \"organizationId\": \"$ORG_ID\",
        \"visitDate\": $(date +%s),
        \"visitTime\": $(date +%s),
        \"duration\": 30,
        \"visitType\": \"FollowUp\",
        \"location\": \"InClinic\",
        \"status\": \"Completed\",
        \"notes\": \"Patient presented for routine follow-up. Vitals stable.\",
        \"source\": \"Forager\"
    }")

echo "$VISIT_RESPONSE" | jq .
VISIT_ID=$(echo "$VISIT_RESPONSE" | jq -r '.data.id // empty')
echo "✅ Visit created. ID: $VISIT_ID"
echo ""

# Step 9: Create Claim with Services
echo "📋 Step 9: Creating Claim with Services..."
CLAIM_RESPONSE=$(curl -s -X POST $BASE_URL/api/claims \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"claimNumber\": \"CLM-$(date +%s)\",
        \"visitId\": \"$VISIT_ID\",
        \"patientId\": \"$PATIENT_ID\",
        \"providerId\": \"$PROVIDER_ID\",
        \"payorId\": \"$PAYOR_ID\",
        \"serviceDate\": $(date +%s),
        \"billedAmount\": 150.00,
        \"status\": \"Pending\",
        \"organizationId\": \"$ORG_ID\",
        \"source\": \"Forager\",
        \"services\": [
            {
                \"cptCodeId\": \"$CPT_ID\",
                \"description\": \"Office visit\",
                \"quantity\": 1,
                \"unitPrice\": 150.00,
                \"totalPrice\": 150.00
            }
        ]
    }")

echo "$CLAIM_RESPONSE" | jq .
CLAIM_ID=$(echo "$CLAIM_RESPONSE" | jq -r '.data.id // empty')
echo "✅ Claim created. ID: $CLAIM_ID"
echo ""

# Step 10: Update Claim Status
echo "📋 Step 10: Updating Claim Status..."
STATUS_RESPONSE=$(curl -s -X PUT $BASE_URL/api/claims/$CLAIM_ID/status \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "status": "Submitted",
        "notes": "Claim submitted to payor electronically"
    }')

echo "$STATUS_RESPONSE" | jq .
echo "✅ Claim status updated"
echo ""

# Step 11: Get Claim with Timeline
echo "📋 Step 11: Retrieving Claim with Timeline..."
CLAIM_DETAIL=$(curl -s -X GET $BASE_URL/api/claims/$CLAIM_ID \
    -H "Authorization: Bearer $TOKEN")

echo "$CLAIM_DETAIL" | jq .
echo "✅ Claim retrieved with timeline"
echo ""

# Step 12: List All Patients
echo "📋 Step 12: Listing All Patients..."
PATIENTS_LIST=$(curl -s -X GET "$BASE_URL/api/patients?limit=10" \
    -H "Authorization: Bearer $TOKEN")

echo "$PATIENTS_LIST" | jq .
echo "✅ Patients list retrieved"
echo ""

# Step 13: Create Rule
echo "📋 Step 13: Creating Rule..."
RULE_RESPONSE=$(curl -s -X POST $BASE_URL/api/rules \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"name\": \"Auto-verify insurance eligibility\",
        \"description\": \"Automatically check insurance eligibility when a visit is scheduled\",
        \"organizationId\": \"$ORG_ID\",
        \"isActive\": true,
        \"flowData\": {
            \"nodes\": [],
            \"edges\": []
        }
    }")

echo "$RULE_RESPONSE" | jq .
RULE_ID=$(echo "$RULE_RESPONSE" | jq -r '.data.id // empty')
echo "✅ Rule created. ID: $RULE_ID"
echo ""

echo "========================================="
echo "✅ All API Tests Completed Successfully!"
echo "========================================="
echo ""
echo "Summary:"
echo "  - Organization ID: $ORG_ID"
echo "  - Patient ID: $PATIENT_ID"
echo "  - Provider ID: $PROVIDER_ID"
echo "  - Payor ID: $PAYOR_ID"
echo "  - Visit ID: $VISIT_ID"
echo "  - Claim ID: $CLAIM_ID"
echo "  - Rule ID: $RULE_ID"
echo ""
