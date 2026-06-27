import type { ImageMatrix } from "./types";

export function clamp(value: number, min = 0, max = 255) {
  return Math.min(max, Math.max(min, value));
}

export function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片无法读取。"));
    image.src = src;
  });
}

export async function loadImageMatrix(src: string, maxSide = 900) {
  const image = await loadImageElement(src);
  const scale = Math.min(
    1,
    maxSide / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器不支持图像预处理。");

  context.drawImage(image, 0, 0, width, height);
  return {
    width,
    height,
    rgba: context.getImageData(0, 0, width, height),
    imageSrc: canvas.toDataURL("image/webp", 0.9),
  };
}

export function toGray(rgba: Uint8ClampedArray): ImageMatrix {
  const data = new Uint8ClampedArray(rgba.length / 4);
  for (let index = 0; index < rgba.length; index += 4) {
    data[index / 4] = Math.round(
      rgba[index] * 0.299 + rgba[index + 1] * 0.587 + rgba[index + 2] * 0.114,
    );
  }
  return { width: 0, height: 0, data };
}

export function grayFromImageData(
  imageData: ImageData,
  width: number,
  height: number,
): ImageMatrix {
  return {
    ...toGray(imageData.data),
    width,
    height,
  };
}

export function renderGrayMatrix(
  matrix: ImageMatrix,
  tint?: (value: number, index: number) => [number, number, number],
) {
  const canvas = document.createElement("canvas");
  canvas.width = matrix.width;
  canvas.height = matrix.height;
  const context = canvas.getContext("2d");
  if (!context) return "";

  const imageData = context.createImageData(matrix.width, matrix.height);
  for (let index = 0; index < matrix.data.length; index += 1) {
    const value = matrix.data[index];
    const [red, green, blue] = tint?.(value, index) ?? [value, value, value];
    imageData.data[index * 4] = red;
    imageData.data[index * 4 + 1] = green;
    imageData.data[index * 4 + 2] = blue;
    imageData.data[index * 4 + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/webp", 0.86);
}

export function canvasFromImageData(imageData: ImageData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器不支持 Canvas。");
  context.putImageData(imageData, 0, 0);
  return canvas;
}

export function imageDataFromMatrix(matrix: ImageMatrix) {
  const imageData = new ImageData(matrix.width, matrix.height);
  for (let index = 0; index < matrix.data.length; index += 1) {
    const value = matrix.data[index];
    imageData.data[index * 4] = value;
    imageData.data[index * 4 + 1] = value;
    imageData.data[index * 4 + 2] = value;
    imageData.data[index * 4 + 3] = 255;
  }
  return imageData;
}

export function drawPolyline(
  context: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  width: number,
  height: number,
  color: string,
  dashed = false,
) {
  if (points.length < 2) return;
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = "rgba(0,0,0,0.55)";
  context.shadowBlur = 4;
  context.setLineDash(dashed ? [9, 7] : []);
  context.beginPath();
  points.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.restore();
}
