import { TerrainType } from '../stats/StatValues';
import worldConfig from '../data/worldConfig.json';

export interface WorldPOI {
  id: string;
  poiType: string;
  name: string;
  description: string;
  x: number;
  y: number;
  radius: number;
  used: boolean;
  cooldown: number;
}

export interface WorldBurrow {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export class WorldMap {
  public readonly tileSize = 64;
  private seed: number;
  private challengeId: number;
  private difficultyLevel: number;
  private terrainCache = new Map<string, TerrainType>();
  public pois: WorldPOI[] = [];
  public burrows: WorldBurrow[] = [];
  private generatedRegions = new Set<string>();
  private poiPityBonus = 0;

  constructor(seed = 1337, difficultyLevel = 1, challengeId = 0) {
    this.seed = seed;
    this.difficultyLevel = difficultyLevel;
    this.challengeId = challengeId;
  }

  private hash2D(ix: number, iy: number, salt: number): number {
    let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(this.seed + salt, 1442695041);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  private smoothNoise(x: number, y: number, scale: number, salt: number): number {
    const sx = x / scale;
    const sy = y / scale;
    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const fx = sx - x0;
    const fy = sy - y0;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);

    const n00 = this.hash2D(x0, y0, salt);
    const n10 = this.hash2D(x0 + 1, y0, salt);
    const n01 = this.hash2D(x0, y0 + 1, salt);
    const n11 = this.hash2D(x0 + 1, y0 + 1, salt);

    const nx0 = n00 * (1 - u) + n10 * u;
    const nx1 = n01 * (1 - u) + n11 * u;
    return nx0 * (1 - v) + nx1 * v;
  }

  /**
   * Exact implementation of Map Generation Config Data.asset _terrainSelectionRules
   */
  public getTileTerrain(tx: number, ty: number): TerrainType {
    const key = `${tx},${ty}`;
    const cached = this.terrainCache.get(key);
    if (cached) return cached;

    // Challenge overrides: DryAge (1) -> Sand, IceAge (2) -> Snow
    if (this.challengeId === 1) {
      this.terrainCache.set(key, 'Sand');
      return 'Sand';
    }
    if (this.challengeId === 2) {
      this.terrainCache.set(key, 'Snow');
      return 'Snow';
    }

    // Starting safe zone (11x20 tiles around origin forced to Grass on D0-D12)
    if (this.difficultyLevel <= 12 && Math.abs(tx) <= 10 && Math.abs(ty) <= 6) {
      this.terrainCache.set(key, 'Grass');
      return 'Grass';
    }

    // Dual octave Perlin-like noise using scales 73 (Heat) and 43 (Humidity)
    const heat =
      0.7 * this.smoothNoise(tx, ty, 18.25, 101) +
      0.3 * this.smoothNoise(tx, ty, 7.3, 202);
    const humidity =
      0.7 * this.smoothNoise(tx, ty, 10.75, 303) +
      0.3 * this.smoothNoise(tx, ty, 5.4, 404);

    let result: TerrainType = 'Grass';
    if (humidity >= 0.95) {
      result = 'Water'; // Rule 1: Force water in the most humid of places
    } else if (heat >= 0.85) {
      result = 'Sand'; // Rule 2: Force sand in the hottest places
    } else if (heat <= 0.30 && humidity <= 0.70) {
      result = 'Snow'; // Rule 3: Force snow in the coldest of places
    } else if (heat >= 0.45 && humidity <= 0.60) {
      result = 'Sand'; // Rule 4: Allow sand in hotter, less humid places
    } else if (heat <= 0.60 && humidity >= 0.51) {
      result = 'Water'; // Rule 5: Allow water in more humid places
    } else {
      result = 'Grass'; // Rule 7: Everywhere else is grass
    }

    this.terrainCache.set(key, result);
    return result;
  }

  public getTerrainAtWorld(wx: number, wy: number): TerrainType {
    const tx = Math.floor(wx / this.tileSize);
    const ty = Math.floor(wy / this.tileSize);
    return this.getTileTerrain(tx, ty);
  }

  /**
   * Computes normalized water depth [0..1] based on distance to shore (0..5 tiles)
   */
  public getWaterDepthAtWorld(wx: number, wy: number): number {
    const tx = Math.floor(wx / this.tileSize);
    const ty = Math.floor(wy / this.tileSize);
    if (this.getTileTerrain(tx, ty) !== 'Water') return 0;

    for (let r = 1; r <= 4; r++) {
      if (
        this.getTileTerrain(tx + r, ty) !== 'Water' ||
        this.getTileTerrain(tx - r, ty) !== 'Water' ||
        this.getTileTerrain(tx, ty + r) !== 'Water' ||
        this.getTileTerrain(tx, ty - r) !== 'Water'
      ) {
        return Math.min(1.0, (r / 5.0) * 1.35);
      }
    }
    return 1.0;
  }

  /**
   * Generates streaming 15x10-cell Regions around the player with Burrows & POIs
   */
  public ensureRegionsAroundPlayer(wx: number, wy: number): void {
    const regionW = 15 * this.tileSize;
    const regionH = 10 * this.tileSize;
    const rxCenter = Math.floor(wx / regionW);
    const ryCenter = Math.floor(wy / regionH);

    for (let ry = ryCenter - 1; ry <= ryCenter + 1; ry++) {
      for (let rx = rxCenter - 1; rx <= rxCenter + 1; rx++) {
        const rKey = `${rx},${ry}`;
        if (this.generatedRegions.has(rKey)) continue;
        this.generatedRegions.add(rKey);

        const baseX = rx * regionW;
        const baseY = ry * regionH;

        // Spawn 1-2 Burrows per region on non-water terrain
        for (let b = 0; b < 2; b++) {
          const bx = baseX + (0.2 + 0.6 * this.hash2D(rx * 7 + b, ry * 11, 555)) * regionW;
          const by = baseY + (0.2 + 0.6 * this.hash2D(rx * 13 + b, ry * 17, 666)) * regionH;
          if (this.getTerrainAtWorld(bx, by) !== 'Water') {
            this.burrows.push({
              id: `burrow_${rx}_${ry}_${b}`,
              x: bx,
              y: by,
              radius: 34
            });
          }
        }

        // POI Spawn Check: 6% base chance + 5% pity per failed region (PointOfInterestMappings.asset)
        const poiRoll = this.hash2D(rx, ry, 777);
        const chance = 0.14 + this.poiPityBonus;
        if (poiRoll <= chance) {
          this.poiPityBonus = 0;
          const px = baseX + 0.5 * regionW;
          const py = baseY + 0.5 * regionH;
          const terrain = this.getTerrainAtWorld(px, py);
          const matchingPois = worldConfig.pois.filter(p => p.biome.includes(terrain));
          const chosen =
            matchingPois[Math.floor(this.hash2D(rx, ry, 888) * matchingPois.length)] ||
            worldConfig.pois[0];
          // Skip HealingPond & Oasis in Wounded challenge (64)
          if (this.challengeId === 64 && (chosen.type === 'HealingPond' || chosen.type === 'Oasis')) {
            continue;
          }
          this.pois.push({
            id: `poi_${rx}_${ry}`,
            poiType: chosen.type,
            name: chosen.name,
            description: chosen.description,
            x: px,
            y: py,
            radius: 48,
            used: false,
            cooldown: 0
          });
        } else {
          this.poiPityBonus += 0.05;
        }
      }
    }
  }
}
