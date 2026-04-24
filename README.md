# Calculadora Price & SAC — Monorepo

This repo contains three top-level projects:

- `mobile/` — Expo 54 app (iOS/Android)
- `marketing/` — Next.js marketing site (PT-BR)
- `tools/` — Store assets tooling (keep as-is)

## Quick start

### Mobile (Expo)

```bash
cd mobile
npm install
npm run start
```

Other useful commands (from `mobile/`):

```bash
npm run android
npm run ios
npm run lint
npx tsc --noEmit
npm test
npm run ui:maestro:android
npm run ui:maestro:readback
npm run ui:maestro:all
```

### Marketing (Next.js)

```bash
cd marketing
pnpm install
pnpm dev
```

### Tools

Run tools from the `tools/` folder as needed.

## App Store URLs

After deploy:

- Support URL: `https://calculadorapricesac.com/suporte`
- Privacy Policy URL: `https://calculadorapricesac.com/privacidade`
