#!/bin/sh

echo "⏳ Running database migrations..."
npm run migration:run

echo "🚀 Starting NestJS server..."
npm run start
