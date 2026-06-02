# SEO + Share Checklist

## 1) Verificar assets OG/Twitter

- Abra `/og` para ver as imagens geradas.
- Confirme proporção 1200×630 e o quadrado 1200×1200.

## 2) Validadores de compartilhamento

Use estes validadores para atualizar cache e validar previews:

```
LinkedIn Post Inspector:
https://www.linkedin.com/post-inspector/

X (Twitter) Card Validator:
https://cards-dev.twitter.com/validator

Facebook Sharing Debugger:
https://developers.facebook.com/tools/debug/
```

## 3) Metadados essenciais

- Title e description coerentes.
- Open Graph com image, width/height/type/alt.
- Twitter Card com summary_large_image.
- Canonical URLs por página.

## 4) Robots e Sitemap

- `/robots.txt` e `/sitemap.xml` ativos no deploy.

## 5) Vercel Analytics

- Habilitar Web Analytics no projeto Vercel.

## 6) IDs das lojas (opcional)

Se tiver, setar as variáveis de ambiente no Vercel:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_STORE_ID`
- `NEXT_PUBLIC_APP_STORE_URL` (custom URL scheme)
- `NEXT_PUBLIC_PLAY_STORE_ID`
- `NEXT_PUBLIC_PLAY_STORE_URL` (custom URL scheme)

## 7) Google Ads (Search → site)
- NEXT_PUBLIC_GADS_ID = AW-XXXXXXXXX        (loads gtag.js)
- NEXT_PUBLIC_GADS_CONVERSION = AW-XXXXXXXXX/label   (fires on App Store click)
Set both in Vercel env. Until set, no Google tag loads and conversions are a no-op.
