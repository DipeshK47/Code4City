/**
 * Certificate generation: overlay volunteer name, flyers, hours, and date
 * on Certificate.png and export as PNG or PDF.
 *
 * Coordinates (design reference ~1754×2480): Name centered Y~580,
 * Flyers ~(540,900), Hours ~(1010,900), Date ~(1500,900).
 */

// Design reference size used for the suggested coordinates (scale to actual image)
const REF_W = 1754;
const REF_H = 2480;

// Coordinates on reference design (X, Y)
const NAME_Y = 850; // centered horizontally (lowered by 95)
const FLYERS_X = 320;  // lowered by 95, left by 145
const HOURS_X = 850;
const DATE_X = 1240;
const STATS_Y = 1380;

export type CertificateData = {
  fullName: string;
  flyersDistributed: number;
  hoursVolunteeredSeconds: number;
  date: Date;
};

function formatHours(totalSeconds: number): string {
  const hours = totalSeconds / 3600;
  if (hours < 0.01) return "0";
  if (hours < 1) return hours.toFixed(2);
  return hours >= 10 ? String(Math.round(hours)) : hours.toFixed(1);
}

function formatCertificateDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load certificate image: ${src}`));
    img.src = src;
  });
}

function scaleX(img: HTMLImageElement, x: number): number {
  return (x / REF_W) * img.naturalWidth;
}

function scaleY(img: HTMLImageElement, y: number): number {
  return (y / REF_H) * img.naturalHeight;
}

/**
 * Draw the certificate template and overlay text; returns the canvas.
 */
async function drawCertificateCanvas(
  imageSrc: string,
  data: CertificateData
): Promise<HTMLCanvasElement> {
  const img = await loadImage(imageSrc);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2d context");

  ctx.drawImage(img, 0, 0);

  const flyersText = String(data.flyersDistributed);
  const hoursText = formatHours(data.hoursVolunteeredSeconds);
  const dateText = formatCertificateDate(data.date);

  // Scale font sizes with image (roughly 1/25 of width for main name)
  const nameFontSize = Math.round(w / 22);
  const statFontSize = Math.round(w / 38);

  ctx.fillStyle = "#1a1a1a";
  ctx.textBaseline = "middle";

  // Volunteer name — centered
  ctx.font = `600 ${nameFontSize}px "Georgia", "Times New Roman", serif`;
  ctx.textAlign = "center";
  ctx.fillText(data.fullName || "Volunteer", w / 2, scaleY(img, NAME_Y));

  // Stats row — left-aligned at each X
  ctx.font = `${statFontSize}px "Georgia", "Times New Roman", serif`;
  ctx.textAlign = "left";
  const sy = scaleY(img, STATS_Y);
  ctx.fillText(flyersText, scaleX(img, FLYERS_X), sy);
  ctx.fillText(hoursText, scaleX(img, HOURS_X), sy);
  ctx.fillText(dateText, scaleX(img, DATE_X), sy);

  return canvas;
}

/**
 * Generate certificate as PNG blob (e.g. for download).
 */
export async function generateCertificatePng(
  data: CertificateData,
  imageSrc: string = "/Certificate.png"
): Promise<Blob> {
  const canvas = await drawCertificateCanvas(imageSrc, data);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to create PNG blob"))),
      "image/png",
      1
    );
  });
}

/**
 * Generate certificate as PDF blob (e.g. for download).
 */
export async function generateCertificatePdf(
  data: CertificateData,
  imageSrc: string = "/Certificate.png"
): Promise<Blob> {
  const canvas = await drawCertificateCanvas(imageSrc, data);
  const dataUrl = canvas.toDataURL("image/png", 1);

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, canvas.width, canvas.height);
  return pdf.output("blob");
}

/**
 * Trigger browser download of a blob with the given filename.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
