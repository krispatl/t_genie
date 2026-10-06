"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Heart,
  LoaderCircle,
  LockKeyhole,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  cartTotal,
  colors,
  garments,
  money,
  sampleDesigns,
  sizes,
  styles,
  type CartItem,
  type Design,
  type Garment,
  type Size,
} from "@/lib/catalog";
import { readStudio, writeStudio } from "@/lib/storage";
import GarmentPreview from "./garment";
import Modal from "./modal";
import DesignAgent from "./design-agent";
import {
  briefSchema,
  type AgentReply,
  type DesignBrief,
  type GenerationPlan,
} from "@/lib/design-agent";

type Dialog = "saved" | "bag" | "how" | "size" | "access" | "zoom" | null;
const inspiration = [
  "A cosmic cowboy riding a shooting star",
  "A sleepy cat running a tiny coffee shop",
  "A wildflower growing through a disco ball",
  "A surfing skeleton at a retro beach club",
];

function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "small" : ""}`}>
      <span className="brand-mark">✦</span>T_GENIE
      <span className="brand-dot">®</span>
    </span>
  );
}
export default function Studio() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<(typeof styles)[number]>("Illustration");
  const [garment, setGarment] = useState<Garment>("hoodie");
  const [color, setColor] = useState(0);
  const [placement, setPlacement] = useState<"front" | "back">("back");
  const [scale, setScale] = useState(85);
  const [design, setDesign] = useState<Design>(sampleDesigns[0]);
  const [concepts, setConcepts] = useState<Design[]>(sampleDesigns);
  const [saved, setSaved] = useState<Design[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<Record<Size, number>>({
    S: 0,
    M: 1,
    L: 0,
    XL: 0,
    "2XL": 0,
  });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [expected, setExpected] = useState(4);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState({ enabled: false, locked: false });
  const [code, setCode] = useState("");
  const [codeDraft, setCodeDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [orderReady, setOrderReady] = useState(false);
  const [shipping, setShipping] = useState({
    name: "",
    email: "",
    address: "",
    city: "",
    region: "",
    postal: "",
    country: "United States",
  });
  const abort = useRef<AbortController | null>(null);
  const pendingAccess = useRef<((code: string) => void) | null>(null);
  const productRef = useRef<HTMLElement>(null);
  const totalQuantity = Object.values(selectedSizes).reduce((a, b) => a + b, 0);
  const bagCount = cart.reduce((a, item) => a + item.quantity, 0);
  const isSaved = saved.some((item) => item.id === design.id);
  const designBrief: DesignBrief = {
    prompt,
    style,
    garment,
    color,
    placement,
    scale,
    sizes: selectedSizes,
  };

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
    readStudio()
      .then((data) => {
        if (data) {
          setSaved(data.designs || []);
          setCart(data.cart || []);
          if (data.project) {
            const restored = briefSchema.safeParse(data.project.brief);
            if (restored.success) applyBrief(restored.data);
            if (data.project.design?.image) setDesign(data.project.design);
            if (
              Array.isArray(data.project.concepts) &&
              data.project.concepts.length
            )
              setConcepts(data.project.concepts);
          }
        }
      })
      .catch(() =>
        setToast(
          "Browser storage is unavailable. Keep this tab open to retain your work.",
        ),
      )
      .finally(() => setHydrated(true));
    return () => abort.current?.abort();
  }, []);
  useEffect(() => {
    if (hydrated)
      writeStudio({
        designs: saved,
        cart,
        project: { brief: designBrief, design, concepts },
      }).catch(() =>
        setToast(
          "Your browser could not save this change. Download your artwork to keep a copy.",
        ),
      );
  }, [
    saved,
    cart,
    hydrated,
    prompt,
    style,
    garment,
    color,
    placement,
    scale,
    selectedSizes,
    design,
    concepts,
  ]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  function applyBrief(next: DesignBrief) {
    setPrompt(next.prompt);
    setStyle(next.style);
    setGarment(next.garment);
    setColor(next.color);
    setPlacement(next.placement);
    setScale(next.scale);
    setSelectedSizes(next.sizes);
  }
  function applyAgentReply(reply: AgentReply) {
    applyBrief(reply.brief);
    const selection = concepts.find((item) => item.id === reply.selectedId);
    if (selection) setDesign(selection);
  }
  async function generate(
    accessCode = code,
    options?: { brief: DesignBrief; reference?: Design; instruction?: string },
  ): Promise<{ count: number; error?: string }> {
    const requested = options?.brief || designBrief;
    const count = options?.reference ? 1 : 4;
    if (busy)
      return { count: 0, error: "Another artwork job is already running." };
    if (requested.prompt.trim().length < 8) {
      setError("Give your idea a little more detail — at least 8 characters.");
      return { count: 0, error: "The artwork brief needs more detail." };
    }
    if (!status.enabled) {
      setError(
        "You’re exploring sample designs. The studio owner can connect OpenAI to create something new.",
      );
      return { count: 0, error: "The studio owner needs to connect OpenAI." };
    }
    if (status.locked && !accessCode) {
      pendingAccess.current = (newCode) => {
        void generate(newCode, options);
      };
      setDialog("access");
      return { count: 0, error: "Unlock the studio to generate artwork." };
    }
    setError("");
    setBusy(true);
    setCompleted(0);
    setExpected(count);
    setElapsed(0);
    const controller = new AbortController();
    abort.current = controller;
    const received: Design[] = [];
    const pending: Record<number, Design> = {};
    let failure = "";
    try {
      let referenceImage: string | undefined;
      if (options?.reference) {
        if (options.reference.image.startsWith("data:"))
          referenceImage = options.reference.image;
        else {
          const referenceResponse = await fetch(options.reference.image, {
            signal: controller.signal,
          });
          if (!referenceResponse.ok)
            throw new Error("The selected artwork could not be loaded.");
          const blob = await referenceResponse.blob();
          if (blob.type.startsWith("image/svg+xml")) {
            const url = URL.createObjectURL(blob);
            try {
              const image = new Image();
              await new Promise<void>((resolve, reject) => {
                image.onload = () => resolve();
                image.onerror = () =>
                  reject(new Error("The artwork could not be loaded."));
                image.src = url;
              });
              const canvas = document.createElement("canvas");
              canvas.width = 1024;
              canvas.height = 1024;
              const context = canvas.getContext("2d");
              if (!context)
                throw new Error("The artwork preview could not be prepared.");
              const ratio = Math.min(1024 / image.width, 1024 / image.height);
              const width = image.width * ratio;
              const height = image.height * ratio;
              context.drawImage(
                image,
                (1024 - width) / 2,
                (1024 - height) / 2,
                width,
                height,
              );
              referenceImage = canvas.toDataURL("image/png");
            } finally {
              URL.revokeObjectURL(url);
            }
          } else {
            if (
              !blob.type.startsWith("image/png") &&
              !blob.type.startsWith("image/webp")
            )
              throw new Error("The selected artwork format cannot be refined.");
            referenceImage = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () =>
                reject(new Error("The artwork could not be read."));
              reader.readAsDataURL(blob);
            });
          }
        }
      }
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-studio-code": accessCode,
        },
        body: JSON.stringify({
          prompt: requested.prompt,
          style: requested.style,
          garment: requested.garment,
          color: colors[requested.color].name,
          count,
          referenceImage,
          editInstruction: options?.instruction,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401) {
          setCode("");
          setDialog("access");
        }
        throw new Error(
          data.error || "We couldn’t start generation. Please try again.",
        );
      }
      if (!response.body)
        throw new Error("The image stream could not be opened.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handle = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === "design") {
          pending[event.index] = event.design;
          received.push(event.design);
          const batch = Object.keys(pending)
            .map(Number)
            .sort((a, b) => a - b)
            .map((i) => pending[i]);
          setConcepts(
            options?.reference ? [...batch, ...concepts].slice(0, 4) : batch,
          );
          if (received.length === 1) setDesign(event.design);
          setCompleted((n) => n + 1);
        }
        if (event.type === "error") {
          failure = event.message;
          setError(event.message);
          setCompleted((n) => n + 1);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        lines.forEach(handle);
      }
      buffer += decoder.decode();
      if (buffer.trim()) handle(buffer);
      if (received.length) {
        setSaved((current) => [...received, ...current].slice(0, 40));
        setToast(
          `${received.length} new concept${received.length > 1 ? "s" : ""} created and saved.`,
        );
      }
    } catch (e) {
      failure =
        e instanceof Error && e.name === "AbortError"
          ? "Generation stopped."
          : e instanceof Error
            ? e.message
            : "Something went wrong.";
      if (e instanceof Error && e.name === "AbortError")
        setToast(
          "Generation stopped. Any completed concepts are still available.",
        );
      else
        setError(
          e instanceof Error
            ? e.message
            : "Something went wrong. Please try again.",
        );
      if (received.length)
        setSaved((current) => [...received, ...current].slice(0, 40));
    } finally {
      setBusy(false);
      abort.current = null;
    }
    return { count: received.length, error: failure || undefined };
  }
  async function generateFromAgent(
    brief: DesignBrief,
    plan: GenerationPlan,
    selectedId: string | null,
  ) {
    const reference =
      plan.mode === "refine"
        ? concepts.find((item) => item.id === selectedId) ||
          (design.id === selectedId ? design : undefined)
        : undefined;
    if (plan.mode === "refine" && !reference)
      return { count: 0, error: "Select a concept to refine first." };
    return generate(code, { brief, reference, instruction: plan.instruction });
  }
  function chooseSample(item: Design) {
    setDesign(item);
    setPrompt(item.prompt);
    setError("");
  }
  function toggleSave() {
    setSaved((current) =>
      isSaved
        ? current.filter((item) => item.id !== design.id)
        : [design, ...current].slice(0, 40),
    );
    setToast(
      isSaved
        ? "Removed from your saved designs."
        : "Design saved to this browser.",
    );
  }
  function addToBag() {
    if (!totalQuantity) {
      setToast("Choose at least one size to add your design.");
      setShowSizes(true);
      return;
    }
    const additions: CartItem[] = sizes
      .filter((size) => selectedSizes[size] > 0)
      .map((size) => ({
        id: crypto.randomUUID(),
        design,
        garment,
        color,
        placement,
        scale,
        size,
        quantity: selectedSizes[size],
      }));
    setCart((current) => {
      const next = [...current];
      for (const item of additions) {
        const index = next.findIndex(
          (old) =>
            old.design.id === item.design.id &&
            old.garment === garment &&
            old.color === color &&
            old.placement === placement &&
            old.scale === scale &&
            old.size === item.size,
        );
        if (index >= 0)
          next[index] = {
            ...next[index],
            quantity: Math.min(20, next[index].quantity + item.quantity),
          };
        else next.push(item);
      }
      return next;
    });
    setToast("Your design is in the bag. Looking good.");
    setCheckout(false);
    setOrderReady(false);
    setDialog("bag");
  }
  function updateQuantity(id: string, difference: number) {
    setCart((items) =>
      items
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.min(20, item.quantity + difference) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
    setOrderReady(false);
  }
  function downloadFile(blob: Blob, filename: string) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function downloadArtwork() {
    try {
      const response = await fetch(design.image);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      downloadFile(
        blob,
        `t-genie-${design.name.toLowerCase().replaceAll(" ", "-")}.${blob.type.includes("svg") ? "svg" : blob.type.includes("webp") ? "webp" : "png"}`,
      );
    } catch {
      setToast("Couldn’t download the artwork. Please try again.");
    }
  }
  async function downloadOrder() {
    try {
      const assets = new Map<string, string>();
      for (const item of cart) {
        if (assets.has(item.design.image)) continue;
        if (item.design.image.startsWith("data:")) {
          assets.set(item.design.image, item.design.image);
          continue;
        }
        const response = await fetch(item.design.image);
        if (!response.ok) throw new Error("Artwork unavailable");
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        assets.set(item.design.image, dataUrl);
      }
      const data = {
        type: "T_GENIE order draft — not submitted or paid",
        createdAt: new Date().toISOString(),
        currency: "USD",
        estimatedSubtotal: cartTotal(cart),
        shippingAndTax: "Not calculated",
        shipping,
        items: cart.map((item) => ({
          ...item,
          design: { ...item.design, image: assets.get(item.design.image) },
          unitPrice: garments[item.garment].price,
          model: garments[item.garment].model,
          colorName: colors[item.color].name,
        })),
      };
      downloadFile(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
        "t-genie-order-draft.json",
      );
    } catch {
      setToast("Your draft couldn’t be downloaded. Please try again.");
    }
  }

  return (
    <>
      <header className="site-header">
        <a href="#" className="brand-link" aria-label="T Genie home">
          <Brand />
        </a>
        <nav aria-label="Main navigation">
          <a className="active" href="#studio">
            Design studio
          </a>
          <a href="#inspiration">
            Get inspired <ArrowUpRight size={13} />
          </a>
          <button onClick={() => setDialog("how")}>How it works</button>
        </nav>
        <div className="header-actions">
          <button
            className="saved-nav"
            aria-label="My designs"
            onClick={() => setDialog("saved")}
          >
            <Bookmark size={17} />
            <span>My designs</span>
            {saved.length > 0 && (
              <span className="count-dot">{saved.length}</span>
            )}
          </button>
          <button
            className="bag-button"
            aria-label={`Open bag, ${bagCount} items`}
            onClick={() => {
              setDialog("bag");
              setCheckout(false);
            }}
          >
            <ShoppingBag size={18} />
            <span className="bag-count">{bagCount}</span>
          </button>
        </div>
      </header>
      <main>
        <section className="intro" aria-labelledby="intro-title">
          <div>
            <p className="eyebrow">
              <span className="tiny-star">✦</span> YOUR PERSONAL AI DESIGN AGENT
            </p>
            <h1 id="intro-title">
              Wear your <em>imagination.</em>
              <span className="heading-star">✧</span>
            </h1>
            <p className="intro-copy">
              Tell Genie your idea. Shape it together. Wear something only you
              could imagine.
            </p>
          </div>
          <div className="intro-note">
            <span className="hand-arrow">↙</span>
            <p>
              You dream it.
              <br />
              Genie makes it.
            </p>
          </div>
        </section>
        <div className="studio-topline" id="studio">
          <div className="steps">
            <span className="current">
              <b>1</b> Dream it
            </span>
            <i />
            <button
              onClick={() =>
                productRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                })
              }
            >
              <b>2</b> Make it yours
            </button>
            <i />
            <button
              onClick={() => {
                setDialog("bag");
                setCheckout(false);
              }}
            >
              <b>3</b> Wear it
            </button>
          </div>
          <span className="studio-status">
            <span />
            {status.enabled
              ? "Your design partner is ready"
              : "Explore the studio · Agent not connected"}
          </span>
        </div>
        <section className="studio-grid" aria-label="Apparel design studio">
          <DesignAgent
            brief={designBrief}
            design={design}
            concepts={concepts}
            accessCode={code}
            enabled={status.enabled}
            generating={busy}
            completed={completed}
            expected={expected}
            elapsed={elapsed}
            generationError={error}
            onApply={applyAgentReply}
            onGenerate={generateFromAgent}
            onNeedAccess={(resume) => {
              pendingAccess.current = resume;
              setDialog("access");
            }}
            onStopGeneration={() => abort.current?.abort()}
            onBriefChange={setPrompt}
          />
          <section className="preview-panel" aria-label="Design preview">
            <div className="preview-toolbar">
              <span className="preview-label">
                <span />
                LIVE PREVIEW
              </span>
              <div>
                <button
                  className={`icon-button ${isSaved ? "is-saved" : ""}`}
                  aria-label={
                    isSaved ? "Unsave current design" : "Save current design"
                  }
                  aria-pressed={isSaved}
                  onClick={toggleSave}
                >
                  <Heart size={17} fill={isSaved ? "currentColor" : "none"} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Download artwork"
                  onClick={downloadArtwork}
                >
                  <ArrowDownToLine size={17} />
                </button>
              </div>
            </div>
            <div className="preview-canvas">
              <div className="preview-orbit" />
              <span className="canvas-word">ONE OF A KIND.</span>
              <button
                className="product-zoom"
                onClick={() => setDialog("zoom")}
                aria-label="Enlarge garment preview"
              >
                <GarmentPreview
                  garment={garment}
                  color={color}
                  placement={placement}
                  image={design.image}
                  scale={scale}
                />
              </button>
              <span className="preview-sticker">
                <Sparkles size={13} /> Made from your imagination
              </span>
              {busy && (
                <div className="generation-overlay">
                  <LoaderCircle className="spin" size={24} />
                  <strong>Dreaming up your concepts</strong>
                  <span>You can keep customizing while we create.</span>
                </div>
              )}
            </div>
            <div className="view-controls">
              <div className="segmented small">
                {(["front", "back"] as const).map((side) => (
                  <button
                    key={side}
                    className={placement === side ? "selected" : ""}
                    onClick={() => setPlacement(side)}
                    aria-pressed={placement === side}
                  >
                    {side === "front" ? "Front" : "Back"}
                  </button>
                ))}
              </div>
              <button
                className="reset-view"
                onClick={() => {
                  setScale(85);
                  setPlacement("back");
                }}
                aria-label="Reset print size and view"
              >
                <RotateCcw size={14} />
              </button>
            </div>
            <div className="concepts-heading">
              <span>
                {concepts.some((item) => item.source === "generated")
                  ? "YOUR CONCEPTS"
                  : "TRY A SAMPLE DESIGN"}
              </span>
              <span>
                {concepts.length} designs <ArrowDown size={11} />
              </span>
            </div>
            <div className="concept-strip">
              {concepts.map((item, index) => (
                <button
                  key={item.id}
                  className={`concept ${item.id === design.id ? "selected" : ""}`}
                  onClick={() => {
                    setDesign(item);
                    if (item.source === "sample") setPrompt(item.prompt);
                  }}
                  aria-label={`Select ${item.name}`}
                  aria-pressed={item.id === design.id}
                >
                  <img src={item.image} alt={item.name} />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {item.id === design.id && (
                    <span className="concept-check">
                      <Check size={10} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
          <aside className="product-panel" ref={productRef}>
            <div className="panel-title">
              <SlidersHorizontal size={17} />
              <h2>Make it yours</h2>
            </div>
            <p className="muted panel-description">
              The perfect canvas for your idea.
            </p>
            <span className="field-label">Your canvas</span>
            <div className="garment-picker">
              {(["hoodie", "tee"] as const).map((item) => (
                <button
                  key={item}
                  className={garment === item ? "selected" : ""}
                  onClick={() => setGarment(item)}
                  aria-pressed={garment === item}
                >
                  <GarmentPreview garment={item} color={1} placement="front" />
                  <span>{item === "hoodie" ? "Hoodie" : "T-shirt"}</span>
                  {garment === item && (
                    <span className="selection-dot">
                      <Check size={10} />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="color-label">
              <span className="field-label">Color</span>
              <span>{colors[color].name}</span>
            </div>
            <div className="swatches" role="group" aria-label="Garment color">
              {colors.map((item, index) => (
                <button
                  key={item.name}
                  className={color === index ? "selected" : ""}
                  aria-label={item.name}
                  aria-pressed={color === index}
                  onClick={() => setColor(index)}
                  style={{ "--swatch": item.value } as React.CSSProperties}
                >
                  {color === index && (
                    <Check
                      size={14}
                      color={index === 1 ? "#393d32" : "white"}
                    />
                  )}
                </button>
              ))}
            </div>
            <div className="label-row">
              <span className="field-label">Print placement</span>
            </div>
            <div className="segmented">
              {(["front", "back"] as const).map((side) => (
                <button
                  key={side}
                  className={placement === side ? "selected" : ""}
                  onClick={() => setPlacement(side)}
                  aria-pressed={placement === side}
                >
                  {side === "front" ? "Front" : "Back"}
                </button>
              ))}
            </div>
            <div className="label-row print-size">
              <label className="field-label" htmlFor="print-size">
                Print size
              </label>
              <span>
                {scale < 65 ? "Small" : scale < 90 ? "Medium" : "Large"}
              </span>
            </div>
            <input
              className="range"
              id="print-size"
              type="range"
              min="45"
              max="110"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            />
            <div className="range-labels">
              <span>Subtle statement</span>
              <span>Big energy</span>
            </div>
            <div className="product-details">
              <div>
                <h3>{garments[garment].name}</h3>
                <strong>{money(garments[garment].price)}</strong>
              </div>
              <p>{garments[garment].detail}</p>
              <span className="price-note">Illustrative price · per piece</span>
            </div>
            <div className="sizes-heading">
              <button onClick={() => setShowSizes(!showSizes)}>
                Size & quantity{" "}
                <ChevronDown size={13} className={showSizes ? "rotated" : ""} />
              </button>
              <button onClick={() => setDialog("size")}>Size guide</button>
            </div>
            {showSizes ? (
              <div className="quantity-table">
                {sizes.map((size) => (
                  <div key={size}>
                    <span>{size}</span>
                    <div>
                      <button
                        aria-label={`Decrease ${size} quantity`}
                        onClick={() =>
                          setSelectedSizes((v) => ({
                            ...v,
                            [size]: Math.max(0, v[size] - 1),
                          }))
                        }
                        disabled={!selectedSizes[size]}
                      >
                        <Minus size={12} />
                      </button>
                      <span>{selectedSizes[size]}</span>
                      <button
                        aria-label={`Increase ${size} quantity`}
                        onClick={() =>
                          setSelectedSizes((v) => ({
                            ...v,
                            [size]: Math.min(20, v[size] + 1),
                          }))
                        }
                        disabled={selectedSizes[size] >= 20}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="size-chips">
                {sizes.map((size) => (
                  <button
                    key={size}
                    className={selectedSizes[size] ? "selected" : ""}
                    onClick={() =>
                      setSelectedSizes((v) => ({
                        ...v,
                        [size]: v[size] ? 0 : 1,
                      }))
                    }
                    aria-pressed={selectedSizes[size] > 0}
                  >
                    {size}
                    {selectedSizes[size] > 1 && (
                      <sup>{selectedSizes[size]}</sup>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button className="dark-button add-bag" onClick={addToBag}>
              <ShoppingBag size={16} /> Add to bag{" "}
              <span>{money(totalQuantity * garments[garment].price)}</span>
            </button>
            <p className="order-note">
              <LockKeyhole size={11} /> Order preview · No payment required
            </p>
          </aside>
        </section>
        <div className="below-studio">
          <span>
            <Sparkles size={15} /> Imagination has no dress code.
          </span>
          <span>Mockups are a visual guide. Final print colors may vary.</span>
        </div>
        <section className="inspiration-section" id="inspiration">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A SPARK TO GET YOU STARTED</p>
              <h2>
                Big ideas start <em>somewhere.</em>
              </h2>
            </div>
            <button
              className="text-link"
              onClick={() => {
                setPrompt(
                  inspiration[Math.floor(Math.random() * inspiration.length)],
                );
                document.getElementById("genie-message")?.focus();
                document
                  .querySelector("#studio")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Find your spark <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="inspiration-grid">
            {sampleDesigns.slice(1).map((item, index) => (
              <button
                key={item.id}
                className={`inspiration-card inspiration-${index}`}
                onClick={() => {
                  chooseSample(item);
                  setColor([0, 2, 3][index]);
                  setGarment(index === 0 ? "tee" : "hoodie");
                  document
                    .querySelector("#studio")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <div className="inspiration-copy">
                  <span>
                    {
                      [
                        "FOR THE DAYDREAMERS",
                        "FOR THE FREE SPIRITS",
                        "FOR THE SLOW DAYS",
                      ][index]
                    }
                  </span>
                  <h3>{item.name}</h3>
                  <span className="try-design">
                    Make it yours <ArrowUpRight size={15} />
                  </span>
                </div>
                <GarmentPreview
                  garment={index === 0 ? "tee" : "hoodie"}
                  color={[0, 2, 3][index]}
                  placement="back"
                  image={item.image}
                  scale={95}
                />
              </button>
            ))}
          </div>
        </section>
        <section className="manifesto">
          <span>✦</span>
          <p>
            A little less ordinary.
            <br />
            <em>A little more you.</em>
          </p>
          <span>✦</span>
        </section>
      </main>
      <footer>
        <Brand small />
        <span>Your idea is our command.</span>
        <button onClick={() => setDialog("how")}>
          Made for your imagination <ArrowUpRight size={13} />
        </button>
        <span className="footer-beta">BETA STUDIO</span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {dialog === "how" && (
        <Modal
          title="Your idea is our command."
          onClose={() => setDialog(null)}
        >
          <p className="modal-intro">
            An idea-to-outfit studio, with a little help from AI.
          </p>
          <div className="how-steps">
            {[
              {
                title: "Dream it",
                text: "Chat with Genie about your idea. Your design agent asks useful questions, remembers your choices, and builds the brief with you. Ask it to generate four concepts when you are ready.",
              },
              {
                title: "Make it yours",
                text: "Tell Genie which concept you like and what to change. It updates the garment preview and can edit the selected artwork. You can also adjust the controls yourself, save designs, and download artwork.",
              },
              {
                title: "Plan your order",
                text: "Choose sizes and quantities, then build an order draft. This beta doesn’t take payments, submit orders, or arrange shipping.",
              },
            ].map((item, index) => (
              <div key={item.title}>
                <b>{index + 1}</b>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="info-box">
            <CircleHelp size={18} />
            <p>
              Saved designs and your bag stay on this browser. Download your
              artwork to keep a separate copy. Shipping details are only
              included in a draft you choose to download.
            </p>
          </div>
          <button
            className="primary full"
            onClick={() => {
              setDialog(null);
              document.getElementById("genie-message")?.focus();
            }}
          >
            Let’s make something <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {dialog === "access" && (
        <Modal title="Your studio, unlocked." onClose={() => setDialog(null)}>
          <p className="modal-intro">
            Enter the access code from the studio owner to chat with Genie and
            create original artwork.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setCode(codeDraft);
              setDialog(null);
              const resume = pendingAccess.current;
              pendingAccess.current = null;
              if (resume) resume(codeDraft);
            }}
          >
            <label className="field-label" htmlFor="studio-code">
              Studio access code
            </label>
            <input
              autoFocus
              id="studio-code"
              className="text-input"
              type="password"
              value={codeDraft}
              onChange={(e) => setCodeDraft(e.target.value)}
              required
              autoComplete="off"
            />
            <p className="muted">
              This is the studio passphrase, never your OpenAI API key.
            </p>
            <button className="primary full" type="submit">
              <LockKeyhole size={16} /> Unlock Genie
            </button>
          </form>
        </Modal>
      )}
      {dialog === "zoom" && (
        <Modal title={design.name} onClose={() => setDialog(null)} wide>
          <div className="zoom-preview">
            <GarmentPreview
              garment={garment}
              color={color}
              placement={placement}
              image={design.image}
              scale={scale}
            />
          </div>
          <div className="zoom-actions">
            <button className="outline-button" onClick={toggleSave}>
              <Heart size={16} />
              {isSaved ? "Saved" : "Save design"}
            </button>
            <button className="dark-button" onClick={downloadArtwork}>
              <ArrowDownToLine size={16} /> Download artwork
            </button>
          </div>
        </Modal>
      )}
      {dialog === "size" && (
        <Modal title="Find your fit" onClose={() => setDialog(null)}>
          <p className="modal-intro">
            Indicative flat garment measurements in inches. Check the supplier’s
            current specification before placing a real order.
          </p>
          <table className="size-table">
            <thead>
              <tr>
                <th>Size</th>
                <th>Width</th>
                <th>Length</th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((size, index) => (
                <tr key={size}>
                  <td>{size}</td>
                  <td>
                    {[20, 22, 24, 26, 28][index] - (garment === "tee" ? 2 : 0)}″
                  </td>
                  <td>
                    {[27, 28, 29, 30, 31][index] + (garment === "tee" ? 1 : 0)}″
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            Width: armpit to armpit. Length: shoulder to hem. For a relaxed fit,
            compare these measurements with a favorite piece you already own.
          </p>
        </Modal>
      )}
      {dialog === "saved" && (
        <Modal
          title="Your little collection"
          onClose={() => setDialog(null)}
          wide
        >
          <p className="modal-intro">
            Ideas worth keeping. Saved locally on this browser.
          </p>
          {!saved.length ? (
            <div className="empty-state">
              <Bookmark size={36} />
              <h3>Good ideas deserve a home.</h3>
              <p>Tap the heart on any design to keep it here.</p>
              <button className="dark-button" onClick={() => setDialog(null)}>
                Back to the studio <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <div className="saved-grid">
              {saved.map((item) => (
                <div className="saved-card" key={item.id}>
                  <button
                    onClick={() => {
                      setDesign(item);
                      setPrompt(item.prompt);
                      setDialog(null);
                    }}
                  >
                    <img src={item.image} alt={item.name} />
                    <strong>{item.name}</strong>
                    <span>
                      {item.source === "sample"
                        ? "Sample artwork"
                        : "Original generation"}
                    </span>
                  </button>
                  <button
                    className="delete-design"
                    aria-label={`Remove ${item.name}`}
                    onClick={() =>
                      setSaved((values) =>
                        values.filter((v) => v.id !== item.id),
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      {dialog === "bag" && (
        <Modal
          title={
            orderReady
              ? "Your idea, all together."
              : checkout
                ? "Review your order draft"
                : "Your bag of good ideas"
          }
          onClose={() => setDialog(null)}
          wide
        >
          {!cart.length ? (
            <div className="empty-state">
              <ShoppingBag size={38} />
              <h3>Your next favorite is waiting.</h3>
              <p>Choose a design and add your sizes to get started.</p>
              <button className="dark-button" onClick={() => setDialog(null)}>
                Keep creating <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <>
              <div className="draft-banner">
                <span>ORDER PREVIEW</span>
                <p>
                  No payment is taken. No order is sent. Prices are
                  illustrative; tax and shipping are not included.
                </p>
              </div>
              {orderReady ? (
                <div className="order-ready">
                  <CheckCircle2 size={40} />
                  <h3>Ready when you are.</h3>
                  <p>
                    Your draft includes {bagCount} piece
                    {bagCount === 1 ? "" : "s"}, your artwork, and the shipping
                    details below. Download it to share with your printer.
                  </p>
                  <div className="shipping-summary">
                    <strong>{shipping.name}</strong>
                    <span>{shipping.address}</span>
                    <span>
                      {shipping.city}, {shipping.region} {shipping.postal}
                    </span>
                    <span>{shipping.country}</span>
                    <span>{shipping.email}</span>
                  </div>
                  <button className="primary full" onClick={downloadOrder}>
                    <ArrowDownToLine size={16} />
                    Download order draft
                  </button>
                  <button
                    className="text-link full"
                    onClick={() => setOrderReady(false)}
                  >
                    Edit draft
                  </button>
                </div>
              ) : (
                <>
                  <div className="cart-list">
                    {cart.map((item) => (
                      <div className="cart-item" key={item.id}>
                        <div className="cart-image">
                          <GarmentPreview
                            garment={item.garment}
                            color={item.color}
                            placement={item.placement}
                            image={item.design.image}
                            scale={item.scale}
                          />
                        </div>
                        <div className="cart-description">
                          <h3>{item.design.name}</h3>
                          <p>
                            {garments[item.garment].name} ·{" "}
                            {colors[item.color].name}
                          </p>
                          <p>
                            {item.placement === "back" ? "Back" : "Front"} print
                            · Size {item.size}
                          </p>
                          <div className="cart-quantity">
                            <button
                              aria-label={`Decrease ${item.design.name} ${item.size}`}
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              <Minus size={12} />
                            </button>
                            <span>{item.quantity}</span>
                            <button
                              aria-label={`Increase ${item.design.name} ${item.size}`}
                              onClick={() => updateQuantity(item.id, 1)}
                              disabled={item.quantity >= 20}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="cart-price">
                          <strong>
                            {money(
                              garments[item.garment].price * item.quantity,
                            )}
                          </strong>
                          <button
                            aria-label={`Remove ${item.design.name} ${item.size} from bag`}
                            onClick={() =>
                              setCart((items) =>
                                items.filter((v) => v.id !== item.id),
                              )
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="cart-total">
                    <span>
                      Estimated subtotal{" "}
                      <small>
                        {bagCount} piece{bagCount === 1 ? "" : "s"}
                      </small>
                    </span>
                    <strong>{money(cartTotal(cart))}</strong>
                  </div>
                  {checkout ? (
                    <form
                      className="shipping-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setOrderReady(true);
                      }}
                    >
                      <h3>Shipping details for your draft</h3>
                      <p className="muted">
                        These stay in this tab until you download your draft.
                      </p>
                      <div className="form-grid">
                        {(
                          [
                            { key: "name", label: "Full name", auto: "name" },
                            { key: "email", label: "Email", auto: "email" },
                            {
                              key: "address",
                              label: "Street address",
                              auto: "street-address",
                            },
                            {
                              key: "city",
                              label: "City",
                              auto: "address-level2",
                            },
                            {
                              key: "region",
                              label: "State / region",
                              auto: "address-level1",
                            },
                            {
                              key: "postal",
                              label: "Postal code",
                              auto: "postal-code",
                            },
                            {
                              key: "country",
                              label: "Country",
                              auto: "country-name",
                            },
                          ] as const
                        ).map((field) => (
                          <label
                            key={field.key}
                            className={field.key === "address" ? "span-2" : ""}
                          >
                            {field.label}
                            <input
                              required
                              maxLength={200}
                              type={field.key === "email" ? "email" : "text"}
                              autoComplete={field.auto}
                              value={shipping[field.key]}
                              onChange={(e) =>
                                setShipping((data) => ({
                                  ...data,
                                  [field.key]: e.target.value,
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <button className="primary full" type="submit">
                        Create order draft <ArrowRight size={16} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        className="primary full"
                        onClick={() => setCheckout(true)}
                      >
                        Review order draft <ArrowRight size={16} />
                      </button>
                      <button
                        className="text-link full"
                        onClick={() => setDialog(null)}
                      >
                        Keep creating
                      </button>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
