# Deploy checklist — web calculator

## Engine sharing architecture (context)
The loan engine's single source of truth is the **mobile app**
(`mobile/src/lib/calculations.ts` + `mobile/src/types/loan.ts`), where it originated and
where its 98-test vitest suite runs. Mobile bundles it natively — **no mobile config
changes, EAS builds unaffected.**

Neither Metro (mobile) nor Turbopack (marketing) can bundle imports from a folder outside
its own project root, so a separate top-level `shared/` folder was abandoned. Instead,
`marketing` generates an in-root copy at build time: `marketing/scripts/sync-loan-engine.mjs`
(wired to `prebuild`/`predev`) copies the two engine files from `../mobile/src` into a
gitignored `marketing/loan-engine-shim/`, rewriting the engine's `../types/loan` import to
`./loan`. Next's `@loan-engine/*` aliases point at that copy; **tsc and vitest alias directly
at the mobile source**, so the copy cannot silently drift (a mismatch would fail a type
check or test). A future cleanup could promote the engine to a proper workspace package and
drop the copy step.

## Vercel (required, dashboard)
Because marketing's `prebuild` reads `../mobile/src` at build time, the **repo root must be
in the build context**. Do ONE of:
- Set Settings → General → Root Directory to the **repo root**, with
  Build Command `cd marketing && pnpm build`, Install `cd marketing && pnpm install`,
  Output `marketing/.next`; OR
- Keep Root Directory = `marketing` and enable
  "Include source files outside of the Root Directory in the Build Step".
Redeploy and confirm `/` renders the calculator and the build log shows the
`[sync-loan-engine]` line + `✓ externalDir` + `Compiled successfully`.

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
