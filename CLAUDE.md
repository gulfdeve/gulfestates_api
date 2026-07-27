# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Hot-reload dev server via tsx watch
npm run build      # Compile TypeScript to dist/
npm start          # Run production build (node dist/server.js)
```

No test runner is configured beyond Jest being installed — no tests exist yet.

## Architecture Overview

Gulf Estates is a real estate platform backend (Dubai/UAE market). Express 5 REST API with MongoDB/Mongoose, JWT auth, Cloudinary media storage, and multilingual content support.

**Request flow:** `server.ts` → `src/routes/*.routes.ts` → middleware → `src/controllers/*.controller.ts` → `src/models/*.ts`

All routes mount under `/api/<resource>`. Key resource groups:
- `/api/auth`, `/api/admins` — Admin auth + management
- `/api/properties`, `/api/offplans` — Core real estate listings
- `/api/blogs`, `/api/team`, `/api/pages/content` — CMS content
- `/api/contact`, `/api/home-page-leads` — Lead capture
- `/api/jobs`, `/api/job-applications` — Careers
- `/api/favorites`, `/api/reviews`, `/api/testimonials`, `/api/notifications` — User interactions

## Key Patterns

### ESM Imports
TypeScript compiles to ESM. All internal imports **must** end in `.js`:
```ts
import { Property } from '../models/property.model.js'
```

### API Response Format
Use the `ApiResponse` class for all responses:
```ts
res.json(ApiResponse.success(data, 'Message'))
res.json(ApiResponse.paginated(data, paginationMeta))
res.status(400).json(ApiResponse.error('Message', 400))
```

### Authentication & Roles
JWT Bearer token system — single admin system, no public user accounts. Role hierarchy: `superadmin > admin > customer-manager > user`. Guards: `protect`, `restrictToAdmin`, `restrictToSuperAdmin`, `restrictToCustomerManager`, `restrictToAdminOrCustomerManager`.

### Multilingual Content
Properties/OffPlans use nested objects for multilingual fields:
```ts
title: { en: string, fr?: string, es?: string }
slug:  { en: string, fr?: string, es?: string }
```
Blogs use a flat English top-level + `languages.fr` / `languages.es` nested objects. Use `getLocalizedField(field, locale)` which falls back to English.

Slugs are auto-generated in `pre('save')` hooks via `slugify.util.ts` with auto-incrementing suffixes for uniqueness.

### File Uploads
Multer writes to local `uploads/` disk buffer, streams to Cloudinary, then deletes the local copy. File validation lives in `fileSecurity.util.ts` (`isDangerousFile`, `isAllowedImage`, `isAllowedPDF`). Images: JPEG/PNG/WEBP/AVIF up to 5–15 MB. PDFs stored as Cloudinary raw resources.

### Validation
`express-validator` chains are defined separately from route handlers. Pattern:
```ts
router.post('/', validationRules, validate, controller)
```

### Rate Limiting
Named limiters per resource (e.g., `propertyRateLimiter`, `loginRateLimiter`). Requests with a Bearer token or `?admin=true` query param bypass rate limiting. Contact forms: 30 req/day per IP; login: 10 req/hour per IP.

### Pagination
`getPaginationParams()` extracts `page`/`limit` from query; `getPaginationMeta()` builds the response envelope. Default page size: 10, sorted `createdAt` descending. Response includes `{ total, page, limit, pages, hasNext, hasPrev }`.

### CSRF / Origin Check
POST/PUT/DELETE requests are validated against an allowed origins list. Localhost is added only in `development`. Production origins: `gulfestates.ae`, `gulf.smbdigitalzone.com`.

### Error Handling
Global `errorHandler` middleware normalises Mongoose errors (CastError, ValidationError, duplicate key 11000), JWT errors, and Multer errors. Full stack traces in development; sanitised messages in production.

### Logging
Winston logger from `src/utils/logger.util.ts`. Console output is suppressed in production.

## Required Environment Variables

```
MONGO_URI
JWT_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
NODE_ENV              # 'development' | 'production'
PORT                  # default 5000
```

Email variables (Nodemailer) are optional — used by `src/utils/email.util.ts`.
