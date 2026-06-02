# Deploy checklist — web calculator

## Vercel (required, dashboard)
The marketing build needs the shared engine at `../shared/loan-engine` available at build
time (a `prebuild` step copies it into `marketing/loan-engine-shim/`, which Turbopack can
bundle). So the repo root must be in the build context. Do ONE of:
- Set Settings → General → Root Directory to the **repo root**, with
  Build Command `cd marketing && pnpm build`, Install `cd marketing && pnpm install`,
  Output `marketing/.next`; OR
- Keep Root Directory = `marketing` and enable
  "Include source files outside of the Root Directory in the Build Step".
Redeploy and confirm `/` renders the calculator and the build log shows the
`[sync-loan-engine]` line + `✓ externalDir` + `Compiled successfully`.

Note: Turbopack cannot resolve imports outside the project root, so we copy
`shared/loan-engine` into a gitignored `marketing/loan-engine-shim/` at build time
(scripts/sync-loan-engine.mjs, wired to prebuild/predev). Source of truth stays in
`shared/`; tests and tsc read it directly so the copy cannot drift. If we later adopt a
proper workspace package for the engine, this copy step can be removed.

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
