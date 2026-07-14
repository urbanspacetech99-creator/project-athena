/** 1080x1080 branded post PNG, ported from the prototype's downloadPostPNG
    (docs/draft/urbanspace_dashboard.html lines 1075-1125).
    If imageDataUrl is provided (a generated AI image), it is center cover-cropped
    to fill the square and darkened with a scrim so the caption stays readable. */
export interface ExportOpts {
  text: string;
  color: string;
  platform: string;
  imageDataUrl?: string;
  onError?: (msg: string) => void;
}

export function wrapCanvasText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  maxWidth: number, lineHeight: number, maxLines = Infinity,
): void {
  const words = String(text).split(" ");
  let line = "";
  let curY = y;
  let lineNo = 1;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      if (lineNo >= maxLines) {   // out of room: ellipsize this line and stop
        ctx.fillText(line.trimEnd() + "…", x, curY);
        return;
      }
      ctx.fillText(line, x, curY);
      line = words[n] + " ";
      curY += lineHeight;
      lineNo++;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, curY);
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });

export async function downloadPostPNG(opts: ExportOpts): Promise<void> {
  const { text, color, platform, imageDataUrl, onError } = opts;
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* fonts optional */ } }
  const W = 1080, H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) { onError?.("PNG export not supported in this browser"); return; }

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  let drewImage = false;
  if (imageDataUrl) {
    try {
      const img = await loadImage(imageDataUrl);
      const scale = Math.max(W / img.width, H / img.height); // cover, not stretch
      const sw = W / scale, sh = H / scale;
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H);
      ctx.fillStyle = "rgba(0,0,0,.45)";      // scrim for text legibility
      ctx.fillRect(0, 0, W, H);
      drewImage = true;
    } catch {
      onError?.("Post image could not be loaded — exporting with brand background");
    }
  }
  if (!drewImage) {
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.beginPath(); ctx.arc(W - 80, 90, 220, 0, Math.PI * 2); ctx.fill();
  }

  try {
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "alphabetic";
    ctx.font = '800 42px "DM Sans",sans-serif';
    ctx.fillText("URBAN SPACE", 64, 96);
    ctx.font = '700 24px "DM Sans",sans-serif';
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.fillText(platform.toUpperCase(), 64, 132);
    ctx.fillStyle = "#ffffff";
    ctx.font = '700 54px "DM Sans",sans-serif';
    wrapCanvasText(ctx, text, 64, 340, W - 128, 66, 9); // 9 lines end at y=868, above the footer
    ctx.font = '500 24px "DM Sans",sans-serif';
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.fillText("Self-Storage · Work · Fulfilment", 64, H - 64);

    canvas.toBlob((blob) => {
      if (!blob) { onError?.("PNG export failed"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `urbanspace-post-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }, "image/png");
  } catch {
    onError?.("PNG export failed");
  }
}
