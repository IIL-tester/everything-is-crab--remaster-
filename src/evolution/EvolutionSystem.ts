import evolutionsData from '../data/evolutions.json';
import specializationsData from '../data/specializations.json';
import { AttackDamageType, PlayerStatsSet } from '../stats/StatValues';

export interface EvolutionLevelDef {
  level: number;
  damageMultiplier: number;
  cooldown: number;
  range: number;
  knockback: number;
  statBonuses: Record<string, { flat?: number; pct?: number }>;
}

export interface EvolutionDef {
  id: number;
  key: string;
  name: string;
  category: string;
  bodyPart: 'Head' | 'Arms' | 'LowerBody' | 'RangedAttack' | 'Dash' | 'Passive';
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Boss';
  primaryAffinity: 'Predator' | 'Trickster' | 'AllRounder' | 'Tank' | 'Prey';
  hiddenAffinities: string[];
  carcinisationGain: number;
  maxLevel: number;
  isSpecializable: boolean;
  specializations?: number[];
  damageType: AttackDamageType;
  statusEffect: string | null;
  description: string;
  levels: EvolutionLevelDef[];
}

export interface SpecializationDef {
  id: number;
  parentEvolutionId: number;
  key: string;
  name: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Boss';
  carcinisationGain: number;
  description: string;
  damageMultiplierBonus: number;
  statusEffect: string | null;
  statBonuses: Record<string, { flat?: number; pct?: number }>;
}

export interface DraftOption {
  kind: 'evolution' | 'specialization';
  evolution?: EvolutionDef;
  specialization?: SpecializationDef;
  targetLevel: number;
  isUpgrade: boolean;
}

export const AFFINITY_APEX_BONUS: Record<string, number> = {
  Predator: 1.2,
  Trickster: 0.9,
  AllRounder: 0.7,
  Tank: 0.5,
  Prey: 0.2
};

export const CARCINISATION_EFFECTS = [
  'CrabbyBramble',
  'MoreTentacles',
  'PoisonousTentacles',
  'ProtectedTentacles',
  'EggsHaveAlphas'
];

export class EvolutionSystem {
  public readonly allEvolutions: EvolutionDef[] = evolutionsData as unknown as EvolutionDef[];
  public readonly allSpecializations: SpecializationDef[] = specializationsData as unknown as SpecializationDef[];

  public ownedEvolutions = new Map<number, number>(); // evolutionId -> level (1..maxLevel)
  public ownedSpecializations = new Map<number, SpecializationDef>(); // parentEvolutionId -> SpecializationDef
  public bannedEvolutions = new Set<number>();
  public abilityCooldownTimers = new Map<number, number>();

  public carcinisationLevel = 0;
  public activeCarcinisationEffects: string[] = [];
  public freeRerolls = 3;
  public remainingBans = 3;
  public numTimesEvolved = 0;

  constructor(startingCarcinisation = 0, extraRerolls = 0) {
    this.carcinisationLevel = Math.min(10, startingCarcinisation);
    this.freeRerolls = Math.max(0, 3 + extraRerolls);
    this.updateCarcinisationThresholds();
  }

  public addCarcinisation(amount: number): void {
    if (amount <= 0) return;
    this.carcinisationLevel = Math.min(10, this.carcinisationLevel + amount);
    this.updateCarcinisationThresholds();
  }

  /**
   * CarcinisationEffectsManager: Unlocks standard effects at 4 and 7, and EggsHaveBoss at 10
   */
  public updateCarcinisationThresholds(): void {
    if (this.carcinisationLevel >= 4 && this.activeCarcinisationEffects.length < 1) {
      this.activeCarcinisationEffects.push('MoreTentacles');
    }
    if (this.carcinisationLevel >= 7 && this.activeCarcinisationEffects.length < 2) {
      this.activeCarcinisationEffects.push('CrabbyBramble');
    }
    if (this.carcinisationLevel >= 10 && !this.activeCarcinisationEffects.includes('EggsHaveBoss')) {
      this.activeCarcinisationEffects.push('EggsHaveBoss');
    }
  }

  /**
   * EvolutionHandler.AddNewAbilityOrIncrementLevel (0x1805be1b0)
   */
  public applyDraftOption(option: DraftOption, stats: PlayerStatsSet): void {
    if (option.kind === 'specialization' && option.specialization) {
      const spec = option.specialization;
      this.ownedSpecializations.set(spec.parentEvolutionId, spec);
      stats.applyBonusMap(spec.statBonuses);
      this.addCarcinisation(spec.carcinisationGain);
      this.numTimesEvolved++;
      this.recalculateApexScore(stats);
      return;
    }

    const evo = option.evolution;
    if (!evo) return;
    const prevLevel = this.ownedEvolutions.get(evo.id) ?? 0;
    const nextLevel = Math.min(evo.maxLevel, prevLevel + 1);
    this.ownedEvolutions.set(evo.id, nextLevel);
    if (!this.abilityCooldownTimers.has(evo.id)) {
      this.abilityCooldownTimers.set(evo.id, 0);
    }

    // Apply delta between prevLevel and nextLevel stat bonuses
    const nextDef = evo.levels[nextLevel - 1];
    const prevDef = prevLevel > 0 ? evo.levels[prevLevel - 1] : null;
    if (nextDef) {
      const deltaBonuses: Record<string, { flat?: number; pct?: number }> = {};
      for (const [k, v] of Object.entries(nextDef.statBonuses)) {
        const prevF = prevDef?.statBonuses[k]?.flat ?? 0;
        const prevP = prevDef?.statBonuses[k]?.pct ?? 0;
        deltaBonuses[k] = {
          flat: (v.flat ?? 0) - prevF,
          pct: (v.pct ?? 0) - prevP
        };
      }
      stats.applyBonusMap(deltaBonuses);
    }

    if (prevLevel === 0) {
      this.addCarcinisation(evo.carcinisationGain);
    }
    this.numTimesEvolved++;
    this.recalculateApexScore(stats);
  }

