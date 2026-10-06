# T_GENIE

**Wear your imagination.** A responsive AI apparel design studio built with Next.js, React, and TypeScript, ready to import into Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkrispatl%2Ft_genie&env=OPENAI_API_KEY,STUDIO_ACCESS_CODE&project-name=t-genie&repository-name=t-genie)

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
cp .env.example .env.local
# Fill in OPENAI_API_KEY in .env.local. Do not commit this file.
npm run dev
```

Open `http://127.0.0.1:3000`. Without an API key, the app still works as a clearly labeled sample studio. Shell environment variables take precedence over `.env.local`; remove an unrelated inherited `OPENAI_API_KEY` from that shell before starting if needed.

## Deploy the existing repository on Vercel

1. In Vercel, choose **Add New → Project** and import `krispatl/t_genie`.
2. Keep the root directory at the repository root and the framework as **Next.js**. The repository includes the build/install configuration and lockfile.
3. Add `OPENAI_API_KEY` as a sensitive server environment variable. Use a newly rotated key with a funded OpenAI API project.
4. Set `STUDIO_ACCESS_CODE` to a long, random passphrase and share it only with intended studio users. This is separate from the API key. Live generation is deliberately disabled in production if this code is missing.
5. Optionally set `OPENAI_IMAGE_MODEL`. The default is `gpt-image-2.5-flare`; the model must be available to your OpenAI project. GPT Image may require organization verification.
6. Deploy. Each push to the connected production branch then updates the app. Enable Vercel Fluid compute and ensure the deployment supports the route's 300-second maximum duration.

Secrets are server-only and never use the `NEXT_PUBLIC_` prefix. They are not included in this repository. A locally configured `.env.local` is ignored by Git and is **not** automatically transferred to Vercel.

## What works

- Four original concepts per generation, streamed independently with partial-result handling, cancellation, and useful error messages.
- Transparent artwork via the OpenAI Images API. There is no dependency on a ChatGPT subscription.
- Hoodie and T-shirt preview, five colors, front/back print placement, and adjustable print size.
- Four sample designs, a prompt inspiration button, four style directions, and a browsable inspiration section.
- Artwork downloads and up to 40 saved designs in IndexedDB on the current browser.
- Persistent bag with mixed sizes, quantities, and catalog-derived pricing.
- Shipping details and downloadable, self-contained JSON order drafts with embedded artwork.
- Responsive mobile/desktop layouts, keyboard controls, accessible dialog focus, and reduced-motion support.

## Beta scope

This is a working **design studio and order-draft application**, not a connected print-on-demand store. Checkout is explicitly labeled as an order preview. It does not collect card information, charge a customer, submit an order, calculate tax or shipping, or fabricate tracking information. Shipping fields remain in memory and are only exported when the user downloads their draft. Do not enter card details in any field.

The hoodie and tee catalog prices ($46 and $28) are illustrative. Measurements and garment/color illustrations are indicative, not live supplier inventory. Preview artwork is 1024 × 1024; production printing needs resolution, placement, and color checks with the chosen printer. Sample dragon artwork uses a transparent PNG; the other three sample prints and garment previews are original SVG artwork.

To launch commerce, connect hosted payment checkout (for example Stripe), a durable database and object storage, verified payment webhooks, tax/shipping calculation, and your actual print supplier's fulfillment/tracking API. These require your merchant and supplier configuration. Do not treat the client-side draft total as a trusted payment amount.

## Generation access and rate limits

`STUDIO_ACCESS_CODE` gates billable generation. It is held only in browser memory and sent in the `x-studio-code` request header over your HTTPS deployment. The OpenAI API key stays on the server. This shared beta access code is not a replacement for customer authentication in a public store.

The app limits the studio to 12 generation batches per hour, each with at most four images. For a shared, durable limit across Vercel instances, set both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from an Upstash Redis database. Configured limiter failures deny generation. Without Redis, the best-effort limiter is per server instance and resets on cold starts. Set an OpenAI project spend limit as an additional budget control before inviting users.

The API validates prompt length and options, checks request origin, bounds generated payload sizes, and sanitizes provider errors. It does not log credentials, prompts, artwork, or shipping information. Only upstream failure status, error code, and request ID are logged.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

The test suite covers prices and quantities, input limits, production access checks, reverse proxy origin handling, streamed concepts, partial provider failures, secret non-disclosure, and durable-limiter failure behavior. It mocks the image provider and never consumes API credits.

During initial live verification on October 6, 2026, the supplied key authenticated and listed the configured model. The generation request returned `429 credit_balance_exhausted`. Add API credits and rotate the key shared in chat before retrying. A successful billable generation has therefore not been verified with that account.

## Project map

- `src/components/studio.tsx`: studio, saved designs, bag, and order drafts.
- `src/components/garment.tsx`: reusable responsive garment preview.
- `src/app/api/generate/route.ts`: protected, streamed image generation.
- `src/lib/server-security.ts`: access control and rate limiting.
- `src/lib/catalog.ts`: catalog, prices, types, and validation.
- `src/lib/storage.ts`: local persistence.
- `public/art/`: sample artwork.

## Sample dragon provenance

Created using the built-in image generation tool for this project. Final asset: `public/art/dragon.png` (1222 × 1287, transparent).

Prompt: “Original jade-green cartoon dragon rapping into a vintage handheld microphone, dynamic 1990s alternative concert poster/screenprint style. Cream and acid-yellow highlights, charcoal details, distressed ink, orange sun disk and sparse four-point stars. Centered compact composition readable at 230px on black apparel. Genuinely transparent background; no background rectangle, apparel, humans, text, letters, logos, or watermark.”

## Official references

- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration)
