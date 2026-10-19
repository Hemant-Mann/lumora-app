# Lumora App

Koa backend on the Lumora hook framework. See `README.md` for stack and module layout.

## Adding a module

Always scaffold with the CLI, then edit the generated files:

```bash
npm run make:module -- <name>                    # e.g. products, product-reviews
npm run make:module -- <name> --parent <module>  # sub-module, e.g. user-reviews --parent users
npm run make:module -- <name> --db mysql         # MySQL module (default is mongo)
```

It creates `src/modules/[<parent>/]<name>/` (constants, schema.js or migrations/, mapper, helper, service, hooks/, routes/),
a test at `src/tests/[<parent>/]<name>/routes.test.js`, and registers the model, routes and service hook (`src/modules/core/services.js`).
Keep the generated test passing as you change the module. `src/modules/users/` is the reference module.

## MySQL schema changes

Never edit a migration that has already run. Add a new one in the module's own folder:

```bash
npm run migrate:make -- <change_name> --migrations-directory src/modules/<module>/migrations
npm run migrate:latest
```

## Rules

- One endpoint per file in `routes/`; routes validate, call the service, and map the response. No DB calls in routes.
- Service functions take `async ({ services, args })` and are exported via `useXxxService()` as `xxxSrv`.
- Routes import service hooks from `src/modules/core/services.js`, never from a module's `service.js` directly, so any route can compose any module's service without knowing where it lives.
- DB methods return `[err, result]` tuples; throw a `lumora/core` error on `err`.
- MySQL times are UTC: `UTC_TIMESTAMP()` defaults in migrations (never `knex.fn.now()` / `CURRENT_TIMESTAMP`), `?timezone=Z` on `MYSQL_URI`.
- `helper.js` and `mapper.js` are pure (no DB, no services).
- Enums and the model name live in `constants.js`; never hardcode them elsewhere.
- Run `npm test` after changes.
