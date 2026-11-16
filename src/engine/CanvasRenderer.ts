import { ASSET_MANIFEST } from '../data/assetManifest';
import { EcosystemDirector } from '../ai/EcosystemDirector';
import {
  AttackVisualArc,
  CreatureEntity,
  FloatingText,
  FoodItem,
  PixelParticle,
  PlayerEntity
} from '../entities/Entities';
import { EvolutionSystem } from '../evolution/EvolutionSystem';
import { TerrainType } from '../stats/StatValues';
import { WorldMap } from '../world/WorldMap';
import { AssetLoader } from './AssetLoader';

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private assets: AssetLoader;
  private animTime = 0;
  public readonly cameraZoom = 1.28;

  constructor(canvas: HTMLCanvasElement, assets: AssetLoader) {
    this.canvas = canvas;
    this.assets = assets;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not initialize 2D Canvas context');
    this.ctx = context;
  }

  private tileHash(tx: number, ty: number): number {
    let n = Math.imul(tx, 374761393) + Math.imul(ty, 668265263);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  private drawSpriteCentered(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    targetSize: number,
    flipX = false
  ): void {
    const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
    let drawW = targetSize;
    let drawH = targetSize;
    if (aspect >= 1) {
      drawH = targetSize / aspect;
    } else {
      drawW = targetSize * aspect;
    }
    ctx.save();
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(img, Math.round(-drawW / 2), Math.round(-drawH / 2), Math.round(drawW), Math.round(drawH));
    ctx.restore();
  }

  private drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(18, 24, 22, 0.34)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  public render(
    dt: number,
    player: PlayerEntity,
    map: WorldMap,
    director: EcosystemDirector,
    evoSystem: EvolutionSystem,
    dayNightBlend: number,
    activeWeather: 'None' | 'Rain' | 'Heatwave' | 'Snowstorm',
    attackArcs: AttackVisualArc[],
    floatingTexts: FloatingText[],
    particles: PixelParticle[]
  ): void {
    this.animTime += dt;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const z = this.cameraZoom;

    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.save();

    const viewW = w / z;
    const viewH = h / z;
    const camX = player.x - viewW / 2;
    const camY = player.y - viewH / 2;
    ctx.scale(z, z);
    ctx.translate(-camX, -camY);

    // 1. Biome Terrain Tiles + Shoreline Foam
    this.renderBiomeTiles(ctx, map, camX, camY, viewW, viewH);

    // 2. Decorative Environmental Props (Trees, Cacti, Pines, Bushes, Rocks)
    this.renderEnvironmentProps(ctx, map, camX, camY, viewW, viewH);

    // 3. Burrows & POIs
    this.renderBurrowsAndPois(ctx, map, camX, camY, viewW, viewH);

    // 4. Active Boss Bramble Arena
    if (director.activeBoss) {
      const enc = director.activeBoss;
      const isCrabbyBramble = evoSystem.activeCarcinisationEffects.includes('CrabbyBramble');
      ctx.save();
      ctx.beginPath();
      ctx.arc(enc.arenaX, enc.arenaY, enc.arenaRadius, 0, Math.PI * 2);
      ctx.lineWidth = 10;
      ctx.strokeStyle = isCrabbyBramble ? '#e11d48' : '#3f6212';
      ctx.stroke();

      const numThorns = 36;
      for (let i = 0; i < numThorns; i++) {
        const a = (i / numThorns) * Math.PI * 2 + this.animTime * 0.15;
        const tx = enc.arenaX + Math.cos(a) * enc.arenaRadius;
        const ty = enc.arenaY + Math.sin(a) * enc.arenaRadius;
        ctx.fillStyle = isCrabbyBramble ? '#fb7185' : '#65a30d';
        ctx.fillRect(Math.round(tx - 5), Math.round(ty - 5), 10, 10);
      }
      ctx.restore();
    }

    // 5. Food, HP Food, Plating Shards, Mushrooms, Boss Fruit
    for (const f of director.foods) {
      if (f.x < camX - 60 || f.x > camX + viewW + 60 || f.y < camY - 60 || f.y > camY + viewH + 60) continue;
      this.renderFoodItem(ctx, f);
    }

    // 6. Pixel Particles
    for (const pt of particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.round(pt.x - pt.size / 2), Math.round(pt.y - pt.size / 2), pt.size, pt.size);
      ctx.restore();
    }

    // 7. Attack Visual Arcs
    for (const arc of attackArcs) {
      const alpha = Math.max(0, arc.life / arc.maxLife);
      ctx.save();
      ctx.translate(arc.x, arc.y);
      ctx.rotate(arc.angle);
      ctx.strokeStyle = arc.color;
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, arc.radius, -0.78, 0.78);
      ctx.stroke();
      ctx.restore();
    }

    // 8. Projectiles
    for (const p of director.projectiles) {
      ctx.save();
      ctx.fillStyle = '#2f2623';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. Ecosystem Creatures & Bosses
    for (const c of director.creatures) {
      if (c.x < camX - 160 || c.x > camX + viewW + 160 || c.y < camY - 160 || c.y > camY + viewH + 160) continue;
      this.renderCreature(ctx, c, player);
    }

    // 10. Player Darwin + Modular Evolved Limbs + Floating HP Bar
    this.renderPlayerDarwin(ctx, player, evoSystem);

    // 11. Cataclysm Meteor Shadows & Fireballs
    for (const m of director.meteors) {
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.9)';
      ctx.fillStyle = `rgba(244, 63, 94, ${0.15 + m.progress * 0.35})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(m.targetX, m.targetY, m.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const dropOffset = (1 - m.progress) * 320;
      const mx = m.targetX + dropOffset * 0.55;
      const my = m.targetY - dropOffset;
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.arc(mx, my, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 12. Floating Texts (crisp pixel outline)
    for (const ft of floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.font = '14px "CrabPixel", monospace';
      ctx.textAlign = 'center';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#2f2623';
      ctx.fillText(ft.text, Math.round(ft.x) + 1, Math.round(ft.y) + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, Math.round(ft.x), Math.round(ft.y));
      ctx.restore();
    }

    ctx.restore();

    // 13. Screen-Space Weather & Day/Night Senses Vignette Overlay
    this.renderWeatherAndNightOverlay(ctx, w, h, player, dayNightBlend, activeWeather);
  }

  private renderBiomeTiles(
    ctx: CanvasRenderingContext2D,
    map: WorldMap,
    camX: number,
    camY: number,
    w: number,
    h: number
  ): void {
    const ts = map.tileSize;
    const startTx = Math.floor(camX / ts) - 1;
    const endTx = Math.ceil((camX + w) / ts) + 1;
    const startTy = Math.floor(camY / ts) - 1;
    const endTy = Math.ceil((camY + h) / ts) + 1;

    const fallbackPalette: Record<TerrainType, [string, string]> = {
      Grass: ['#52a84a', '#4c9e44'],
      Sand: ['#e4c666', '#dcbe5e'],
      Water: ['#2698cc', '#218dbd'],
      Snow: ['#ebf5fc', '#e2eff8']
    };

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const terrain = map.getTileTerrain(tx, ty);
        const wx = tx * ts;
        const wy = ty * ts;
        const tileImg = this.assets.getImage(ASSET_MANIFEST.terrains[terrain]);
        if (tileImg) {
          ctx.drawImage(tileImg, wx, wy, ts + 1, ts + 1);
        } else {
          const checker = (tx + ty) & 1;
          ctx.fillStyle = fallbackPalette[terrain][checker];
          ctx.fillRect(wx, wy, ts + 1, ts + 1);
        }

        // Animated water shimmer & shoreline foam
        if (terrain === 'Water') {
          const wave = Math.sin(this.animTime * 2.5 + tx * 0.7 + ty * 0.5);
          if (wave > 0.35) {
            ctx.fillStyle = 'rgba(186, 230, 253, 0.25)';
            ctx.fillRect(wx + 14, wy + 22, 16, 4);
          }
          if (map.getTileTerrain(tx, ty - 1) !== 'Water') {
            ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
            ctx.fillRect(wx, wy, ts, 4);
          }
          if (map.getTileTerrain(tx - 1, ty) !== 'Water') {
            ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
            ctx.fillRect(wx, wy, 4, ts);
          }
        }
      }
    }
  }

  private renderEnvironmentProps(
    ctx: CanvasRenderingContext2D,
    map: WorldMap,
    camX: number,
    camY: number,
    w: number,
    h: number
  ): void {
    const ts = map.tileSize;
    const startTx = Math.floor(camX / ts) - 1;
    const endTx = Math.ceil((camX + w) / ts) + 1;
    const startTy = Math.floor(camY / ts) - 1;
    const endTy = Math.ceil((camY + h) / ts) + 1;

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        // Keep origin spawn clear
        if (Math.abs(tx) <= 1 && Math.abs(ty) <= 1) continue;
        const hVal = this.tileHash(tx, ty);
        if (hVal < 0.84) continue;

        const terrain = map.getTileTerrain(tx, ty);
        const cx = tx * ts + 16 + Math.floor(this.tileHash(tx + 17, ty - 9) * 32);
        const cy = ty * ts + 16 + Math.floor(this.tileHash(tx - 13, ty + 23) * 32);

        if (terrain === 'Grass') {
          if (hVal > 0.94) {
            // Pixel-art leafy tree
            this.drawShadow(ctx, cx, cy + 12, 14, 6);
            ctx.fillStyle = '#2f2623';
            ctx.fillRect(cx - 5, cy - 2, 10, 14);
            ctx.fillStyle = '#7c4a2d';
            ctx.fillRect(cx - 3, cy, 6, 10);
            ctx.fillStyle = '#2f2623';
            ctx.beginPath();
            ctx.arc(cx, cy - 10, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2e7d32';
            ctx.beginPath();
            ctx.arc(cx, cy - 10, 13, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4caf50';
            ctx.beginPath();
            ctx.arc(cx - 3, cy - 13, 8, 0, Math.PI * 2);
            ctx.fill();
          } else if (hVal > 0.89) {
            // Berry bush
            this.drawShadow(ctx, cx, cy + 5, 10, 4);
            ctx.fillStyle = '#2f2623';
            ctx.fillRect(cx - 9, cy - 6, 18, 12);
            ctx.fillStyle = '#2e7d32';
            ctx.fillRect(cx - 7, cy - 4, 14, 8);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(cx - 4, cy - 2, 3, 3);
            ctx.fillRect(cx + 2, cy, 3, 3);
          } else {
            // Tiny wildflower / pebble
            ctx.fillStyle = hVal > 0.865 ? '#fde047' : '#f472b6';
            ctx.fillRect(cx, cy, 3, 3);
            ctx.fillStyle = '#fff';
            ctx.fillRect(cx + 1, cy + 1, 1, 1);
          }
        } else if (terrain === 'Sand') {
          if (hVal > 0.94) {
            // Desert Cactus
            this.drawShadow(ctx, cx, cy + 10, 10, 5);
            ctx.fillStyle = '#2f2623';
            ctx.fillRect(cx - 5, cy - 16, 10, 26);
            ctx.fillRect(cx - 11, cy - 10, 6, 8);
            ctx.fillRect(cx + 5, cy - 12, 6, 8);
            ctx.fillStyle = '#4d7c0f';
            ctx.fillRect(cx - 3, cy - 14, 6, 22);
            ctx.fillRect(cx - 9, cy - 8, 6, 4);
            ctx.fillRect(cx + 3, cy - 10, 6, 4);
          } else if (hVal > 0.89) {
            // Sandstone rock
            this.drawShadow(ctx, cx, cy + 4, 9, 4);
            ctx.fillStyle = '#2f2623';
            ctx.fillRect(cx - 8, cy - 4, 16, 9);
            ctx.fillStyle = '#b45309';
            ctx.fillRect(cx - 6, cy - 2, 12, 5);
          }
        } else if (terrain === 'Snow') {
          if (hVal > 0.94) {
            // Snow-capped Pine Tree
            this.drawShadow(ctx, cx, cy + 10, 12, 5);
            ctx.fillStyle = '#2f2623';
            ctx.fillRect(cx - 4, cy + 2, 8, 9);
            ctx.fillStyle = '#5c4033';
            ctx.fillRect(cx - 2, cy + 3, 4, 7);
            ctx.fillStyle = '#1e4620';
            ctx.beginPath();
            ctx.moveTo(cx, cy - 22);
            ctx.lineTo(cx - 14, cy + 4);
            ctx.lineTo(cx + 14, cy + 4);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#f1f5f9';
            ctx.beginPath();
            ctx.moveTo(cx, cy - 22);
            ctx.lineTo(cx - 7, cy - 9);
            ctx.lineTo(cx + 7, cy - 9);
            ctx.closePath();
            ctx.fill();
          } else if (hVal > 0.89) {
            // Ice crystal
            ctx.fillStyle = '#7dd3fc';
            ctx.fillRect(cx - 3, cy - 5, 6, 8);
            ctx.fillStyle = '#e0f2fe';
            ctx.fillRect(cx - 1, cy - 4, 2, 5);
          }
        } else if (terrain === 'Water' && hVal > 0.92) {
          // Lilypad
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(cx, cy, 7, 0.3, Math.PI * 2 - 0.3);
          ctx.lineTo(cx, cy);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  private renderBurrowsAndPois(
    ctx: CanvasRenderingContext2D,
    map: WorldMap,
    camX: number,
    camY: number,
    w: number,
    h: number
  ): void {
    const burrowImg = this.assets.getImage(ASSET_MANIFEST.items.Burrow);
    for (const b of map.burrows) {
      if (b.x < camX - 80 || b.x > camX + w + 80 || b.y < camY - 80 || b.y > camY + h + 80) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      if (burrowImg) {
        this.drawSpriteCentered(ctx, burrowImg, b.radius * 1.9);
      } else {
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = '11px "CrabPixel", monospace';
      ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'center';
      ctx.fillText('BURROW [E]', 0, b.radius + 8);
      ctx.restore();
    }

    for (const p of map.pois) {
      if (p.x < camX - 110 || p.x > camX + w + 110 || p.y < camY - 110 || p.y > camY + h + 110) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      const pulse = 1 + Math.sin(this.animTime * 3) * 0.05;
      ctx.fillStyle = p.used ? 'rgba(100, 116, 139, 0.2)' : 'rgba(16, 185, 129, 0.2)';
      ctx.strokeStyle = p.used ? '#64748b' : '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const poiImg = this.assets.getImage(ASSET_MANIFEST.pois[p.poiType]);
      if (poiImg) {
        if (p.used) ctx.globalAlpha = 0.55;
        this.drawSpriteCentered(ctx, poiImg, p.radius * 1.7);
      }

      ctx.globalAlpha = 1;
      ctx.font = '11px "CrabPixel", monospace';
      ctx.fillStyle = '#ecfdf5';
      ctx.textAlign = 'center';
      ctx.fillText(p.used ? `${p.name} (Used)` : `${p.name} [E]`, 0, -p.radius - 6);
      ctx.restore();
    }
  }

  private renderFoodItem(ctx: CanvasRenderingContext2D, f: FoodItem): void {
    ctx.save();
    this.drawShadow(ctx, f.x, f.y + f.radius * 0.65, f.radius * 0.85, f.radius * 0.4);
    const bob = Math.sin(f.bobPhase) * 2.2;
    ctx.translate(f.x, f.y + bob);

    const img = this.assets.getImage(ASSET_MANIFEST.items[f.kind]);
    if (img) {
      const size = f.kind === 'BossFruit' ? f.radius * 2.4 : f.radius * 2.2;
      if (f.kind === 'Legendary' || f.kind === 'BossFruit') {
        ctx.strokeStyle = f.kind === 'BossFruit' ? 'rgba(244, 63, 94, 0.65)' : 'rgba(251, 191, 36, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, f.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      this.drawSpriteCentered(ctx, img, size);
    } else {
      ctx.fillStyle = '#a3e635';
      ctx.beginPath();
      ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderCreature(ctx: CanvasRenderingContext2D, c: CreatureEntity, player: PlayerEntity): void {
    ctx.save();
    this.drawShadow(ctx, c.x, c.y + c.radius * 0.72, c.radius * 0.9, c.radius * 0.42);
    ctx.translate(c.x, c.y);

    // Alpha / Shiny / Charmed Aura
    if (c.rank === 'Alpha') {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, c.radius + 5 + Math.sin(this.animTime * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (c.rank === 'Shiny') {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, c.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (c.isCharmed) {
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, c.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    const faceLeft = Math.cos(c.angle) < 0;
    const walkBob = Math.sin(this.animTime * 8 + c.x * 0.04) * 1.8;
    ctx.translate(0, walkBob);

    const spriteImg = this.assets.getImage(ASSET_MANIFEST.creatures[c.template.id]);
    if (spriteImg) {
      if (c.hitFlash > 0) {
        ctx.filter = 'brightness(2.4) saturate(0.2)';
      }
      // Special case: creature_80 (Crabbybara) is a 16x7 64x64 spritesheet!
      if (c.template.id === 80 && spriteImg.naturalWidth === 1024) {
        const frame = Math.floor(this.animTime * 8) % 8;
        const row = c.aiState === 'Chase' ? 1 : 0;
        const size = c.radius * 3.1;
        ctx.save();
        if (faceLeft) ctx.scale(-1, 1);
        ctx.drawImage(spriteImg, frame * 64, row * 64, 64, 64, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else {
        const targetSize = c.rank === 'Boss' ? c.radius * 2.8 : c.radius * 2.5;
        this.drawSpriteCentered(ctx, spriteImg, targetSize, faceLeft);
      }
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = c.hitFlash > 0 ? '#ffffff' : c.template.color;
      ctx.beginPath();
      ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Unrotated Pixel HP & Plating bar + Threat badge
    const barW = Math.max(34, Math.round(c.radius * 1.9));
    const barY = Math.round(c.y - c.radius - 14);
    const barX = Math.round(c.x - barW / 2);
    ctx.fillStyle = '#2f2623';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, 7);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(barX, barY, barW, 5);
    ctx.fillStyle = c.isCharmed ? '#f472b6' : c.rank === 'Boss' ? '#f43f5e' : '#ef4444';
    ctx.fillRect(barX, barY, Math.round(barW * Math.max(0, c.hp / c.maxHp)), 5);

    if (c.plating > 0 && c.maxPlating > 0) {
      ctx.fillStyle = '#2f2623';
      ctx.fillRect(barX - 1, barY - 5, barW + 2, 4);
      ctx.fillStyle = '#4cc9f0';
      ctx.fillRect(barX, barY - 4, Math.round(barW * Math.max(0, c.plating / c.maxPlating)), 2);
    }

    if (c.rank === 'Boss' || c.rank === 'Alpha' || c.rank === 'Shiny') {
      ctx.font = '11px "CrabPixel", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = c.rank === 'Boss' ? '#fda4af' : c.rank === 'Shiny' ? '#fde047' : '#fca5a5';
      const prefix = c.rank === 'Alpha' ? 'ALPHA ' : c.rank === 'Shiny' ? 'SHINY ' : '';
      ctx.fillText(`${prefix}${c.template.name}`, Math.round(c.x), barY - 7);
    } else if (c.template.behavior === 'Predator') {
      const isHigher = c.apexRank > player.stats.ApexPredator.value + 2.2;
      ctx.font = '10px "CrabPixel", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = isHigher ? '#86efac' : '#fb7185';
      ctx.fillText(isHigher ? 'SCARED' : `APEX ${c.apexRank.toFixed(1)}`, Math.round(c.x), barY - 5);
    }
  }

  /**
   * Renders Darwin (the squishy blue blob) + modular EBodyPart evolution attachments + floating HP bar
   */
  private renderPlayerDarwin(ctx: CanvasRenderingContext2D, player: PlayerEntity, evoSystem: EvolutionSystem): void {
    const r = player.radius;
    this.drawShadow(ctx, player.x, player.y + r * 0.72, r * 0.95, r * 0.45);

    ctx.save();
    const lungeOffset = player.attackLungeTimer > 0 ? 5 : 0;
    const lx = Math.cos(player.angle) * lungeOffset;
    const ly = Math.sin(player.angle) * lungeOffset;
    ctx.translate(player.x + lx, player.y + ly);

    if (player.inBurrow) {
      ctx.globalAlpha = 0.42;
    }

    // Squash & stretch bounce
    const squash = 1 + Math.sin(this.animTime * 10) * 0.06;
    ctx.scale(squash, 2 - squash);

    // Carcinisation aura at thresholds 4, 7, 10
    if (evoSystem.carcinisationLevel >= 4) {
      ctx.save();
      ctx.strokeStyle = evoSystem.carcinisationLevel >= 10 ? '#f43f5e' : '#fb923c';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.45 + Math.sin(this.animTime * 4) * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (player.hitFlash > 0) {
      ctx.filter = 'brightness(2.3)';
    }

    const faceLeft = Math.cos(player.angle) < 0;

    // 1. LowerBody / Passive Shell behind Darwin
    for (const evoId of evoSystem.ownedEvolutions.keys()) {
      const def = evoSystem.allEvolutions.find(e => e.id === evoId);
      if (!def || (def.bodyPart !== 'LowerBody' && def.bodyPart !== 'Passive')) continue;
      const partImg = this.assets.getImage(ASSET_MANIFEST.evolutionParts[evoId]);
      if (!partImg) continue;
      ctx.save();
      if (def.bodyPart === 'LowerBody') {
        ctx.translate(0, r * 0.45);
        this.drawSpriteCentered(ctx, partImg, r * 2.0, faceLeft);
      } else {
        this.drawSpriteCentered(ctx, partImg, r * 1.9, faceLeft);
      }
      ctx.restore();
    }

    // 2. Darwin Base Blue Blob Body
    const bodyImg = this.assets.getImage(ASSET_MANIFEST.player.body);
    if (bodyImg) {
      this.drawSpriteCentered(ctx, bodyImg, r * 2.4, faceLeft);
    } else {
      ctx.fillStyle = '#07acdc';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Base Arms / Nubs (only if no Arms evolution yet)
    const hasArmEvo = Array.from(evoSystem.ownedEvolutions.keys()).some(id => {
      const d = evoSystem.allEvolutions.find(e => e.id === id);
      return d?.bodyPart === 'Arms';
    });
    if (!hasArmEvo) {
      const armsImg = this.assets.getImage(ASSET_MANIFEST.player.arms);
      if (armsImg) {
        ctx.save();
        ctx.rotate(player.angle + Math.PI / 2);
        this.drawSpriteCentered(ctx, armsImg, r * 2.1);
        ctx.restore();
      }
    }

    // 4. Modular Head, Arms, RangedAttack Attachments
    for (const evoId of evoSystem.ownedEvolutions.keys()) {
      const def = evoSystem.allEvolutions.find(e => e.id === evoId);
      if (!def || def.bodyPart === 'LowerBody' || def.bodyPart === 'Passive') continue;
      const partImg = this.assets.getImage(ASSET_MANIFEST.evolutionParts[evoId]);
      if (!partImg) continue;

      ctx.save();
      ctx.rotate(player.angle + Math.PI / 2);
      if (def.bodyPart === 'Head') {
        ctx.translate(0, -r * 0.62);
        this.drawSpriteCentered(ctx, partImg, r * 1.35);
      } else if (def.bodyPart === 'Arms') {
        ctx.translate(0, -r * 0.25);
        this.drawSpriteCentered(ctx, partImg, r * 2.2);
      } else if (def.bodyPart === 'RangedAttack') {
        ctx.translate(r * 0.4, -r * 0.3);
        this.drawSpriteCentered(ctx, partImg, r * 1.5);
      }
      ctx.restore();
    }

    ctx.filter = 'none';
    ctx.restore();

    // Floating Darwin HP + Plating Bar (authentic to Everything is Crab)
    const barW = 42;
    const barX = Math.round(player.x - barW / 2);
    const barY = Math.round(player.y + r + 10);
    const maxHp = Math.max(1, player.stats.MaxHp.value);
    const hpRatio = Math.max(0, Math.min(1, player.hp / maxHp));

    ctx.fillStyle = '#2f2623';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, 7);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(barX, barY, barW, 5);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(barX, barY, Math.round(barW * hpRatio), 5);

    if (player.plating > 0 && player.stats.MaxPlating.value > 0) {
      const plRatio = Math.max(0, Math.min(1, player.plating / player.stats.MaxPlating.value));
      ctx.fillStyle = '#2f2623';
      ctx.fillRect(barX - 1, barY + 6, barW + 2, 4);
      ctx.fillStyle = '#4cc9f0';
      ctx.fillRect(barX, barY + 7, Math.round(barW * plRatio), 2);
    }
  }

  public renderMinimap(
    mmCanvas: HTMLCanvasElement,
    player: PlayerEntity,
    map: WorldMap,
    director: EcosystemDirector
  ): void {
    const mctx = mmCanvas.getContext('2d');
    if (!mctx) return;
    const mw = mmCanvas.width;
    const mh = mmCanvas.height;
    mctx.imageSmoothingEnabled = false;
    mctx.clearRect(0, 0, mw, mh);

    const tilesRadius = 18;
    const ptx = Math.floor(player.x / map.tileSize);
    const pty = Math.floor(player.y / map.tileSize);
    const cellW = mw / (tilesRadius * 2);
    const cellH = mh / (tilesRadius * 2);

    const biomeColors: Record<TerrainType, string> = {
      Grass: '#52a84a',
      Sand: '#e4c666',
      Water: '#2698cc',
      Snow: '#e2eff8'
    };

    for (let dy = -tilesRadius; dy < tilesRadius; dy++) {
      for (let dx = -tilesRadius; dx < tilesRadius; dx++) {
        const t = map.getTileTerrain(ptx + dx, pty + dy);
        mctx.fillStyle = biomeColors[t];
        mctx.fillRect(
          Math.floor((dx + tilesRadius) * cellW),
          Math.floor((dy + tilesRadius) * cellH),
          Math.ceil(cellW),
          Math.ceil(cellH)
        );
      }
    }

    const toMm = (wx: number, wy: number) => ({
      x: mw / 2 + ((wx - player.x) / map.tileSize) * cellW,
      y: mh / 2 + ((wy - player.y) / map.tileSize) * cellH
    });

    // Burrows
    mctx.fillStyle = '#7c4a2d';
    for (const b of map.burrows) {
      const p = toMm(b.x, b.y);
      if (p.x >= 0 && p.x <= mw && p.y >= 0 && p.y <= mh) {
        mctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 1), 3, 3);
      }
    }

    // POIs
    for (const poi of map.pois) {
      const p = toMm(poi.x, poi.y);
      if (p.x >= 0 && p.x <= mw && p.y >= 0 && p.y <= mh) {
        mctx.fillStyle = poi.used ? '#64748b' : '#10b981';
        mctx.fillRect(Math.round(p.x - 2), Math.round(p.y - 2), 5, 5);
      }
    }

    // Bosses
    if (director.activeBoss) {
      mctx.fillStyle = '#f43f5e';
      for (const b of director.activeBoss.bosses) {
        const p = toMm(b.x, b.y);
        mctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 3), 6, 6);
      }
    }

    // Darwin center dot
    mctx.fillStyle = '#07acdc';
    mctx.fillRect(Math.round(mw / 2 - 3), Math.round(mh / 2 - 3), 6, 6);
    mctx.strokeStyle = '#ffffff';
    mctx.lineWidth = 1;
    mctx.strokeRect(Math.round(mw / 2 - 3), Math.round(mh / 2 - 3), 6, 6);
  }

  private renderWeatherAndNightOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    player: PlayerEntity,
    dayNightBlend: number,
    activeWeather: 'None' | 'Rain' | 'Heatwave' | 'Snowstorm'
  ): void {
    if (dayNightBlend > 0.02) {
      const sensesFactor = Math.min(2.2, Math.max(0.5, player.stats.Senses.value));
      const innerR = 170 * sensesFactor;
      const outerR = 460 * sensesFactor;
      const grad = ctx.createRadialGradient(w / 2, h / 2, innerR, w / 2, h / 2, outerR);
      grad.addColorStop(0, 'rgba(7, 11, 28, 0)');
      grad.addColorStop(1, `rgba(5, 9, 24, ${0.74 * dayNightBlend})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    if (activeWeather === 'Rain') {
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 45; i++) {
        const rx = (i * 97 + this.animTime * 420) % w;
        const ry = (i * 173 + this.animTime * 780) % h;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 8, ry + 18);
      }
      ctx.stroke();
    } else if (activeWeather === 'Heatwave') {
      ctx.fillStyle = `rgba(251, 146, 60, ${0.09 + Math.sin(this.animTime * 3) * 0.03})`;
      ctx.fillRect(0, 0, w, h);
    } else if (activeWeather === 'Snowstorm') {
      ctx.fillStyle = 'rgba(241, 245, 249, 0.55)';
      for (let i = 0; i < 50; i++) {
        const sx = (i * 131 + this.animTime * 260) % w;
        const sy = (i * 197 + this.animTime * 190) % h;
        ctx.fillRect(Math.round(sx), Math.round(sy), 4, 4);
      }
    }
  }
}