  /**
   * EvolutionHandler.UpdatePlayerApexPredatorStatus (0x1805c2190)
   */
  public recalculateApexScore(stats: PlayerStatsSet): void {
    let affinityApex = 1.0;
    for (const [evoId, lvl] of this.ownedEvolutions.entries()) {
      const def = this.allEvolutions.find(e => e.id === evoId);
      if (!def) continue;
      const perLvl = AFFINITY_APEX_BONUS[def.primaryAffinity] ?? 0.5;
      affinityApex += perLvl * (1 + (lvl - 1) * 0.25);
    }
    stats.ApexPredator.baseValue = Number(affinityApex.toFixed(2));
    stats.ApexPredator.updateValue();
  }

  /**
   * EvolutionHandler.BanEvolution (0x1805beac0)
   */
  public banEvolution(evoId: number): boolean {
    if (this.remainingBans <= 0) return false;
    this.bannedEvolutions.add(evoId);
    this.remainingBans--;
    return true;
  }

  /**
   * EvolutionChoiceHelper.GenerateEvolutionOptions (0x180644be0)
   * Generates 3 draft options respecting rarity brackets, affinity synergy, and upgrade rolls
   */
  public generateDraftOptions(playerLevel: number, isBossFruit = false, count = 3): DraftOption[] {
    const options: DraftOption[] = [];
    const usedIds = new Set<string>();

    // Check if Boss Fruit draft
    if (isBossFruit) {
      const bossEvos = this.allEvolutions.filter(
        e => e.category === 'BossBranching' && (this.ownedEvolutions.get(e.id) ?? 0) < e.maxLevel
      );
      for (const evo of bossEvos) {
        const cur = this.ownedEvolutions.get(evo.id) ?? 0;
        options.push({
          kind: 'evolution',
          evolution: evo,
          targetLevel: cur + 1,
          isUpgrade: cur > 0
        });
      }
      if (options.length >= count) return options.slice(0, count);
    }

    // Check eligible Specializations (parent specializable evolution at Level >= 3)
    const eligibleSpecs = this.allSpecializations.filter(s => {
      const parentLvl = this.ownedEvolutions.get(s.parentEvolutionId) ?? 0;
      return parentLvl >= 3 && !this.ownedSpecializations.has(s.parentEvolutionId);
    });

    if (eligibleSpecs.length > 0 && Math.random() < 0.45) {
      const spec = eligibleSpecs[Math.floor(Math.random() * eligibleSpecs.length)];
      usedIds.add(`spec_${spec.id}`);
      options.push({
        kind: 'specialization',
        specialization: spec,
        targetLevel: 1,
        isUpgrade: true
      });
    }

    // Rarity weight brackets by player level (EvolutionAbilitiesData.asset)
    const rarityWeights: Record<string, number> =
      playerLevel < 3
        ? { Common: 80, Rare: 20, Epic: 0, Legendary: 0, Boss: 0 }
        : playerLevel < 7
        ? { Common: 55, Rare: 35, Epic: 10, Legendary: 0, Boss: 0 }
        : playerLevel < 12
        ? { Common: 35, Rare: 40, Epic: 20, Legendary: 5, Boss: 0 }
        : { Common: 20, Rare: 35, Epic: 30, Legendary: 15, Boss: 0 };

    // Count owned affinities for synergy weight boost
    const affinityCounts: Record<string, number> = {};
    for (const evoId of this.ownedEvolutions.keys()) {
      const d = this.allEvolutions.find(e => e.id === evoId);
      if (d) affinityCounts[d.primaryAffinity] = (affinityCounts[d.primaryAffinity] ?? 0) + 1;
    }

    const candidates = this.allEvolutions.filter(e => {
      if (e.category === 'BossBranching' && !isBossFruit) return false;
      if (this.bannedEvolutions.has(e.id)) return false;
      const curLvl = this.ownedEvolutions.get(e.id) ?? 0;
      return curLvl < e.maxLevel;
    });

    let safety = 0;
    while (options.length < count && candidates.length > 0 && safety++ < 40) {
      const weightedPool: { evo: EvolutionDef; weight: number }[] = [];
      for (const evo of candidates) {
        if (usedIds.has(`evo_${evo.id}`)) continue;
        const curLvl = this.ownedEvolutions.get(evo.id) ?? 0;
        let w = rarityWeights[evo.rarity] ?? 15;
        if (w <= 0 && curLvl === 0) w = 3;
        // Upgrade weight boost (45% base preference for upgrading owned abilities)
        if (curLvl > 0) w *= 1.85;
        // Affinity synergy bonus (+20% per matching affinity ability owned)
        const affCount = affinityCounts[evo.primaryAffinity] ?? 0;
        w *= 1 + affCount * 0.2;
        weightedPool.push({ evo, weight: w });
      }
      if (weightedPool.length === 0) break;

      const totalW = weightedPool.reduce((s, item) => s + item.weight, 0);
      let r = Math.random() * totalW;
      let picked = weightedPool[0].evo;
      for (const item of weightedPool) {
        r -= item.weight;
        if (r <= 0) {
          picked = item.evo;
          break;
        }
      }

      usedIds.add(`evo_${picked.id}`);
      const curLvl = this.ownedEvolutions.get(picked.id) ?? 0;
      options.push({
        kind: 'evolution',
        evolution: picked,
        targetLevel: curLvl + 1,
        isUpgrade: curLvl > 0
      });
    }

    return options;
  }
}
