export type TerrainType = 'Grass' | 'Sand' | 'Water' | 'Snow';
export type AttackDamageType = 'Base' | 'MaxHp' | 'Speed' | 'Plating' | 'Ranged';
export type DamageCategory = 'Physical' | 'Poison' | 'Heat' | 'Cold' | 'Cataclysm';

/**
 * Exact replica of World.Stats.HybridStatValue (GameAssembly.dll @ 0x1817ca000):
 * Value = max((BaseValue + FlatAdjustment) * (1.0 + PercentageAdjustment), 0.0)
 */
export class HybridStatValue {
  public baseValue: number;
  public flatAdjustment = 0;
  public percentageAdjustment = 0;
  public value = 0;

  constructor(baseValue: number) {
    this.baseValue = baseValue;
    this.updateValue();
  }

  public updateValue(): number {
    const raw = (this.baseValue + this.flatAdjustment) * (1.0 + this.percentageAdjustment);
    this.value = Math.max(raw, 0.0);
    return this.value;
  }

  public addFlat(amount: number): void {
    this.flatAdjustment += amount;
    this.updateValue();
  }

  public addPercentage(pct: number): void {
    this.percentageAdjustment += pct;
    this.updateValue();
  }

  /** GameAssembly.dll @ 0x1817c9f00 */
  public getHypotheticalPercentageValue(pct: number): number {
    return (this.baseValue + this.flatAdjustment) * pct;
  }

  /** GameAssembly.dll @ 0x1817c9f20 */
  public previewIncreaseByPercentage(pct: number): number {
    return Math.max((this.baseValue + this.flatAdjustment) * (1.0 + this.percentageAdjustment + pct), 0.0);
  }
}

/**
 * Exact replica of World.Stats.FlatStatValue (GameAssembly.dll @ 0x1817c98f0):
 * Value = BaseValue + FlatAdjustment (unclamped)
 */
export class FlatStatValue {
  public baseValue: number;
  public flatAdjustment = 0;
  public value = 0;

  constructor(baseValue: number) {
    this.baseValue = baseValue;
    this.updateValue();
  }

  public updateValue(): number {
    this.value = this.baseValue + this.flatAdjustment;
    return this.value;
  }

  public addFlat(amount: number): void {
    this.flatAdjustment += amount;
    this.updateValue();
  }
}

/**
 * Exact replica of World.Stats.PercentageStatValue (GameAssembly.dll @ 0x1817caa00):
 * Value = BaseValue * max(1.0 + PercentageAdjustment, 0.0)
 */
export class PercentageStatValue {
  public baseValue: number;
  public percentageAdjustment = 0;
  public value = 0;

  constructor(baseValue: number) {
    this.baseValue = baseValue;
    this.updateValue();
  }

  public updateValue(): number {
    this.value = this.baseValue * Math.max(1.0 + this.percentageAdjustment, 0.0);
    return this.value;
  }

  public addPercentage(pct: number): void {
    this.percentageAdjustment += pct;
    this.updateValue();
  }
}

/**
 * Exact replica of World.Stats.SummedPercentageStatValue (GameAssembly.dll @ 0x1817cae30):
 * Value = max(BaseValue + PercentageAdjustment, 0.0)
 */
export class SummedPercentageStatValue {
  public baseValue: number;
  public percentageAdjustment = 0;
  public value = 0;

  constructor(baseValue: number) {
    this.baseValue = baseValue;
    this.updateValue();
  }

  public updateValue(): number {
    this.value = Math.max(this.baseValue + this.percentageAdjustment, 0.0);
    return this.value;
  }

  public addPercentage(pct: number): void {
    this.percentageAdjustment += pct;
    this.updateValue();
  }
}

/**
 * Exact replica of World.Stats.MultiplicationStatValue (GameAssembly.dll @ 0x1817ca140):
 * Value = BaseValue * prod(multipliers)
 */
export class MultiplicationStatValue {
  public baseValue: number;
  public multiplier = 1.0;
  public value = 0;
  private multipliers: number[] = [];

  constructor(baseValue: number) {
    this.baseValue = baseValue;
    this.recompute();
  }

