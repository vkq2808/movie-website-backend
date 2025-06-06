#!/bin/bash

# Test script for Production Company Initialization from Movies

echo "Testing Production Company Initialization from Movies..."

# Make a POST request to initialize production companies from movies
# Note: You need to replace YOUR_JWT_TOKEN_HERE with a valid admin JWT token
curl -X POST http://localhost:5000/api/production-companies/initialize-from-movies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "Note: This endpoint requires admin authentication."
echo "Please replace YOUR_JWT_TOKEN_HERE with a valid admin JWT token."
echo "Test completed!"
