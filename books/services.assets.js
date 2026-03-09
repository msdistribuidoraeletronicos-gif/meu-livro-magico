"use strict";

const sharp = require("sharp");
const { path, ensureDir, wrapTextLines, escapeXml, existsSyncSafe } = require("./utils");

function makeBandOverlaySvg({ width, height, title, text }) {
  const W = Math.max(1, Number(width || 1024));
  const H = Math.max(1, Number(height || 1024));

  const bandH = Math.round(H * 0.28);

  const margin = Math.round(Math.max(10, W * 0.02));
  const padX = Math.round(Math.max(12, W * 0.02));
  const padY = Math.round(Math.max(10, H * 0.015));
  const rx = Math.round(Math.max(12, W * 0.02));

  const bandW = W - margin * 2;
  const bandX = margin;
  const bandY = H - margin - bandH;

  const titleSize = Math.round(Math.max(14, W * 0.03));
  const textSize = Math.round(Math.max(12, W * 0.024));
  const lineH = Math.round(textSize * 1.28);

  const textAreaW = bandW - padX * 2;

  const maxLines = 5;
  const maxCharsPerLine = Math.max(
    18,
    Math.floor(textAreaW / (textSize * 0.6))
  );
  const lines = wrapTextLines(text || "", maxCharsPerLine, maxLines);

  const titleY = bandY + padY + titleSize;
  const textStartY = titleY + Math.round(titleSize * 0.75);

  const titleSvg = title
    ? `<text x="${bandX + padX}" y="${titleY}"
        font-family="Arial, sans-serif"
        font-size="${titleSize}"
        font-weight="900"
        fill="rgb(17,24,39)" fill-opacity="0.92">${escapeXml(title)}</text>`
    : "";

  const textSvg = lines.length
    ? `<text x="${bandX + padX}" y="${textStartY + textSize}"
        font-family="Arial, sans-serif"
        font-size="${textSize}"
        font-weight="900"
        fill="rgb(17,24,39)" fill-opacity="0.92">
        ${lines
          .map((ln, i) => {
            const dy = i === 0 ? 0 : lineH;
            return `<tspan x="${bandX + padX}" dy="${dy}">${escapeXml(
              ln
            )}</tspan>`;
          })
          .join("")}
      </text>`
    : "";

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect x="${bandX}" y="${bandY}" width="${bandW}" height="${bandH}"
        rx="${rx}" ry="${rx}"
        fill="#FFFFFF" fill-opacity="0.88" />
  ${titleSvg}
  ${textSvg}
</svg>`;
}

async function burnTextIntoImage({ srcFsPath, dstFsPath, title, text }) {
  const img = sharp(srcFsPath);
  const meta = await img.metadata();

  const width = Math.max(1, meta.width || 1020);
  const height = Math.max(1, meta.height || 797);

  const svg = makeBandOverlaySvg({
    width,
    height,
    title: String(title || ""),
    text: String(text || ""),
  });
  const overlay = Buffer.from(svg, "utf-8");

  await ensureDir(path.dirname(dstFsPath));

  await sharp(srcFsPath)
    .rotate()
    .ensureAlpha()
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toFile(dstFsPath);

  if (!existsSyncSafe(dstFsPath)) {
    throw new Error(
      "burnTextIntoImage: arquivo final não foi criado: " + dstFsPath
    );
  }

  return { width, height };
}

module.exports = {
  makeBandOverlaySvg,
  burnTextIntoImage,
};