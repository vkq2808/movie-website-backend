#!/bin/bash

# Production Company API Test Script
# This script tests all the production company API endpoints

BASE_URL="http://localhost:3000"
API_BASE="$BASE_URL/production-companies"

echo "🎬 Testing Production Company API Endpoints"
echo "==========================================="

# Test 1: Get all production companies
echo "📋 Test 1: Get all production companies"
curl -s -X GET "$API_BASE" | jq '.'
echo -e "\n"

# Test 2: Search for production companies
echo "🔍 Test 2: Search for production companies (Disney)"
curl -s -X GET "$API_BASE/search?q=Disney&limit=5" | jq '.'
echo -e "\n"

# Test 3: Get popular production companies
echo "⭐ Test 3: Get popular production companies"
curl -s -X GET "$API_BASE/popular?limit=10" | jq '.'
echo -e "\n"

# Test 4: Get production companies by country
echo "🌍 Test 4: Get production companies by country (US)"
curl -s -X GET "$API_BASE/by-country/US" | jq '.'
echo -e "\n"

# Test 5: Create a new production company
echo "➕ Test 5: Create a new production company"
NEW_COMPANY=$(curl -s -X POST "$API_BASE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Studios",
    "description": "A test film production company",
    "homepage": "https://teststudios.com",
    "headquarters": "Los Angeles, California",
    "origin_country": "US",
    "original_id": 999999,
    "is_active": true
  }')

echo $NEW_COMPANY | jq '.'

# Extract the ID of the created company for further tests
COMPANY_ID=$(echo $NEW_COMPANY | jq -r '.data.id')
echo "Created company ID: $COMPANY_ID"
echo -e "\n"

# Test 6: Get production company by ID
if [ "$COMPANY_ID" != "null" ] && [ -n "$COMPANY_ID" ]; then
    echo "📖 Test 6: Get production company by ID"
    curl -s -X GET "$API_BASE/$COMPANY_ID" | jq '.'
    echo -e "\n"

    # Test 7: Update production company
    echo "✏️ Test 7: Update production company"
    curl -s -X PUT "$API_BASE/$COMPANY_ID" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "Updated Test Studios",
        "description": "An updated test film production company"
      }' | jq '.'
    echo -e "\n"

    # Test 8: Get movies by production company
    echo "🎥 Test 8: Get movies by production company"
    curl -s -X GET "$API_BASE/$COMPANY_ID/movies?limit=5" | jq '.'
    echo -e "\n"

    # Test 9: Delete production company
    echo "🗑️ Test 9: Delete production company"
    curl -s -X DELETE "$API_BASE/$COMPANY_ID" | jq '.'
    echo -e "\n"
else
    echo "❌ Could not create test company, skipping ID-based tests"
fi

# Test 10: Test error handling - Get non-existent company
echo "❗ Test 10: Test error handling - Get non-existent company"
curl -s -X GET "$API_BASE/non-existent-id" | jq '.'
echo -e "\n"

# Test 11: Test validation - Create company with missing required fields
echo "⚠️ Test 11: Test validation - Create company with missing required fields"
curl -s -X POST "$API_BASE" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Company without name or original_id"
  }' | jq '.'
echo -e "\n"

# Test 12: Test search with empty query
echo "🔍 Test 12: Test search with empty query"
curl -s -X GET "$API_BASE/search" | jq '.'
echo -e "\n"

# Test 13: Test filtering with query parameters
echo "🔎 Test 13: Test filtering with query parameters"
curl -s -X GET "$API_BASE?origin_country=US&is_active=true&limit=3" | jq '.'
echo -e "\n"

echo "✅ Production Company API testing completed!"
echo "Note: Some tests may fail if the database is empty or if there are no existing companies."
echo "To test movie associations, you'll need to have movies in the database first."
