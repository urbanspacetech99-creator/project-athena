import { afterEach, expect, test, vi } from "vitest";
import { downloadPostPNG } from "./exportPng";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const makeCtx = () => ({
  fillStyle: "",
  fillRect: vi.fn(),
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

test("downloadPostPNG reports unsupported when canvas 2d missing", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const onError = vi.fn();
  await downloadPostPNG({ color: "#E8651A", onError });
  expect(onError).toHaveBeenCalledWith("PNG export not supported in this browser");
});

test("cover-crops the AI image to fill the square", async () => {
  const { ctx } = setupCanvas();
  stubImage({ width: 2000, height: 1000 });
  await downloadPostPNG({ color: "#E8651A", imageDataUrl: "data:image/png;base64,AAAA" });
  expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  const args = ctx.drawImage.mock.calls[0];
  expect(args).toHaveLength(9);
  // scale = max(1080/2000, 1080/1000) = 1.08 -> source rect (500, 0, 1000, 1000)
  expect(args[1]).toBeCloseTo(500);
  expect(args[2]).toBeCloseTo(0);
  expect(args[3]).toBeCloseTo(1000);
  expect(args[4]).toBeCloseTo(1000);
  expect(args.slice(5)).toEqual([0, 0, 1080, 1080]);
  expect(ctx.arc).not.toHaveBeenCalled(); // no decorative circle on the image background
});

test("reports image failure and falls back to branded background", async () => {
  const { ctx, toBlob } = setupCanvas();
  stubImage({ width: 800, height: 800, fail: true });
  const onError = vi.fn();
  await downloadPostPNG({
    color: "#E8651A", imageDataUrl: "data:image/png;base64,AAAA", onError,
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
  await downloadPostPNG({ color: "#E8651A", onError });
  expect(onError).toHaveBeenCalledWith("PNG export failed");
});
