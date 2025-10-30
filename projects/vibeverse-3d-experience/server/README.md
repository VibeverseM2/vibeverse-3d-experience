# Vibeverse Server

A minimal TypeScript + Express server exposing two routes:

- `GET /world/:id/web` – Fetches a remote HTML page (`https://nathantest-6e8649_nathantest-deb29c.msquared.world`), takes the first `<script>` tag it finds, extracts everything between the first `{` and the last `}` in that script, parses it as JSON, and returns the resulting object. Returns HTTP 502 with an error JSON if the script tag is missing, braces aren't found, or parsing fails.
- `POST /world/:id/config` – accepts a JSON body and returns `{ id: string, config: <body> }`.

## Prerequisites
- Node.js 18+
- npm

## Install
```bash
npm install
```

## Development
Run with auto-restart:
```bash
npm run dev
```
Server defaults to `http://localhost:3000`.

## Build
```bash
npm run build
```
Compiled JS output goes to `dist/`.

## Start (production)
```bash
npm start
```

## Test
```bash
npm test
```

## Routes
### GET /world/:id/web
Returns the id:
```bash
curl http://localhost:3000/world/abc123/web
# => {"id":"abc123"}
```

### POST /world/:id/config
Echoes id and body:
```bash
curl -X POST http://localhost:3000/world/abc123/config \
  -H 'Content-Type: application/json' \
  -d '{"foo":"bar"}'
# => {"id":"abc123","config":{"foo":"bar"}}
```

## Project Structure
```
src/
  server.ts          # Express app bootstrap
  routes/world.ts    # World routes implementation
  types/world.ts     # WorldConfig interface
tests/
  world.routes.test.ts
```

## Notes
- Type checking: `npm run build` (tsc) must succeed; tests validate routes.
- Extend `WorldConfig` by adding stricter typing in `types/world.ts` if needed.
