# Gulf Estates Backend API — Copilot Instructions

## Commands

```bash
npm run dev      # development server with hot reload (tsx watch)
npm run build    # compile TypeScript to dist/
npm start        # run compiled output
```

No test script is configured. Jest is installed but tests are not yet written.

## Architecture

Express 5 + TypeScript (ESM) REST API for a UAE real estate platform. Stack:
- **Database**: MongoDB via Mongoose
- **Media storage**: Cloudinary (all uploads go local → Cloudinary → local file deleted)
- **Auth**: JWT Bearer tokens, admin-only system (no public user accounts)

Request flow: `server.ts` → `routes/*.routes.ts` → middleware chain → `controllers/*.controller.ts` → `models/*.ts`

All routes are mounted under `/api/<resource>` in `src/server.ts`.

## Key Conventions

### ESM imports — always use `.js` extensions
Even though source files are `.ts`, all internal imports must end in `.js`:
```ts
import { protect } from '../middleware/auth.middleware.js';
import Property from '../models/property.model.js';
```

### API response shape
Always use the `ApiResponse` class from `src/utils/response.util.ts`:
```ts
res.json(ApiResponse.success(data, 'Message'));
res.json(ApiResponse.paginated(data, paginationMeta));
res.status(400).json(ApiResponse.error('Message', 400));
```
Raw response objects always have `{ success: boolean, message: string }`.

### Multilingual content
**Properties and OffPlans** store multilingual fields as nested objects — `en` is required, `fr`/`es` are optional:
```ts
title: { en: 'Villa', fr: 'Villa', es: 'Villa' }
location: { en: 'Dubai Marina', fr: '...', es: '...' }
```
Use `getLocalizedField(field, locale)` from `src/utils/localization.util.ts` to resolve to a string.

**Blogs** use a different pattern — English fields are top-level, translations live under `languages.fr` / `languages.es`.

### Slug generation
Slugs are auto-generated via Mongoose `pre('save')` hooks using `src/utils/slugify.util.ts`. Properties and OffPlans generate multilingual slugs (`slug.en`, `slug.fr`, `slug.es`) with auto-incrementing suffixes for uniqueness.

### Authentication & authorization
- `protect` — verifies JWT, attaches `req.admin` (and `req.user` for backward compat)
- Role hierarchy: `superadmin > admin > customer-manager > user`
- Role guards: `restrictToSuperAdmin`, `restrictToAdmin`, `restrictToCustomerManager`, `restrictToAdminOrCustomerManager`
- Standard protected route pattern:
  ```ts
  router.post('/', protect, restrictToAdmin, upload.any(), createProperty);
  ```

### File uploads
Multer writes to `uploads/` (disk storage), then the controller uploads to Cloudinary and calls `fs.unlinkSync()` to remove the local copy — even on error. Never leave files in `uploads/`.
- Images: `properties/images` folder, JPEG/PNG/WEBP/AVIF only, 5–15 MB limit depending on route
- PDFs (brochures): `resource_type: 'raw'`, `properties/brochures` folder
- File validation is in `src/utils/fileSecurity.util.ts` (`isDangerousFile`, `isAllowedImage`, `isAllowedPDF`)

### Rate limiters
Each resource has its own named rate limiter exported from `src/middleware/rateLimiter.middleware.ts`. Requests with a `Bearer` token or `?admin=true` or `x-admin-view: true` header skip rate limiting. Apply limiters on public GET routes only:
```ts
router.get('/', propertyRateLimiter, getAllProperties);
```

### CSRF protection
Custom origin-allowlist middleware in `src/middleware/csrf.middleware.ts` applies to all state-mutating methods (POST/PUT/DELETE). Localhost origins are added only when `NODE_ENV=development`.

### Validation
Use `express-validator` chains, then apply the `validate` middleware from `src/middleware/validation.middleware.ts` to terminate the request on errors. Validation chains and the `validate` runner are separate:
```ts
router.post('/login', loginRateLimiter, loginValidation, validate, login);
```

### Pagination
Use `getPaginationParams(req.query)` and `getPaginationMeta(total, page, limit)` from `src/utils/pagination.util.ts`. Default page size is 10, sorted by `createdAt` descending.

### Error handling
The global `errorHandler` in `src/middleware/error.middleware.ts` handles Mongoose (CastError, ValidationError, duplicate key), JWT, and Multer errors. In development it exposes stack traces; in production it sanitizes 5xx messages. Throw/pass errors to `next(error)` — do not write ad-hoc error responses inside controllers.

### Logging
Use the Winston logger from `src/utils/logger.util.ts` for structured logs. Console output is suppressed in production.

## Environment Variables Required

```
MONGO_URI
JWT_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
NODE_ENV
PORT
```
Email-related env vars are used by `src/utils/email.util.ts` (Nodemailer).
