import { DamageCategory, PlayerStatsSet, TerrainType } from '../stats/StatValues';

export interface CreatureTemplate {
  id: number;
  name: string;
  group?: string;
  biome: string;
  tier: string;
  behavior: 'Prey' | 'Neutral' | 'Predator' | 'Scavenger' | 'NeutralGiant' | 'Boss' | 'FinalBoss' | 'Tentacle';
  apexRank: number;
  maxHp: number;
  maxPlating: number;
  baseDamage: number;
  moveSpeed: number;
  chaseSpeed: number;
  size: number;
  xpDrop: number;
  color: string;
  accentColor: string;
}

export type CreatureRank = 'Basic' | 'Alpha' | 'Shiny' | 'Boss';
export type AIState = 'Wander' | 'Forage' | 'Flee' | 'Chase' | 'AttackWindup' | 'FollowPlayer';

export interface CreatureEntity {
  uid: string;
  template: CreatureTemplate;
  rank: CreatureRank;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  plating: number;
  maxPlating: number;
  damage: number;
  moveSpeed: number;
  chaseSpeed: number;
  size: number;
  radius: number;
  apexRank: number;
  xpDrop: number;
  aiState: AIState;
  stateTimer: number;
  attackCooldown: number;
  isCharmed: boolean;
  charmTimer: number;
  poisonTimer: number;
  poisonDps: number;
  bleedTimer: number;
  bleedDps: number;
  stunTimer: number;
  hitFlash: number;
  provoked: boolean; // For Neutral / Crabbybara mood
}

export type FoodKind =
  | 'Common'
  | 'Rare'
  | 'Epic'
  | 'Legendary'
  | 'BossFruit'
  | 'HpFood'
  | 'PlatingShard'
  | 'Mushroom';

export interface FoodItem {
  uid: string;
  kind: FoodKind;
  x: number;
  y: number;
  xpValue: number;
  healValue: number;
  platingValue: number;
  mushroomEffect?: 'SpeedBoost' | 'DamageFrenzy' | 'ThermalShield' | 'MutagenBurst';
  radius: number;
  bobPhase: number;
}

export interface Projectile {
  uid: string;
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  statusEffect: string | null;
  knockback: number;
}

