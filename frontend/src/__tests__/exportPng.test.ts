import { afterEach, expect, test, vi } from "vitest";
import { downloadPostPNG, wrapCanvasText } from "../lib/exportPng";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const makeCtx = () => ({
  fillStyle: "",
  font: "",
  textBaseline: "",
  fillRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn((s: string) => ({ width: s.length * 10 })),
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
});

/** Stub the canvas surface jsdom lacks: 2d context, toBlob, and object URLs. */
const setupCanvas = (toBlobImpl: (cb: BlobCallback) => void = () => {}) => {
  const ctx = makeCtx();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation(toBlobImpl);
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
  return { ctx, toBlob };
};

/** Image stub whose src setter fires onload (or onerror) on the microtask queue. */
const stubImage = (o: { width: number; height: number; fail?: boolean }) => {
  class FakeImage {
    width = o.width;
    height = o.height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      queueMicrotask(() => { (o.fail ? this.onerror : this.onload)?.(); });
    }
  }
  vi.stubGlobal("Image", FakeImage);
};

test("wrapCanvasText breaks lines at maxWidth", () => {
  const drawn: Array<[string, number]> = [];
  const ctx = {
    measureText: (s: string) => ({ width: s.length * 10 }),
    fillText: (s: string, _x: number, y: number) => drawn.push([s.trim(), y]),
  } as unknown as CanvasRenderingContext2D;
  wrapCanvasText(ctx, "one two three four", 0, 100, 100, 50); // maxWidth fits ~9 chars/line
  expect(drawn.length).toBeGreaterThan(1);
  expect(drawn[0][1]).toBe(100);
  expect(drawn[1][1]).toBe(150);
});

test("wrapCanvasText caps lines with ellipsis", () => {
  const drawn: string[] = [];
  const ctx = {
    measureText: (s: string) => ({ width: s.length * 10 }),
    fillText: (s: string) => drawn.push(s),
  } as unknown as CanvasRenderingContext2D;
  wrapCanvasText(ctx, "one two three four five six seven", 0, 100, 100, 50, 2);
  expect(drawn).toHaveLength(2);
  expect(drawn[1].endsWith("…")).toBe(true);
});

test("downloadPostPNG reports unsupported when canvas 2d missing", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const onError = vi.fn();
  await downloadPostPNG({ text: "hi", color: "#E8651A", platform: "instagram", onError });
  expect(onError).toHaveBeenCalledWith("PNG export not supported in this browser");
});

test("cover-crops the AI image and applies scrim", async () => {
  const { ctx } = setupCanvas();
  stubImage({ width: 2000, height: 1000 });
  await downloadPostPNG({
    text: "hi", color: "#E8651A", platform: "instagram",
    imageDataUrl: "data:image/png;base64,AAAA",
  });
  expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  const args = ctx.drawImage.mock.calls[0];
  expect(args).toHaveLength(9);
  // scale = max(1080/2000, 1080/1000) = 1.08 -> source rect (500, 0, 1000, 1000)
  expect(args[1]).toBeCloseTo(500);
  expect(args[2]).toBeCloseTo(0);
  expect(args[3]).toBeCloseTo(1000);
  expect(args[4]).toBeCloseTo(1000);
  expect(args.slice(5)).toEqual([0, 0, 1080, 1080]);
  // scrim fillRect lands after the image so the caption stays readable
  const drawOrder = ctx.drawImage.mock.invocationCallOrder[0];
  const fillsAfterImage = ctx.fillRect.mock.invocationCallOrder.filter((o) => o > drawOrder);
  expect(fillsAfterImage.length).toBeGreaterThan(0);
  expect(ctx.arc).not.toHaveBeenCalled(); // no decorative circle on the image background
});

test("reports image failure and falls back to branded background", async () => {
  const { ctx, toBlob } = setupCanvas();
  stubImage({ width: 800, height: 800, fail: true });
  const onError = vi.fn();
  await downloadPostPNG({
    text: "hi", color: "#E8651A", platform: "instagram",
    imageDataUrl: "data:image/png;base64,AAAA", onError,
  });
  expect(onError).toHaveBeenCalledWith(
    "Post image could not be loaded — exporting with brand background",
  );
  expect(ctx.drawImage).not.toHaveBeenCalled();
  expect(ctx.arc).toHaveBeenCalled(); // full brand look, circle included
  expect(toBlob).toHaveBeenCalled(); // export still proceeds
});

test("reports when toBlob yields null", async () => {
  setupCanvas((cb) => { cb(null); });
  const onError = vi.fn();
  await downloadPostPNG({ text: "hi", color: "#E8651A", platform: "instagram", onError });
  expect(onError).toHaveBeenCalledWith("PNG export failed");
});
