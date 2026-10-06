import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import {
  cartTotal,
  generateSchema,
  sampleDesigns,
  type CartItem,
} from "../src/lib/catalog";
import { authorize } from "../src/lib/server-security";
import { POST } from "../src/app/api/generate/route";
import { GET as status } from "../src/app/api/status/route";

const environment = { ...process.env };
const realFetch = globalThis.fetch;
beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key-not-a-credential";
  process.env.STUDIO_ACCESS_CODE = "test-studio";
  Object.assign(process.env, { NODE_ENV: "production" });
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  globalThis.fetch = realFetch;
});
after(() => {
  process.env = environment;
  globalThis.fetch = realFetch;
});
const input = {
  prompt: "A dragon rapping on stage",
  style: "Vintage",
  garment: "hoodie",
  color: "Black",
  count: 4,
};
const request = (body: unknown = input) =>
  new Request("https://studio.example/api/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://studio.example",
    },
    body: JSON.stringify(body),
  });

test("mixed garment/size cart uses catalog prices and quantities", () => {
  const base = {
    id: "one",
    design: sampleDesigns[0],
    color: 0,
    placement: "back",
    scale: 85,
    size: "S",
    quantity: 1,
  };
  const cart = [
    { ...base, garment: "hoodie" },
    { ...base, id: "two", garment: "hoodie", size: "L" },
    { ...base, id: "three", garment: "tee", quantity: 2 },
  ] as CartItem[];
  assert.equal(cartTotal(cart), 148);
  assert.equal(cartTotal([]), 0);
});
test("generation validation rejects oversized, empty and excessive requests", () => {
  for (const bad of [
    { ...input, prompt: "short" },
    { ...input, prompt: "x".repeat(1601) },
    { ...input, count: 5 },
    { ...input, count: -1 },
    { ...input, style: "unrecognized" },
  ])
    assert.equal(generateSchema.safeParse(bad).success, false);
  assert.equal(generateSchema.safeParse(input).success, true);
});
test("production is unlocked with or without a legacy studio access code", async () => {
  assert.equal(request().headers.has("x-studio-code"), false);
  assert.equal(authorize(request()), null);
  assert.deepEqual(await (await status()).json(), {
    enabled: true,
    locked: false,
  });
  delete process.env.STUDIO_ACCESS_CODE;
  assert.equal(authorize(request()), null);
  assert.deepEqual(await (await status()).json(), {
    enabled: true,
    locked: false,
  });
});
test("production still denies cross-origin calls", () => {
  const crossOrigin = new Request("https://studio.example/api/generate", {
    headers: {
      origin: "https://other.example",
    },
  });
  assert.equal(authorize(crossOrigin)?.status, 403);
});
test("missing API key fails safely without upstream network access", async () => {
  delete process.env.OPENAI_API_KEY;
  globalThis.fetch = async () => {
    throw new Error("must not call provider");
  };
  assert.equal((await POST(request())).status, 503);
  assert.deepEqual(await (await status()).json(), {
    enabled: false,
    locked: false,
  });
});
test("same-origin generation works behind a reverse proxy", () => {
  const proxied = new Request("http://localhost:3000/api/generate", {
    headers: {
      host: "studio.example",
      origin: "https://studio.example",
    },
  });
  assert.equal(authorize(proxied), null);
  const invalid = new Request("http://localhost:3000/api/generate", {
    headers: {
      host: "studio.example",
      origin: "not-an-origin",
    },
  });
  assert.equal(authorize(invalid)?.status, 403);
});
test("invalid bodies and cross-origin requests never reach image API", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return Response.json({});
  };
  const crossOrigin = request();
  crossOrigin.headers.set("origin", "https://other.example");
  assert.equal((await POST(crossOrigin)).status, 403);
  assert.equal((await POST(request({ ...input, count: 500 }))).status, 400);
  assert.equal(
    (
      await POST(
        new Request("https://studio.example/api/generate", {
          method: "POST",
          body: "not-json",
        }),
      )
    ).status,
    400,
  );
  assert.equal(called, false);
});
test("streams four concepts without an access code and keeps the API key server-side", async () => {
  const prompts: string[] = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/images/generations");
    const body = JSON.parse(options?.body as string);
    assert.equal(body.background, "transparent");
    assert.equal(body.n, 1);
    prompts.push(body.prompt);
    return Response.json({ data: [{ b64_json: "aW1hZ2U=" }] });
  };
  const response = await POST(request());
  assert.equal(response.status, 200);
  const output = await response.text();
  const events = output
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(events.filter((event) => event.type === "design").length, 4);
  assert.equal(new Set(prompts).size, 4);
  assert.equal(events.at(-1).type, "done");
  assert.equal(output.includes("test-key-not-a-credential"), false);
});
test("partial provider failures preserve successful concepts and sanitize errors", async () => {
  let count = 0;
  globalThis.fetch = async () =>
    ++count === 1
      ? Response.json(
          {
            error: {
              code: "insufficient_quota",
              message: "provider internal secret",
            },
          },
          { status: 429 },
        )
      : Response.json({ data: [{ b64_json: "aW1hZ2U=" }] });
  const output = await (await POST(request())).text();
  const events = output
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(events.filter((event) => event.type === "design").length, 3);
  assert.equal(events.filter((event) => event.type === "error").length, 1);
  assert.equal(output.includes("provider internal secret"), false);
});
test("configured durable rate limit fails closed if storage is unavailable", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-redis";
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  assert.equal((await POST(request())).status, 503);
});

test("public generation still enforces the configured studio rate limit", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-redis";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://example.upstash.io/pipeline");
    const commands = JSON.parse(options?.body as string);
    assert.match(commands[0][1], /^t-genie:generation:studio:/);
    return Response.json([{ result: 13 }, { result: 1 }]);
  };
  assert.equal((await POST(request())).status, 429);
});
