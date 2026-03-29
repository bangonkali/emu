import type { MapRegion } from '../types/catalog';

const PAD = 20;
const GLOBAL_WIDTH = 436 + PAD * 2;
const GLOBAL_HEIGHT = 444 + PAD * 2;

function colorForRegion(regionName: string, regionId: number): string {
  const palette = ['#244c73', '#2c6e49', '#735d2f', '#704264', '#4a5f7a', '#5d7343'];
  const index = Math.abs(regionId) % palette.length;
  if (/city/i.test(regionName)) return '#507ad9';
  if (/town/i.test(regionName)) return '#5aaf67';
  if (/route/i.test(regionName)) return '#9c8b52';
  return palette[index];
}

export function drawWorldMap(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  mapData: Record<number, MapRegion>,
  activeMapId: number | null | undefined,
  playerX: number | null | undefined,
  playerY: number | null | undefined,
): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#09101b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scaleX = canvas.width / GLOBAL_WIDTH;
  const scaleY = canvas.height / GLOBAL_HEIGHT;

  for (const [idStr, region] of Object.entries(mapData)) {
    const regionId = Number(idStr);
    if (regionId < 0 || regionId > 36) continue;

    const [regionX, regionY] = region.coordinates;
    const [width, height] = region.tileSize;
    const x = (regionX + PAD) * scaleX;
    const y = (regionY + PAD) * scaleY;
    const w = width * scaleX;
    const h = height * scaleY;

    ctx.fillStyle = colorForRegion(region.name, regionId);
    ctx.fillRect(x, y, w, h);
    const isActive = regionId === Number(activeMapId);
    ctx.strokeStyle = isActive ? '#f7ecaf' : 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.strokeRect(x, y, w, h);
  }

  const region = activeMapId != null ? mapData[activeMapId] : null;
  if (!region) return;

  const [offsetX, offsetY] = region.coordinates;
  const globalX = (offsetX + Number(playerX ?? 0) + PAD) * scaleX;
  const globalY = (offsetY + Number(playerY ?? 0) + PAD) * scaleY;

  ctx.fillStyle = '#ff5f5f';
  ctx.beginPath();
  ctx.arc(globalX, globalY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
}
