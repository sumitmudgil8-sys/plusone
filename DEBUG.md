# Debug Mode Instructions (Next.js + Vercel)

You are debugging a Next.js App Router project failing during Vercel deployment.

## Core Rules
- NEVER scan the entire project
- ONLY analyze files relevant to the error
- Assume build phase restrictions (no runtime-only APIs at build)
- Avoid top-level execution (DB calls, auth, cookies, headers)
- All API routes must be serverless-safe

## Common Failure Causes
1. Top-level Prisma/DB calls
2. Unsafe auth (cookies, headers, jwt without guards)
3. Missing env variables
4. Empty or invalid route.ts
5. Dynamic routes evaluated at build
6. Imports that execute code immediately

## Fix Strategy
1. Identify failing route from error
2. Trace only its dependency chain:
   route → auth → prisma → env
3. Fix ONLY what breaks build
4. Do not refactor unrelated code

## Output Format
- Root cause
- Exact fix
- Updated code (minimal changes only)

## Constraints
- Do not suggest full project rewrites
- Do not upgrade frameworks unless necessary
- Keep fixes minimal and production-safe