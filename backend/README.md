# Omnia Charity Tracking API

A modular Node.js + Express + MongoDB backend for managing families, beneficiaries, aids, visits, and user authentication/authorization.

## Tech Stack

- Node.js (CommonJS)
- Express.js
- MongoDB with Mongoose
- JWT authentication
- bcryptjs password hashing
- Jest + Supertest + mongodb-memory-server tests

## Project Setup

```bash
npm install
cp .env.example .env
npm run dev
```

API base URL: `http://localhost:5000/api/v1`

## Environment Variables

Use `.env.example` as reference.

Required for runtime:

- `MONGODB_URI`
- `JWT_SECRET`

Optional geolocation variables:

- `GEO_PROVIDER` (default: `nominatim`)
- `GEO_AUTOLOOKUP` (default: `true`)
- `NOMINATIM_BASE_URL`
- `NOMINATIM_USER_AGENT`

Optional chatbot variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4.1-mini`)
- `OPENAI_API_BASE_URL` (default: `https://api.openai.com/v1`)
- `OPENAI_TIMEOUT_MS` (default: `15000`)

## Scripts

- `npm run dev`: start development server
- `npm start`: start production server
- `npm test`: run Jest tests
- `npm run seed:admin`: create initial admin user from env vars

## Main Endpoints

- `POST /login`
- `GET /me`
- `GET /public`
- `GET /public/reports`
- `POST /public/chatbot/ask`
- `CRUD /users`
- `CRUD /familles`
- `GET /familles/:id/beneficiaires`
- `GET /familles/:id/visites`
- `GET /familles/:id/aides`
- `CRUD /beneficiaires`
- `CRUD /aides`
- `CRUD /visites`

All routes except `/login` and `/public*` require `Authorization: Bearer <token>`.

## Testing Notes

`mongodb-memory-server` downloads a MongoDB binary on the first run.
If your environment is offline, either:

- provide internet access once for the initial binary download, or
- set `MONGOMS_SYSTEM_BINARY` to a local `mongod` executable path.
