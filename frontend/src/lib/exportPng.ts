/** 1080x1080 post PNG, ported from the prototype's downloadPostPNG
    (docs/draft/urbanspace_dashboard.html lines 1075-1125).
    If imageDataUrl is provided (a generated AI image), it is center cover-cropped
    to fill the square; otherwise the platform colour fills it, with a decorative
    circle for the brand look. */
export interface ExportOpts {
  color: string;
  imageDataUrl?: string;
  onError?: (msg: string) => void;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });

export async function downloadPostPNG(opts: ExportOpts): Promise<void> {
  const { color, imageDataUrl, onError } = opts;
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
      const scale = Math.max(W / img.width, H / img.height);
      const sw = W / scale, sh = H / scale;
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H);
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
