import { z } from "zod";
import { generateSchema } from "./catalog";

const directions = [
  "Bold centered composition, expressive character, striking silhouette.",
  "Fresh alternate composition with a dynamic diagonal pose and playful details.",
  "A collectible concert-poster composition, dramatic lighting and fine linework.",
  "An adventurous alternate with a different angle, restrained palette and graphic shapes.",
];
export function buildImageRequest(
  settings: z.infer<typeof generateSchema>,
  index: number,
): { url: string; headers: Record<string, string>; body: string | FormData } {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";
  const requirements =
    "Create exactly ONE complete artwork design in this image. Never include a grid, contact sheet, collage, repeated designs or multiple alternate concepts, even if the brief mentions producing several concepts; the studio handles variants in separate requests. Create the ARTWORK ONLY, no garment, product photograph, mockup, model or watermark. Isolate the composition on a genuinely transparent background. Use strong legible shapes, clean edges, and sufficient contrast. Keep the whole design within the canvas with breathing room. Include words only when explicitly requested in the concept.";
  const options = {
    model,
    n: 1,
    size: "1024x1024",
    quality: "medium",
    background: "transparent",
    output_format: "webp",
    output_compression: 75,
  };
  if (!settings.referenceImage) {
    return {
      url: "https://api.openai.com/v1/images/generations",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...options,
        prompt: `Create original artwork for an apparel print. User concept: ${settings.prompt}\nArt direction: ${settings.style}. ${directions[index]}\nThe print will appear on a ${settings.color} ${settings.garment}. ${requirements}`,
      }),
    };
  }
  const [prefix, base64] = settings.referenceImage.split(",");
  const bytes = Buffer.from(base64, "base64");
  const png = prefix === "data:image/png;base64";
  const valid = png
    ? bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid)
    throw new Error("The selected artwork must be a valid PNG or WebP image.");
  const form = new FormData();
  Object.entries(options).forEach(([key, value]) =>
    form.set(key, String(value)),
  );
  form.set(
    "prompt",
    `Refine the attached apparel artwork. Requested change: ${settings.editInstruction}\nCurrent cumulative design brief: ${settings.prompt}\nArt direction: ${settings.style}. Preserve the original composition, character identity, palette and details unless the requested change explicitly changes them. ${requirements}`,
  );
  form.set(
    "image",
    new Blob([bytes], { type: png ? "image/png" : "image/webp" }),
    `selected-artwork.${png ? "png" : "webp"}`,
  );
  return {
    url: "https://api.openai.com/v1/images/edits",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  };
}
