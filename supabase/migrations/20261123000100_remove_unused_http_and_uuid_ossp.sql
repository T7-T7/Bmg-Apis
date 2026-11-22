-- Remove extensions that are not referenced by project functions, schemas, indexes, or defaults.
-- The API uses pgcrypto for key hashing; vector remains installed for Supabase Storage internals.
drop extension if exists http;
drop extension if exists "uuid-ossp";
