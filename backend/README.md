# Node.js Backend — Planned

This directory is reserved for the dedicated Node.js API management service.

Planned responsibilities:
- API definition CRUD and validation
- API publishing and version lifecycle
- Authentication, ownership and access control
- Request testing and runtime dispatch
- Usage counters, rate limits and audit logs
- Monitoring and status collection

The backend is intentionally not implemented in this UI-only stage. Keep secrets and execution logic server-side; never place them in the Next.js browser bundle.

Planned service layout (to be created during backend phase):
```
backend/
  src/
    server.js
    routes/
    controllers/
    services/
    middleware/
    validators/
    storage/
```