  private recompute(): void {
    let acc = 1.0;
    for (const m of this.multipliers) {
      acc *= m;
    }
    this.multiplier = acc;
    this.value = this.baseValue * acc;
  }

  public addMultiplier(m: number): void {
    this.multipliers.push(m);
    this.recompute();
  }

  public removeMultiplier(m: number): void {
    const idx = this.multipliers.indexOf(m);
    if (idx !== -1) {
      this.multipliers.splice(idx, 1);
      this.recompute();
    }
  }
}

/**
 * Complete Player Stat Container with exact curves from WorldStats.asset & GameAssembly.dll
 */
export class PlayerStatsSet {
  public MaxHp = new HybridStatValue(100);
  public MaxPlating = new HybridStatValue(0);
  public BasePhysicalDamage = new HybridStatValue(10);
  public RangedDamageMultiplier = new PercentageStatValue(1.0);
  public MovementSpeed = new HybridStatValue(5.0);
  public SpeedMultiplier = new MultiplicationStatValue(1.0);
  public DamageReduction = new FlatStatValue(0);
  public DodgeChance = new SummedPercentageStatValue(0);
  public DamageBeforeSpawningPlating = new SummedPercentageStatValue(0);
  public AbilityCooldownSpeed = new PercentageStatValue(1.0);
  public DashCooldownSpeed = new PercentageStatValue(1.0);
  public EatingSpeed = new PercentageStatValue(1.0);
  public PercentageFoodRequirementCompleted = new PercentageStatValue(1.0);
  public Senses = new HybridStatValue(1.0);
  public ApexPredator = new FlatStatValue(1.0);
  public HeatResistance = new SummedPercentageStatValue(0);
  public ColdResistance = new SummedPercentageStatValue(0);
  public TerrainAdaptation = new SummedPercentageStatValue(0);
  public SandTerrainAdaptation = new SummedPercentageStatValue(0);
  public SnowTerrainAdaptation = new SummedPercentageStatValue(0);
  public WaterTerrainAdaptation = new SummedPercentageStatValue(0);
  public PoisonDamagePercentage = new PercentageStatValue(1.0);
  public HpRegenPerSec = new FlatStatValue(0);
  public CharmChance = new SummedPercentageStatValue(0);
  public MaxCharmedCompanions = new FlatStatValue(2);
  public LastStandChanceMultiplier = new PercentageStatValue(1.0);
  public Size = new HybridStatValue(1.0);

  public applyBonusMap(bonuses: Record<string, { flat?: number; pct?: number }>): void {
    for (const [statName, mod] of Object.entries(bonuses)) {
      const f = mod.flat ?? 0;
      const p = mod.pct ?? 0;
      const target = (this as Record<string, unknown>)[statName];
      if (!target) continue;
      if (target instanceof HybridStatValue) {
        if (f !== 0) target.addFlat(f);
        if (p !== 0) target.addPercentage(p);
      } else if (target instanceof FlatStatValue) {
        if (f !== 0) target.addFlat(f);
        if (p !== 0) target.addFlat(p);
      } else if (target instanceof PercentageStatValue || target instanceof SummedPercentageStatValue) {
        if (f !== 0) target.addPercentage(f);
        if (p !== 0) target.addPercentage(p);
      }
    }
  }

  /**
   * PlayerCharacter.RecalculateDamageReduction (0x180711bc0):
   * Evaluates DamageReductionStatToDamageReductionCurve (diminishing returns, capped at 0.85 or 0.80 on D11+)
   */
  public getDamageReductionFraction(difficultyLevel: number): number {
    const pts = Math.max(0, this.DamageReduction.value);
    const perLevel = difficultyLevel >= 11 ? 0.08 : 0.10;
    const cap = difficultyLevel >= 11 ? 0.80 : 0.85;
    // Piecewise diminishing returns curve matching Default_PlayerDamageReductionStatToDamageReductionData.asset
    const frac = 1.0 - Math.exp(-pts * perLevel);
    return Math.min(cap, Math.max(0, frac));
  }

