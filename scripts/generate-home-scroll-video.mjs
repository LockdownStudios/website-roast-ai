import { mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const width = 1280;
const height = 720;
const fps = 30;
const duration = 7;
const frames = fps * duration;
const frameDir = ".codex/home-scroll-video-frames";
const output = "public/videos/home-roast-scroll.mp4";
const poster = "public/videos/home-roast-scroll-preview.jpg";

const palette = {
  bg: [5, 8, 13],
  ink: [9, 13, 20],
  panel: [18, 27, 40],
  panelSoft: [28, 42, 62],
  white: [246, 247, 251],
  muted: [154, 165, 183],
  orange: [247, 107, 28],
  amber: [255, 215, 178],
  red: [239, 68, 68],
  cyan: [72, 190, 220],
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function blendPixel(buffer, x, y, color, alpha) {
  if (x < 0 || x >= width || y < 0 || y >= height || alpha <= 0) {
    return;
  }

  const idx = (y * width + x) * 3;
  const a = clamp(alpha, 0, 1);
  buffer[idx] = Math.round(mix(buffer[idx], color[0], a));
  buffer[idx + 1] = Math.round(mix(buffer[idx + 1], color[1], a));
  buffer[idx + 2] = Math.round(mix(buffer[idx + 2], color[2], a));
}

function fillRect(buffer, x, y, w, h, color, alpha = 1) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.ceil(x + w));
  const y1 = Math.min(height, Math.ceil(y + h));

  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      blendPixel(buffer, xx, yy, color, alpha);
    }
  }
}

function strokeRect(buffer, x, y, w, h, color, alpha = 1, thickness = 1) {
  fillRect(buffer, x, y, w, thickness, color, alpha);
  fillRect(buffer, x, y + h - thickness, w, thickness, color, alpha);
  fillRect(buffer, x, y, thickness, h, color, alpha);
  fillRect(buffer, x + w - thickness, y, thickness, h, color, alpha);
}

function glowRect(buffer, x, y, w, h, color, strength = 1) {
  for (let layer = 18; layer >= 2; layer -= 4) {
    strokeRect(
      buffer,
      x - layer,
      y - layer,
      w + layer * 2,
      h + layer * 2,
      color,
      0.018 * strength,
      2,
    );
  }
}

function radial(buffer, cx, cy, radius, color, strength) {
  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(width, Math.ceil(cx + radius));
  const y1 = Math.min(height, Math.ceil(cy + radius));

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.sqrt(dx * dx + dy * dy) / radius;
      const alpha = Math.pow(clamp(1 - distance, 0, 1), 2.4) * strength;
      blendPixel(buffer, x, y, color, alpha);
    }
  }
}

function line(buffer, x0, y0, x1, y1, color, alpha = 1, thickness = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = Math.round(mix(x0, x1, t));
    const y = Math.round(mix(y0, y1, t));
    fillRect(buffer, x - thickness / 2, y - thickness / 2, thickness, thickness, color, alpha);
  }
}

function drawBrowser(buffer, t) {
  const lift = Math.sin(t * Math.PI * 1.2) * 12;
  const x = 678 + Math.sin(t * Math.PI * 0.8) * 22;
  const y = 74 - lift;
  const w = 522;
  const h = 572;

  glowRect(buffer, x, y, w, h, palette.orange, 1.35);
  fillRect(buffer, x, y, w, h, palette.panel, 0.92);
  fillRect(buffer, x, y, w, 48, palette.ink, 0.86);
  strokeRect(buffer, x, y, w, h, palette.orange, 0.5, 2);

  fillRect(buffer, x + 22, y + 18, 10, 10, palette.red, 0.72);
  fillRect(buffer, x + 42, y + 18, 10, 10, palette.orange, 0.72);
  fillRect(buffer, x + 62, y + 18, 10, 10, palette.cyan, 0.42);

  const scan = y + 70 + smoothstep(0.08, 0.93, t) * 448;
  radial(buffer, x + w * 0.5, scan, 210, palette.orange, 0.08);
  fillRect(buffer, x + 24, scan - 2, w - 48, 4, palette.orange, 0.88);
  fillRect(buffer, x + 24, scan - 18, w - 48, 36, palette.orange, 0.1);

  const reveal1 = smoothstep(0.08, 0.24, t);
  const reveal2 = smoothstep(0.24, 0.44, t);
  const reveal3 = smoothstep(0.44, 0.68, t);
  const reveal4 = smoothstep(0.62, 0.88, t);

  fillRect(buffer, x + 42, y + 86, 118, 118, palette.orange, 0.92);
  radial(buffer, x + 101, y + 145, 76, palette.amber, 0.12);
  fillRect(buffer, x + 188, y + 104, 248 * reveal1, 24, palette.white, 0.62);
  fillRect(buffer, x + 188, y + 150, 188 * reveal1, 18, palette.muted, 0.44);

  fillRect(buffer, x + 42, y + 252, 382 * reveal2, 16, palette.red, 0.78);
  fillRect(buffer, x + 42, y + 296, 330 * reveal3, 16, palette.orange, 0.8);
  fillRect(buffer, x + 42, y + 340, 420 * reveal4, 16, palette.white, 0.5);

  for (let i = 0; i < 4; i += 1) {
    const localT = smoothstep(0.42 + i * 0.08, 0.58 + i * 0.08, t);
    const bx = x + 42 + i * 104;
    fillRect(buffer, bx, y + 420, 84, 72, palette.panelSoft, 0.5 * localT);
    strokeRect(buffer, bx, y + 420, 84, 72, palette.white, 0.09 * localT, 1);
    fillRect(buffer, bx + 14, y + 438, 42 + i * 7, 8, palette.orange, 0.7 * localT);
    fillRect(buffer, bx + 14, y + 462, 54, 7, palette.muted, 0.36 * localT);
  }
}

