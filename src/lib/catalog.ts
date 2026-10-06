import { z } from "zod";

export const garments = {
  hoodie: {
    name: "Classic hoodie",
    model: "Gildan G185",
    price: 46,
    detail: "Cozy fleece · Unisex fit",
    material: "50% cotton / 50% polyester",
  },
  tee: {
    name: "Everyday tee",
    model: "Gildan G500",
    price: 28,
    detail: "Soft cotton · Unisex fit",
    material: "100% cotton (solid colors)",
  },
} as const;
export const colors = [
  { name: "Washed black", value: "#30312e", dark: "#171816", light: "#484943" },
  { name: "Natural", value: "#e4dbc6", dark: "#bdb39d", light: "#f6f0e0" },
  { name: "Forest", value: "#4d6050", dark: "#2b3e31", light: "#6c806b" },
  { name: "Clay", value: "#b26f5b", dark: "#884e40", light: "#cb927c" },
  { name: "Lavender", value: "#a6a0b4", dark: "#7a758d", light: "#c3bbce" },
] as const;
export const styles = [
  "Illustration",
  "Vintage",
  "Minimal",
  "Streetwear",
] as const;
export const sizes = ["S", "M", "L", "XL", "2XL"] as const;
export type Garment = keyof typeof garments;
export type Size = (typeof sizes)[number];
export type Design = {
  id: string;
  name: string;
  prompt: string;
  image: string;
  createdAt: number;
  source: "sample" | "generated";
};
export type CartItem = {
  id: string;
  design: Design;
  garment: Garment;
  color: number;
  placement: "front" | "back";
  scale: number;
  size: Size;
  quantity: number;
};
export const generateSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(8, "Describe your idea in at least 8 characters.")
    .max(1600),
  style: z.enum(styles),
  garment: z.enum(["hoodie", "tee"]),
  color: z.string().max(30),
  count: z.number().int().min(1).max(4).default(4),
});
export const sampleDesigns: Design[] = [
  {
    id: "sample-dragon",
    name: "Mic drop dragon",
    prompt:
      "A cartoon dragon rapping into a vintage microphone on stage, with an orange sun and a retro concert poster feel.",
    image: "/art/dragon.png",
    createdAt: 0,
    source: "sample",
  },
  {
    id: "sample-orbit",
    name: "Out of this world",
    prompt:
      "A dreamy retro planet with orbit rings, tiny stars, and a warm orange and cream color palette.",
    image: "/art/orbit.svg",
    createdAt: 0,
    source: "sample",
  },
  {
    id: "sample-bloom",
    name: "Grow your own way",
    prompt:
      "An oversized playful wildflower with wavy green leaves, coral petals, and a golden center, in a vintage print style.",
    image: "/art/bloom.svg",
    createdAt: 0,
    source: "sample",
  },
  {
    id: "sample-sun",
    name: "Somewhere slower",
    prompt:
      "A warm retro sunset above rolling ocean waves, a nostalgic surf club screen print in terracotta, cream, and forest green.",
    image: "/art/sun.svg",
    createdAt: 0,
    source: "sample",
  },
];
export function cartTotal(items: CartItem[]) {
  return items.reduce(
    (sum, item) => sum + garments[item.garment].price * item.quantity,
    0,
  );
}
export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
