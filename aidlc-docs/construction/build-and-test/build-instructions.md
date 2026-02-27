# Build Instructions — AutoCoder

## Prerequisites
- **Node.js**: v20+ (LTS)
- **npm**: v10+
- **Docker**: Docker Desktop or Docker Engine (for PostgreSQL)
- **Disk Space**: ~500MB (node_modules + Docker image)

## Environment Variables
Copy `.env.example` to `.env` and configure:
```
DATABASE_URL="postgresql://autocoder:<password>@localhost:5432/autocoder"
POSTGRES_PASSWORD="<password>"
BETTER_AUTH_SECRET="<32+ char secret>"
BETTER_AUTH_URL="http://localhost:3000"
NODE_ENV="development"
```

## Build Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Start PostgreSQL
```bash
docker compose up -d
```
Verify: `docker compose ps` — should show `healthy` status.

### 3. Generate Prisma Client & Push Schema
```bash
npx prisma generate
npx prisma db push
```

### 4. Build Application
```bash
npm run build
```

### 5. Start Development Server
```bash
npm run dev
```
Application runs at http://localhost:3000

### 6. Verify Build Success
- **Expected Output**: `✓ Compiled successfully` + `✓ Generating static pages (12/12)`
- **Routes**: 21 routes compiled (12 static + 9 dynamic)
- **Zero TypeScript errors**

## Troubleshooting

### Tailwind CSS PostCSS Error
- **Cause**: Version mismatch between `tailwindcss` and `@tailwindcss/postcss`
- **Solution**: `npm install tailwindcss@latest @tailwindcss/postcss@latest`

### Prisma Connection Error
- **Cause**: PostgreSQL not running or wrong credentials
- **Solution**: Verify `docker compose ps` shows healthy, check `.env` DATABASE_URL

### better-auth Edge Runtime Warning
- **Warning**: `process.exit` used in better-auth — this is a known warning, not an error
- **Status**: Safe to ignore, does not affect functionality
