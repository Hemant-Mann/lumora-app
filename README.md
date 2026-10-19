# Lumora App

A lean, working sample application built on the **Lumora** framework. Demonstrates a Koa-based backend wired up with **MySQL**, **Redis**, and **MongoDB**.

> **Note:** Database service wrappers (`cache`, `mongo`, `mysql`, `redis`, `postgres`) live in the `lumora` framework itself under `lumora/services/index.js`. This app only contains framework glue, hooks, and business modules.

## Stack

| Component | Technology |
|-----------|------------|
| HTTP Framework | Koa.js |
| Composable Hooks | Lumora |
| Relational DB | MySQL 8.0+ (via Knex + mysql2) |
| Document DB | MongoDB (via Mongoose) |
| Cache | Redis |
| Validation | Zod |

## Project Structure

```
src/
  app.js                      # Entry point — Koa bootstrap
  config/
    index.js                  # Env-based configuration
  framework/
    index.js                  # useCoreServices — wires up all shared services
    workflow/
      index.js                # createWorkflow + executeKoaWorkflow
    hooks/
      useCors.js              # Lumora CORS hook (uses shared cors-utils)
      useAdvancedQueryString.js  # Zod-validated query strings
      useError.js             # Error boundary
      useSession.js           # JWT session decoder
    cors-utils.js             # Shared CORS helpers (DEFAULT_HEADERS, resolveOrigin, buildAllowedHeaders)
    koa/
      router.js               # Route aggregator
      cors.js                 # Koa-level CORS middleware (uses shared cors-utils)
  modules/
    models.js                 # Mongoose model registration
    routes.js                 # Central route registry
    core/
      services.js             # Every module's useXxxService, re-exported; routes import from here
    users/
      constants.js            # MODEL, RESOURCE, enums (STATUS)
      migrations/             # Knex migrations for the MySQL `user` table
      mapper.js               # responseMapping / bodyMapping (DB ↔ API fields)
      helper.js               # Pure functions, no DB (e.g. buildUserFilter)
      service.js              # Business logic (MySQL + delegates to userEvents)
      hooks/
        useValidateId.js      # Loads :id into args.user or throws
      routes/
        index.js              # Route registrations
        create.js             # POST /api/users
        list.js               # GET /api/users
        findOne.js            # GET /api/users/:id
      userEvents/
        constants.js          # MODEL, action names
        schema.js             # Mongoose schema (MongoDB user_events collection)
        mapper.js             # responseMapping
        helper.js             # buildEventData
        service.js            # Business logic (MongoDB)
        routes/
          index.js            # Route registrations
          create.js           # POST /api/users/:id/events
          list.js             # GET /api/users/:id/events
```

## Module Structure

Every module follows the same layout. Each file has one job:

| File | Does | Does NOT |
|------|------|----------|
| `constants.js` | `MODEL`, `RESOURCE`, enums | Logic |
| `schema.js` (Mongo) | Mongoose schema, registered in `models.js` | Business rules |
| `migrations/` (MySQL) | Knex migrations that create / alter the table | Business rules |
| `mapper.js` | DB ↔ API field translation | DB access |
| `helper.js` | Pure functions (filters, builders) | DB access |
| `service.js` | Business logic + DB ops, exports `useXxxService` | HTTP / validation |
| `hooks/*.js` | Reusable route hooks (load-by-id, guards) | Business logic |
| `routes/index.js` | `createWorkflow` registrations | Logic |
| `routes/*.js` | One endpoint: validate → call service → map response | DB queries |

Register named paths before parameterised ones (`/api/x/search` before `/api/x/:id`).

## CLI

```bash
node bin/lumora.js new ../my-app          # bootstrap a new project (includes the users example)
npm run make:module -- products           # scaffold src/modules/products + register model and routes
npm run make:module -- user-reviews --parent users   # sub-module: src/modules/users/userReviews
npm run make:module -- orders --db mysql  # MySQL module (default is --db mongo)
```

A MySQL module gets `migrations/<timestamp>_create_<table>.js` instead of `schema.js`, and a service
that uses `services.mysql`. The table name is the snake_case model name (`OrderLine` → `order_line`),
which is what lumora's MySQL client looks up.

`make:module` generates every file above with working list / create / findOne routes (MongoDB-backed),
a passing test file at `src/tests/<module>/routes.test.js`, and registers the module in
`src/modules/models.js` (Mongo), `src/modules/routes.js` and `src/modules/core/services.js`.

With `--parent users`, routes nest under the parent (`/api/users/:userId/reviews`), records get a
`user_id` field, list filters by it, create sets it, and findOne rejects records of another user.
A leading parent name is dropped from the URL (`user-reviews` → `/reviews`).
Multi-word names work: `product-reviews` → folder `productReviews`, model `ProductReview`, path `/api/product-reviews`.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Create the MySQL tables

```sql
CREATE DATABASE lumora_app;
```

```bash
npm run migrate:latest     # runs every src/modules/**/migrations/ in timestamp order
npm run migrate:rollback   # undo the last batch
npm run migrate:make -- add_phone_to_user --migrations-directory src/modules/users/migrations
```

