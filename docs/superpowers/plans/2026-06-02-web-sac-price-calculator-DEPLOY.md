# Deploy checklist — web calculator

## Engine sharing architecture (context)
The loan engine's single source of truth is now a pair of local package directories inside
the mobile project:

- `mobile/packages/@loan-engine/loan/src/index.ts`
- `mobile/packages/@loan-engine/calculations/src/index.ts`

Both apps import the engine through the package specifiers `@loan-engine/loan` and
`@loan-engine/calculations`. Mobile depends on them with `file:packages/...`, so its
`node_modules/@loan-engine/*` links stay inside `mobile/` and remain reproducible for EAS.
Marketing depends on the same package folders with `file:../mobile/packages/...`; pnpm
resolves them through `marketing/node_modules`, and Next transpiles the two packages via
`transpilePackages`.

There is no build-time copy, sync script, generated shim, or tsconfig/vitest alias for the
engine. The TypeScript source in `mobile/packages/@loan-engine/*/src/index.ts` is the only
engine source.

## Vercel (required, dashboard)
Because `marketing/package.json` depends on `file:../mobile/packages/@loan-engine/*`, the
**repo root must be in the install/build context**. Do ONE of:
- Set Settings → General → Root Directory to the **repo root**, with
  Build Command `cd marketing && pnpm build`, Install `cd marketing && pnpm install`,
  Output `marketing/.next`; OR
- Keep Root Directory = `marketing` and enable
  "Include source files outside of the Root Directory in the Build Step" so Vercel can read
  `../mobile/packages/@loan-engine/*` during install.
Redeploy and confirm `/` renders the calculator and the build log shows the
Next.js Turbopack build reaches `Compiled successfully`.

## Local verification
- `cd mobile && npm test` — 98 passed
- `cd mobile && npx tsc --noEmit` — clean
- `cd mobile && npx expo export --platform ios` — exported `dist` without engine resolution errors
- `cd marketing && pnpm test` — 11 passed
- `cd marketing && npx tsc --noEmit` — clean
- `cd marketing && pnpm lint` — clean
- `cd marketing && pnpm build` — `Compiled successfully`

## Google Ads (required for conversion tracking)
- Create a conversion action (Website → "App Store click").
- Set Vercel env: NEXT_PUBLIC_GADS_ID (AW-XXXXXXXXX) and NEXT_PUBLIC_GADS_CONVERSION (AW-XXXXXXXXX/label).
- Point the Search campaign's Final URL at https://www.calculadorapricesac.com.br/ (not the App Store).
- Verify with Google Tag Assistant that the conversion fires on the App Store button.

## Site URL / canonical (from the earlier SEO change set)
- Set NEXT_PUBLIC_SITE_URL = https://www.calculadorapricesac.com.br (www, no trailing slash),
  or delete it to use the www code default. Confirm www is the Primary Domain (301 redirect).

## Follow-ups (separate)
- LGPD / Google Consent Mode v2 banner.