export interface CataclysmMeteor {
  uid: string;
  targetX: number;
  targetY: number;
  progress: number; // 0 -> 1 impact
  fallDuration: number;
  radius: number;
  damage: number;
}

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface AttackVisualArc {
  x: number;
  y: number;
  angle: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface PixelParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export class PlayerEntity {
  public x = 0;
  public y = 0;
  public vx = 0;
  public vy = 0;
  public angle = 0;

  public stats = new PlayerStatsSet();
  public hp = 100;
  public plating = 0;
  public xp = 0;
  public level = 1;
  public xpToNextLevel = 18;
  public mutagen = 0;
  public kills = 0;

  // Disassembled state variables from PlayerCharacter (GameAssembly.dll)
  public missedDodgeRollsInARow = 0;
  public damageTakenForSpawnPlating = 0;
  public lastStandCooldown = 0;

  // Temperature & Soak gauges [0..1] (ACharacterThermometer)
  public heatBuildup = 0;
  public coldBuildup = 0;
  public soakBuildup = 0;
  public tempTickTimer = 0;
  public tempDamageTimer = 0;

  // Dash & Status state
  public dashCooldown = 0;
  public dashActiveTimer = 0;
  public dashDirX = 1;
  public dashDirY = 0;
  public attackLungeTimer = 0;
  public slowTimer = 0;
  public inBurrow = false;
  public hitFlash = 0;

  // Temporary Mushroom Buffs
  public speedBuffTimer = 0;
  public damageBuffTimer = 0;
  public thermalBuffTimer = 0;

  public get radius(): number {
    return 20 * Math.min(1.85, Math.max(0.75, this.stats.Size.value));
  }

  public syncMaxHpAndPlating(healNewMax = false): void {
    const maxHp = this.stats.MaxHp.value;
    if (healNewMax) {
      this.hp = Math.min(maxHp, this.hp + 15);
    } else if (this.hp > maxHp) {
      this.hp = maxHp;
    }
    const maxPlating = this.stats.MaxPlating.value;
    if (this.plating > maxPlating) {
      this.plating = maxPlating;
    }
  }

  /**
   * PlayerCharacter.DidCharacterDodgeIncomingDamage (0x180711ae0)
   * P_dodge = DodgeChance.Value + 0.015 * _numMissedDodgeRollsInARow
   */
  public didDodgeIncomingDamage(category: DamageCategory): boolean {
    if (category === 'Heat' || category === 'Cold' || category === 'Poison') {
      return false; // CannotBeDodged
    }
    const baseDodge = this.stats.DodgeChance.value;
    if (baseDodge <= 0) return false;

    const effectiveChance = Math.min(0.75, baseDodge + 0.015 * this.missedDodgeRollsInARow);
    if (Math.random() <= effectiveChance) {
      this.missedDodgeRollsInARow = 0;
      return true;
    } else {
      this.missedDodgeRollsInARow++;
      return false;
    }
  }

  /**
   * Full Player Combat Damage Pipeline:
   * Dodge -> DamageReductionCurve -> Plating Buffer -> GeneratePlatingIfShould -> Last Stand
   */
  public takeDamage(
    rawAmount: number,
    category: DamageCategory,
    difficultyLevel: number,
    onSpawnPlatingShard: (val: number) => void,
    onFloatingText: (txt: string, col: string) => void
  ): boolean {
    if (this.inBurrow && category === 'Physical') return false;

    // 1. Dodge check (0x180711ae0)
    if (this.didDodgeIncomingDamage(category)) {
      onFloatingText('DODGE!', '#38bdf8');
      return false;
    }

    // 2. Damage Reduction curve (0x180711bc0)
    let dmg = rawAmount;
    if (category === 'Physical' || category === 'Cataclysm') {
      const dr = this.stats.getDamageReductionFraction(difficultyLevel);
      dmg = Math.max(1, rawAmount * (1.0 - dr));
    }

    // 3. Plating Buffer (Physical & Cataclysm hit Plating first; Heat, Cold & Poison pierce Plating)
    const bypassesPlating = category === 'Heat' || category === 'Cold' || category === 'Poison';
    if (!bypassesPlating && this.plating > 0) {
      if (this.plating >= dmg) {
        this.plating -= dmg;
        this.hitFlash = 0.12;
        onFloatingText(`-${Math.round(dmg)} PLATING`, '#4cc9f0');
        return false;
      } else {
        dmg -= this.plating;
        this.plating = 0;
      }
    }

    // 4. Apply HP damage & Check Last Stand (WorldStats.CalculateChanceOfActivatingLastStand)
    const prevHp = this.hp;
    if (this.hp - dmg <= 0 && this.lastStandCooldown <= 0 && prevHp > 2) {
      const normalizedHpLost = prevHp / Math.max(1, this.stats.MaxHp.value);
      const lastStandChance = Math.min(0.65, normalizedHpLost * 0.45 * this.stats.LastStandChanceMultiplier.value);
      if (Math.random() <= lastStandChance) {
        this.hp = 1;
        this.lastStandCooldown = difficultyLevel === 0 ? 15 : 30;
        this.hitFlash = 0.3;
        onFloatingText('LAST STAND! (1 HP)', '#ffbe0b');
        return false;
      }
    }

    this.hp = Math.max(0, this.hp - dmg);
    this.hitFlash = 0.2;
    onFloatingText(`-${Math.round(dmg)}`, category === 'Heat' ? '#fb923c' : category === 'Cold' ? '#7dd3fc' : '#ef476f');

    // 5. PlayerCharacter.GeneratePlatingIfShould (0x180711800)
    const spawnPlatingStat = this.stats.DamageBeforeSpawningPlating.value;
    if (spawnPlatingStat > 0 && this.stats.MaxPlating.value > 0) {
      this.damageTakenForSpawnPlating += dmg;
      const threshold = Math.max(5, this.stats.MaxHp.value * (1.0 - Math.min(0.85, spawnPlatingStat)));
      while (this.damageTakenForSpawnPlating >= threshold) {
        this.damageTakenForSpawnPlating -= threshold;
        const chunk = Math.max(4, this.stats.MaxPlating.value * 0.15);
        onSpawnPlatingShard(chunk);
      }
    }

    return this.hp <= 0;
  }

  public getCurrentSpeed(terrain: TerrainType, waterDepth: number, difficultyLevel: number): number {
    const isUnderwater = this.stats.WaterTerrainAdaptation.value >= 1.0;
    let spd = this.stats.calculateActualMovementSpeed(terrain, waterDepth, isUnderwater, difficultyLevel);
    if (this.speedBuffTimer > 0) spd *= 1.35;
    if (this.dashActiveTimer > 0) spd *= 2.55;
    if (this.attackLungeTimer > 0) spd *= 0.82;
    if (this.slowTimer > 0) spd *= 0.65;
    // Scale world units per second (1 Unity unit ~= 26 pixels)
    return spd * 26;
  }
}