Migrations live inside the module that owns the table. `knexfile.js` finds every `migrations/` folder
under `src/modules` automatically. Always pass `--migrations-directory` to `migrate:make`, or knex puts
the file in whichever folder it finds first.

### 4. Start the app

```bash
npm run dev
```

Server starts on `http://localhost:4000`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/users` | Create a user (MySQL) + auto-log event to MongoDB |
| GET | `/api/users` | List users with pagination & search (MySQL + Redis cache) |
| GET | `/api/users/:id` | Get a single user by ID (MySQL + Redis cache) |
| GET | `/api/users/:id/events` | List events for a user (MongoDB) |
| POST | `/api/users/:id/events` | Create an event for a user (MongoDB) |

## Shared Services from `lumora/services/index.js`

This app imports all database and cache services from the Lumora framework:

```js
import { makeCacheClient, makeMongo, MongoClient, MysqlClient, RedisClient } from 'lumora/services/index.js'
```

| Service | Import | Used For |
|---------|--------|----------|
| `MongoClient` | `lumora/services/index.js` | MongoDB connections & model registry |
| `MysqlClient` | `lumora/services/index.js` | MySQL connections (Knex + mysql2) |
| `RedisClient` | `lumora/services/index.js` | Redis connections & cache-aside |
| `makeCacheClient` | `lumora/services/index.js` | Cache-first DB wrapper |
| `PostgresClient` | `lumora/services/index.js` | Available but not used in this app |

### Multi-connection support

All services support named connections:

```js
// MongoDB
const db = makeMongo('default', { mongoUri, databaseName })
MongoClient.registerModel('default', 'User', userSchema)
MongoClient.disconnectMongo('default')

// MySQL
const mysql = MysqlClient.makeMysql('default', { mysqlUri })
MysqlClient.disconnectMysql('default')

// Redis
const redis = RedisClient.makeRedisClient('default', redisUrl)
RedisClient.disconnectRedis('default')
```

### Cache layer

```js
import { makeCacheClient } from 'lumora/services/index.js'

const dbCache = makeCacheClient(mysql, redis, '__lumora__')

const [err, user] = await dbCache.selectViaId('User', userId)
await dbCache.clearCacheForId('User', userId)
```

## Datastore Usage

- **MySQL** — Primary store for `User` records (Knex-based MySQL wrapper)
- **MongoDB** — `UserEvent` collection (event logging)
- **Redis** — Response caching via `dbCache` layer

## MySQL Wrapper

The MySQL client is split into 4 files:

| File | Responsibility |
|------|----------------|
| `index.js` | Named singleton connection map |
| `client.js` | Composed API surface |
| `methods.js` | CRUD + core relational filter engine |
| `types.js` | JSDoc interfaces |

### Filter Operators (Core Relational Subset)

`IN`, `NIN`, `GT`, `GTE`, `LT`, `LTE`, `NE`, `EXISTS`, `LIKE`, `BETWEEN`, `OR_OPERATOR`, `OR`, `AND`, `DATE_RANGE`, `IS_NULL`, `IS_NOT_NULL`, `STARTS_WITH`, `ENDS_WITH`, `CONTAINS`, `NOT_CONTAINS`, `IN_RANGE`, `OUTSIDE_RANGE`

### Example

```js
const [err, users] = await mysql.selectMany('User', {
  status: 'active',
  name: { operator: 'CONTAINS', value: 'john' }
}, { page_no: 1, per_page: 10 })
```

## Framework Hooks

### Fixed Pre-hooks (applied to every route)

1. `useKoa()` — Bridges Koa ctx to Lumora `Props`
2. `useCors({ credentials: true })` — CORS headers
3. `useLogging(...)` — Request/response logging
4. `useServices({ ...coreServices })` — DI container
5. `useSession()` — JWT token decoding
6. `useError()` — Error boundary

### Route-specific hooks

```js
export const handler = () => [
  useServices({ ...useUserService() }),
  useJsonBody(z => ({ name: z.string() })),
  createUserEndpoint
]
```

## Sub-Module Service Pattern

The `users` module demonstrates how a parent service can delegate to a sub-module service:

```js
// users/service.js
import { useUserEventService } from './userEvents/service.js'

export const useUserService = () => ({
  userSrv: {
    // ... MySQL CRUD operations ...
    logEvent: async ({ services, args }) => {
      return services.userEventSrv.createRecord({ services, args })
    },
  },
  ...useUserEventService(),  // Inject MongoDB sub-module service
})
```

This pattern allows:
- `users` routes to use `services.userSrv` (MySQL)
- `users` routes to use `services.userEventSrv` (MongoDB)
- `userEvents` routes to use `services.userEventSrv` independently

## Notes

- `.returning('*')` is used for `insert` / `update` / `upsert` operations. This requires **MySQL 8.0+**.
- All DB methods return `[Error|null, Result|null]` tuples via `radash.tryit`.
- MongoDB collections are created automatically on first write — no manual schema migration needed.
- Service dependencies (`knex`, `mongoose`, `mysql2`, `redis`, `pg`) are declared as **optional peer dependencies** in `lumora`. Your app must install the ones it uses.