function drawScoreGlass(buffer, t) {
  const x = 94 + Math.sin(t * Math.PI * 0.9) * 14;
  const y = 122 + Math.cos(t * Math.PI * 0.8) * 10;
  const w = 514;
  const h = 428;

  glowRect(buffer, x, y, w, h, palette.cyan, 0.55);
  fillRect(buffer, x, y, w, h, palette.ink, 0.72);
  strokeRect(buffer, x, y, w, h, palette.white, 0.12, 2);
  fillRect(buffer, x, y, w, 1, palette.white, 0.22);

  const scoreReveal = smoothstep(0.15, 0.55, t);
  const scoreW = 88 + 282 * scoreReveal;
  radial(buffer, x + 142, y + 116, 180, palette.orange, 0.13 * scoreReveal);
  fillRect(buffer, x + 42, y + 52, 312, 38, palette.orange, 0.86);
  fillRect(buffer, x + 42, y + 122, 420, 16, palette.white, 0.44);
  fillRect(buffer, x + 42, y + 160, 334, 12, palette.muted, 0.4);

  fillRect(buffer, x + 42, y + 226, 400, 18, palette.red, 0.22 + scoreReveal * 0.45);
  fillRect(buffer, x + 42, y + 266, scoreW, 18, palette.orange, 0.82);
  fillRect(buffer, x + 42, y + 306, 340, 12, palette.muted, 0.38);

  const pulse = 0.5 + Math.sin(t * Math.PI * 7) * 0.5;
  strokeRect(buffer, x + 28, y + 210, 430, 70, palette.red, 0.14 + pulse * 0.18, 1);
}

function drawConnectiveMarks(buffer, t) {
  const alpha = smoothstep(0.28, 0.7, t) * 0.35;
  line(buffer, 556, 314, 706, 260, palette.orange, alpha, 2);
  line(buffer, 556, 350, 706, 370, palette.orange, alpha * 0.82, 2);
  line(buffer, 548, 402, 706, 520, palette.cyan, alpha * 0.5, 1);

  for (let i = 0; i < 18; i += 1) {
    const p = (i / 18 + t * 0.3) % 1;
    const x = mix(556, 706, p);
    const y = mix(314, 260, p) + Math.sin(p * Math.PI * 4) * 18;
    radial(buffer, x, y, 18, palette.orange, alpha * 0.12);
  }
}

function drawBackground(buffer, t) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 3;
      const nx = x / width;
      const ny = y / height;
      const vignette = Math.sqrt((nx - 0.52) ** 2 + (ny - 0.48) ** 2);
      const base = clamp(1 - vignette * 1.25, 0, 1);
      buffer[idx] = Math.round(mix(palette.bg[0], 16, base * 0.28));
      buffer[idx + 1] = Math.round(mix(palette.bg[1], 24, base * 0.28));
      buffer[idx + 2] = Math.round(mix(palette.bg[2], 37, base * 0.28));
    }
  }

  radial(buffer, 870 + Math.sin(t * Math.PI) * 80, 220, 360, palette.orange, 0.13);
  radial(buffer, 260, 480 + Math.cos(t * Math.PI * 0.7) * 50, 330, palette.cyan, 0.055);

  for (let x = -80; x < width + 80; x += 96) {
    line(
      buffer,
      x + t * 80,
      0,
      x - 160 + t * 80,
      height,
      palette.white,
      0.018,
      1,
    );
  }

  for (let y = 0; y < height; y += 6) {
    fillRect(buffer, 0, y, width, 1, palette.bg, 0.18);
  }
}

async function writeFrame(frame) {
  const t = frame / (frames - 1);
  const buffer = Buffer.alloc(width * height * 3);

  drawBackground(buffer, t);
  drawScoreGlass(buffer, t);
  drawBrowser(buffer, t);
  drawConnectiveMarks(buffer, t);

  const header = Buffer.from(`P6\n${width} ${height}\n255\n`);
  const name = join(frameDir, `frame-${String(frame).padStart(4, "0")}.ppm`);
  await writeFile(name, Buffer.concat([header, buffer]));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code}`));
      }
    });
  });
}

await rm(frameDir, { recursive: true, force: true });
await mkdir(frameDir, { recursive: true });
await mkdir("public/videos", { recursive: true });

for (let frame = 0; frame < frames; frame += 1) {
  await writeFrame(frame);
}

await run("ffmpeg", [
  "-y",
  "-framerate",
  String(fps),
  "-i",
  `${frameDir}/frame-%04d.ppm`,
  "-an",
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "22",
  "-g",
  "1",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  output,
]);

await run("ffmpeg", [
  "-y",
  "-ss",
  "3.5",
  "-i",
  output,
  "-frames:v",
  "1",
  "-update",
  "1",
  poster,
]);

await rm(frameDir, { recursive: true, force: true });
