# Lumora App

Koa backend on the Lumora hook framework. See `README.md` for stack and module layout.

## Adding a module

Always scaffold with the CLI, then edit the generated files:

```bash
npm run make:module -- <name>     # e.g. products, product-reviews
```

It creates `src/modules/<name>/` (constants, schema, mapper, helper, service, hooks/, routes/)
and registers the model and routes. `src/modules/users/` is the reference module.

## Rules

- One endpoint per file in `routes/`; routes validate, call the service, and map the response. No DB calls in routes.
- Service functions take `async ({ services, args })` and are exported via `useXxxService()` as `xxxSrv`.
- DB methods return `[err, result]` tuples; throw a `lumora/core` error on `err`.
- `helper.js` and `mapper.js` are pure (no DB, no services).
- Enums and the model name live in `constants.js`; never hardcode them elsewhere.
- Run `npm test` after changes.
