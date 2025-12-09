# PrismaClientOptions in Prisma v7

## Valid Options for `new PrismaClient(options)`

### ✅ Supported Options:

```typescript
new PrismaClient({
  // 1. ADAPTER (Required in v7 for client engine)
  adapter: PrismaPg | PrismaNeon | PrismaLibSQL | etc,

  // 2. ACCELERATE URL (Alternative to adapter)
  accelerateUrl: string,

  // 3. LOGGING
  log: ['query', 'info', 'warn', 'error'] | LogDefinition[],

  // 4. ERROR FORMATTING
  errorFormat: 'pretty' | 'colorless' | 'minimal',

  // 5. TRANSACTION OPTIONS
  transactionOptions: {
    maxWait: 2000,      // Max time to wait for transaction slot
    timeout: 5000,       // Max time transaction can run
    isolationLevel: 'ReadCommitted' | 'Serializable' | etc
  }
})
```

### ❌ NOT Supported (removed in v7):

```typescript
new PrismaClient({
  datasourceUrl: "...",  // ❌ NO LONGER VALID
  datasources: { ... },   // ❌ NO LONGER VALID
})
```

## 🔧 How Prisma v7 Works

### Configuration Flow:

1. **Database URL** → Set in `prisma.config.ts`:
   ```typescript
   export default defineConfig({
     datasource: {
       url: env("DATABASE_URL"),
     }
   })
   ```

2. **Adapter** → Required for connection:
   ```typescript
   import { PrismaPg } from '@prisma/adapter-pg'
   import { Pool } from 'pg'

   const pool = new Pool({ connectionString: process.env.DATABASE_URL })
   const adapter = new PrismaPg(pool)

   const prisma = new PrismaClient({ adapter })
   ```

3. **Connection** → Prisma uses the adapter + config

## 📚 Available Adapters

### PostgreSQL (Supabase, Neon, etc):
```bash
npm install @prisma/adapter-pg pg
```
```typescript
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const adapter = new PrismaPg(new Pool({ connectionString: url }))
```

### Neon Serverless:
```bash
npm install @prisma/adapter-neon @neondatabase/serverless
```
```typescript
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool } from '@neondatabase/serverless'

const adapter = new PrismaNeon(new Pool({ connectionString: url }))
```

### PlanetScale:
```bash
npm install @prisma/adapter-planetscale @planetscale/database
```
```typescript
import { PrismaPlanetScale } from '@prisma/adapter-planetscale'
import { Client } from '@planetscale/database'

const adapter = new PrismaPlanetScale(new Client({ url }))
```

### Cloudflare D1:
```bash
npm install @prisma/adapter-d1
```
```typescript
import { PrismaD1 } from '@prisma/adapter-d1'

const adapter = new PrismaD1(env.DB)  // In Cloudflare Worker
```

## 🎯 Why the Change?

Prisma v7 separated concerns:
- **Configuration** → `prisma.config.ts` (URL, migrations)
- **Runtime** → `PrismaClient` with adapters (connection handling)
- **Benefits**:
  - Better edge/serverless support
  - More flexible connection pooling
  - Adapter-specific optimizations

## 💡 Our Setup (Supabase)

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter,  // ✅ Required
  log: ['error', 'warn']  // ✅ Optional logging
})
```

## 🔗 References

- [Prisma v7 Announcement](https://www.prisma.io/blog/prisma-orm-7-stable)
- [Driver Adapters Docs](https://www.prisma.io/docs/orm/overview/databases/database-drivers)
- [PrismaClient API](https://www.prisma.io/docs/orm/reference/prisma-client-reference)
