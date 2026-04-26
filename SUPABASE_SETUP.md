# Supabase Setup

This project uses Supabase as a hosted Postgres database through the backend
`DATABASE_URL`. The frontend does not connect to Supabase directly.

## 1. Create a new Supabase project

1. Go to https://database.new.
2. Create a new project named `Volun-Tiers`.
3. Pick the region closest to where the backend will run.
4. Save the database password somewhere private. You need it for `DATABASE_URL`.
5. Wait for the database to finish provisioning.

## 2. Create the database schema

1. Open your Supabase project.
2. Go to `SQL Editor`.
3. Click `New Query`.
4. Paste the contents of `backend/sql/supabase_schema.sql`.
5. Click `Run`.

The backend also runs the same table setup on startup, but running this SQL once
lets you confirm the schema in Supabase before starting the app.

## 3. Copy the connection string

1. In the Supabase project dashboard, click `Connect`.
2. Use the `Session pooler` connection string for this Express backend.
3. Replace `[YOUR-PASSWORD]` with the database password from project creation.

It should look like:

```text
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

If your hosting provider supports IPv6, the direct connection string is also OK:

```text
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

## 4. Configure backend env

Create `backend/.env` from `backend/.env.example`:

```bash
cd backend
cp .env.example .env
```

Set:

```env
PORT=5001
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
JWT_SECRET=replace-with-a-long-random-secret
```

Generate a local JWT secret with:

```bash
openssl rand -base64 48
```

## 5. Configure frontend env

Create `frontend/.env.local` from `frontend/.env.example`:

```bash
cd frontend
cp .env.example .env.local
```

For local development:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 6. Start the app

Terminal 1:

```bash
cd backend
npm install
npm run dev
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

## 7. Optional: seed map data

After the backend can connect to Supabase, run:

```bash
cd backend
npm run migrate:map-data
```

This imports hotspot and need-region map data into the Supabase database.
