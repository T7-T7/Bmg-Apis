# Node.js Backend — Planned (TypeScript)

This folder is reserved for the API-management service architecture. No runtime is implemented in the frontend-only stage.

Planned responsibilities:
- API definition CRUD, schemas and validation
- Publishing/version lifecycle
- Authentication, ownership and permission checks
- API request testing and safe runtime dispatch
- Usage counters, rate limiting and audit logs
- Service health and monitoring

Proposed structure:
```
backend/
  src/
    server.ts
    routes/
    controllers/
    services/
    middleware/
    validators/
    storage/
```

The production hosting target is Vercel Hobby. Prefer short request handlers, avoid long-lived processes, background jobs, heavy native dependencies and persistent local disk writes. Store secrets server-side and never expose them to client components. External storage/database selection will be based on free-tier limits and project needs.