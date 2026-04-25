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
    users/
      schema.js               # Mongoose schema (MySQL users table)
      service.js              # Business logic (MySQL + delegates to userEvents)
      routes/
        index.js              # Route registrations
        create.js             # POST /api/users
        list.js               # GET /api/users
        findOne.js            # GET /api/users/:id
      userEvents/
        schema.js             # Mongoose schema (MongoDB user_events collection)
        service.js            # Business logic (MongoDB)
        routes/
          index.js            # Route registrations
          create.js           # POST /api/users/:id/events
          list.js             # GET /api/users/:id/events
```

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

### 3. Create the MySQL table

```sql
CREATE DATABASE lumora_app;

USE lumora_app;

CREATE TABLE user (
  _id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

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

All services support named connections (like `tracker-utils`):

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

The MySQL client follows the exact 4-file pattern from `tracker-utils`:

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
