# T_GENIE

**Wear your imagination.** A conversational AI apparel design agent built with Next.js, React, and TypeScript, deployed on [Vercel](https://t-genie.vercel.app).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkrispatl%2Ft_genie&env=OPENAI_API_KEY&project-name=t-genie&repository-name=t-genie)

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
4. Optionally set `OPENAI_CHAT_MODEL` (default `gpt-5.4-mini`) and `OPENAI_IMAGE_MODEL` (default `gpt-image-2.5-flare`). The models must be available to your OpenAI project. GPT Image may require organization verification. The chat model must support Responses API function calling.
5. Deploy. Each push to the connected production branch then updates the app. Enable Vercel Fluid compute and ensure the deployment supports the route's 300-second maximum duration. Chat and artwork generation are open for testing without an access code.

Secrets are server-only and never use the `NEXT_PUBLIC_` prefix. They are not included in this repository. A locally configured `.env.local` is ignored by Git and is **not** automatically transferred to Vercel.

## What works

- A conversational design partner that develops your idea, asks follow-up questions, and remembers the discussion and current project across browser refreshes.
- Agent tools that update the artwork brief, style, garment, color, placement, print scale, and size quantities directly from conversation.
- Concept selection through chat and image refinement using the selected artwork as an actual image input to the OpenAI Images edit API.
- Four original concepts per generation, streamed independently with partial-result handling, cancellation, and useful error messages.
- Transparent artwork via the OpenAI Images API. There is no dependency on a ChatGPT subscription.
- Hoodie and T-shirt preview, five colors, front/back print placement, and adjustable print size.
- Four sample designs, conversation starters, four style directions, an editable design brief, and a browsable inspiration section.
- Artwork downloads and up to 40 saved designs in IndexedDB on the current browser.
- Persistent bag with mixed sizes, quantities, and catalog-derived pricing.
- Shipping details and downloadable, self-contained JSON order drafts with embedded artwork.
- Responsive mobile/desktop layouts, keyboard controls, accessible dialog focus, and reduced-motion support.

## Beta scope

This is a working **design studio and order-draft application**, not a connected print-on-demand store. Checkout is explicitly labeled as an order preview. It does not collect card information, charge a customer, submit an order, calculate tax or shipping, or fabricate tracking information. Shipping fields remain in memory and are only exported when the user downloads their draft. Do not enter card details in any field.

The hoodie and tee catalog prices ($46 and $28) are illustrative. Measurements and garment/color illustrations are indicative, not live supplier inventory. Preview artwork is 1024 × 1024; production printing needs resolution, placement, and color checks with the chosen printer. Sample dragon artwork uses a transparent PNG; the other three sample prints and garment previews are original SVG artwork.

To launch commerce, connect hosted payment checkout (for example Stripe), a durable database and object storage, verified payment webhooks, tax/shipping calculation, and your actual print supplier's fulfillment/tracking API. These require your merchant and supplier configuration. Do not treat the client-side draft total as a trusted payment amount.

## How the design agent works

`POST /api/agent` sends recent conversation and current design metadata to the Responses API. Genie can call three validated tools: `update_design`, `choose_concept`, and `prepare_generation`. A turn has at most five model calls and one artwork job. Tools operate on a temporary copy of the brief; the browser applies changes only after a successful complete response. If manual settings change while Genie is replying, the response is discarded and can be retried with the latest state.

New artwork produces four concepts. Refinement uploads the selected PNG/WebP pixels to `/v1/images/edits` and produces one edited concept, preserving the original in saved designs. Vector samples are rasterized locally before editing. Merely changing garment settings does not generate images. The chat model receives design descriptions, not image pixels; it cannot visually compare the artwork. Image editing receives the selected artwork itself.

Chat history is saved in localStorage; the brief, concepts, saved designs, and bag use IndexedDB. Recent messages and design metadata are sent to OpenAI when chatting; artwork is sent when refining. API responses use `store: false`. **New conversation** clears this browser's chat history while retaining the current design. There is no account sync or server-side conversation database.

## Generation access and rate limits

The studio is open for testing: visitors can chat with Genie and generate artwork without entering a code. An existing `STUDIO_ACCESS_CODE` environment variable is ignored. The OpenAI API key stays on the server; request validation, origin checks, and the studio-wide rate limits remain enabled.

The app limits the studio to 120 chat turns and 12 artwork jobs per hour, each artwork job with at most four images. For a shared, durable limit across Vercel instances, set both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from an Upstash Redis database. Configured limiter failures deny requests. Without Redis, the best-effort limiter is per server instance and resets on cold starts. Set an OpenAI project spend limit as an additional budget control before inviting users.

The API validates prompt length and options, checks request origin, bounds generated payload sizes, and sanitizes provider errors. It does not log credentials, prompts, artwork, or shipping information. Only upstream failure status, error code, and request ID are logged.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

The test suite covers multi-turn context, chat-driven design changes, concept selection, bounded tool execution, invalid tool arguments, atomic failure handling, multipart image refinement, prices and quantities, input limits, code-free production access with a legacy access-code setting still present, reverse proxy origin handling, streamed concepts, partial provider failures, secret non-disclosure, and durable-limiter failure and quota behavior. It mocks the provider and never consumes API credits.

Live verification on October 6, 2026 covered multi-turn chat, garment and quantity updates, four generated concepts, and a refinement that changed the selected concept's headphones to purple. Desktop/mobile layouts and conversation/project restoration after refresh were checked in a browser. Model availability and billing depend on the configured API project.

## Project map

- `src/components/studio.tsx`: studio, saved designs, bag, and order drafts.
- `src/components/design-agent.tsx`: persistent conversation, live changes, and image-job feedback.
- `src/app/api/agent/route.ts`: protected Responses API agent loop.
- `src/lib/design-agent.ts`: validated design context, tools, and agent instructions.
- `src/components/garment.tsx`: reusable responsive garment preview.
- `src/app/api/generate/route.ts`: protected, streamed image generation and editing.
- `src/lib/image-request.ts`: selected-image validation and multipart editing requests.
- `src/lib/server-security.ts`: access control and rate limiting.
- `src/lib/catalog.ts`: catalog, prices, types, and validation.
- `src/lib/storage.ts`: local persistence.
- `public/art/`: sample artwork.

## Sample dragon provenance

Created using the built-in image generation tool for this project. Final asset: `public/art/dragon.png` (1222 × 1287, transparent).

Prompt: “Original jade-green cartoon dragon rapping into a vintage handheld microphone, dynamic 1990s alternative concert poster/screenprint style. Cream and acid-yellow highlights, charcoal details, distressed ink, orange sun disk and sparse four-point stars. Centered compact composition readable at 230px on black apparel. Genuinely transparent background; no background rectangle, apparel, humans, text, letters, logos, or watermark.”

## Official references

- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration)