  /**
   * PlayerCharacter.RecalculateMovementSpeed (0x180711d50) &
   * AStatCharacter.ApplyTerrainMovementPenalty (0x1817d6120)
   */
  public calculateActualMovementSpeed(
    terrain: TerrainType,
    waterDepth: number,
    isUnderwater: boolean,
    difficultyLevel: number
  ): number {
    const statVal = this.MovementSpeed.value;
    // PlayerSpeedStatToActualSpeedCurve: maps stat [0..10] -> [4.0 .. 7.6 .. 13.0] (or -0.4 on D5+)
    const d5Offset = difficultyLevel >= 5 ? -0.4 : 0.0;
    let baseSpeed: number;
    if (statVal <= 5.0) {
      baseSpeed = 4.0 + (statVal / 5.0) * 3.6 + d5Offset;
    } else {
      baseSpeed = 7.6 + ((statVal - 5.0) / 5.0) * 5.4 + d5Offset;
    }
    baseSpeed *= this.SpeedMultiplier.multiplier;

    // Terrain penalty (0x1817d6120)
    let terrainSpeed = baseSpeed;
    const genAdapt = this.TerrainAdaptation.value;

    if (terrain === 'Sand') {
      const pSand = 0.125;
      const adapt = Math.min(1.0, genAdapt + this.SandTerrainAdaptation.value);
      const factor = Math.max(1.0 - pSand * (1.0 - adapt), 1.0 - pSand);
      terrainSpeed = baseSpeed * factor;
    } else if (terrain === 'Snow') {
      const pSnow = 0.20;
      const adapt = Math.min(1.0, genAdapt + this.SnowTerrainAdaptation.value);
      const factor = Math.max(1.0 - pSnow * (1.0 - adapt), 1.0 - pSnow);
      terrainSpeed = baseSpeed * factor;
    } else if (terrain === 'Water' && !isUnderwater) {
      const pWater = 0.75;
      const adapt = Math.min(1.0, genAdapt + this.WaterTerrainAdaptation.value);
      const depthImpact = Math.max(0, Math.min(1.0, waterDepth));
      const factor = Math.max(1.0 - pWater, Math.min(1.0, 1.0 - pWater * Math.max(depthImpact - adapt, 0.0)));
      terrainSpeed = baseSpeed * factor;
    }

    // Clamp to [MIN_POSSIBLE_MOVE_SPEED (0.2), MAX_POSSIBLE_MOVE_SPEED (40.0)]
    return Math.max(0.2, Math.min(40.0, terrainSpeed));
  }

  /**
   * AStatCharacter.CalculateDamageValue (0x1817d6380)
   */
  public calculateAttackDamage(
    damageType: AttackDamageType,
    abilityMultiplier: number,
    currentPlating: number,
    actualSpeed: number
  ): number {
    switch (damageType) {
      case 'Base':
        return this.BasePhysicalDamage.value * abilityMultiplier;
      case 'MaxHp':
        return this.MaxHp.value * abilityMultiplier;
      case 'Speed':
        return actualSpeed * abilityMultiplier * 1.4;
      case 'Plating':
        return (this.BasePhysicalDamage.value * 0.6 + currentPlating * 0.45) * abilityMultiplier;
      case 'Ranged':
        return this.BasePhysicalDamage.value * abilityMultiplier * this.RangedDamageMultiplier.value;
    }
  }

  /**
   * EvolutionAbilitiesData.GetPointsNeededToLevelUp (0x180643620)
   */
  public static getPointsNeededToLevelUp(level: number, diffMultiplier = 1.0, challengeMultiplier = 1.0): number {
    let basePoints: number;
    if (level <= 99) {
      // Smooth curve matching EvolutionAbilityData.asset (20 at L1 -> ~420 at L99)
      const t = Math.max(0, level - 1) / 98.0;
      basePoints = 18 + Math.round(35 * t + 365 * Math.pow(t, 1.85));
    } else {
      basePoints = 418 + (level - 99) * 25;
    }
    return Math.max(8, Math.round(basePoints * diffMultiplier * challengeMultiplier));
  }
}
