import worldConfig from '../data/worldConfig.json';
import { EcosystemDirector } from '../ai/EcosystemDirector';
import {
  AttackVisualArc,
  FloatingText,
  FoodItem,
  PixelParticle,
  PlayerEntity
} from '../entities/Entities';
import { EvolutionSystem } from '../evolution/EvolutionSystem';
import { PlayerStatsSet } from '../stats/StatValues';
import { RunStartConfig, UIManager } from '../ui/UIManager';
import { WorldMap } from '../world/WorldMap';
import { AssetLoader } from './AssetLoader';
import { CanvasRenderer } from './CanvasRenderer';
import { SoundEngine } from './SoundEngine';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private assets = new AssetLoader();
  private renderer: CanvasRenderer;
  private ui: UIManager;
  private sound = new SoundEngine();

  private player = new PlayerEntity();
  private map = new WorldMap();
  private evoSystem = new EvolutionSystem();
  private director = new EcosystemDirector();

  private runConfig: RunStartConfig = {
    difficultyLevel: 1,
    genetic1Id: 1,
    genetic2Id: 2,
    challengeId: 0,
    seed: 1337
  };

  private isRunning = false;
  private isPausedForModal = false;
  private segmentTimeSec = 0;
  private totalTimeSec = 0;
  private endlessLevel = 0;
  private secondaryGeneticSpliced = false;

  private activeWeather: 'None' | 'Rain' | 'Heatwave' | 'Snowstorm' = 'None';
  private weatherTimer = 25;

  private keys = new Set<string>();
  private mouseScreenX = 0;
  private mouseScreenY = 0;
  private mouseLeftDown = false;
  private mouseRightDown = false;
  public autoAttack = false;

  private attackArcs: AttackVisualArc[] = [];
  private floatingTexts: FloatingText[] = [];
  private particles: PixelParticle[] = [];
  private lastFrameTime = performance.now();
  private autoSaveTimer = 0;
  private readonly saveKey = 'everything_is_crab_save_v1';

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.canvas = canvas;
    this.renderer = new CanvasRenderer(canvas, this.assets);
    this.ui = new UIManager(uiRoot);

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    window.addEventListener('beforeunload', () => this.saveRunState());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveRunState();
    });
    this.bindInputs();

    this.assets.preloadAll().then(() => {
      this.openTitleWithSave();
    });
    requestAnimationFrame(ts => this.loop(ts));
  }

  private openTitleWithSave(): void {
    const summary = this.getSavedRunSummary();
    this.ui.showTitleScreen(
      cfg => {
        this.clearSavedRun();
        this.startNewRun(cfg);
      },
      summary,
      () => this.resumeSavedRun()
    );
  }

  private resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private bindInputs(): void {
    window.addEventListener('keydown', ev => {
      const k = ev.key.toLowerCase();
      this.keys.add(k);
      if (k === ' ' && this.isRunning && !this.isPausedForModal) {
        ev.preventDefault();
        this.tryDash();
      } else if (k === 'e' && this.isRunning && !this.isPausedForModal) {
        this.tryInteractBurrowOrPoi();
      } else if (k === 't' && this.isRunning && !this.isPausedForModal) {
        this.autoAttack = !this.autoAttack;
        this.spawnFloatingText(
          this.autoAttack ? 'AUTO-ATTACK: ON' : 'AUTO-ATTACK: OFF (LMB/RMB)',
          this.player.x,
          this.player.y - 30,
          '#ffbe0b'
        );
      }
    });

    window.addEventListener('keyup', ev => {
      this.keys.delete(ev.key.toLowerCase());
    });

    this.canvas.addEventListener('mousemove', ev => {
      this.mouseScreenX = ev.clientX;
      this.mouseScreenY = ev.clientY;
    });

    this.canvas.addEventListener('contextmenu', ev => ev.preventDefault());

    this.canvas.addEventListener('mousedown', ev => {
      if (ev.button === 2) this.mouseRightDown = true;
      else this.mouseLeftDown = true;
    });

    window.addEventListener('mouseup', ev => {
      if (ev.button === 2) this.mouseRightDown = false;
      else this.mouseLeftDown = false;
    });
  }

  public startNewRun(cfg: RunStartConfig): void {
    this.runConfig = cfg;
    const diff = this.getDifficultyData();

    this.player = new PlayerEntity();
    this.map = new WorldMap(cfg.seed, cfg.difficultyLevel, cfg.challengeId);
    this.evoSystem = new EvolutionSystem(diff.startCarc, cfg.difficultyLevel >= 12 ? -2 : 0);
    this.director = new EcosystemDirector();

    this.segmentTimeSec = 0;
    this.totalTimeSec = 0;
    this.endlessLevel = 0;
    this.secondaryGeneticSpliced = false;
    this.activeWeather = 'None';
    this.weatherTimer = cfg.difficultyLevel === 0 ? 45 : 22;
    this.attackArcs = [];
    this.floatingTexts = [];
    this.particles = [];

    // Apply Primary Genetic (Genetic_1)
    this.applyGeneticTrait(cfg.genetic1Id);

    // Ensure Crab starts with a basic melee attack (Crab Claws L1) so combat works immediately
    if (this.evoSystem.ownedEvolutions.size === 0) {
      const clawsDef = this.evoSystem.allEvolutions.find(e => e.id === 130)!;
      this.evoSystem.applyDraftOption(
        { kind: 'evolution', evolution: clawsDef, targetLevel: 1, isUpgrade: false },
        this.player.stats
      );
    }

    this.player.hp = this.player.stats.MaxHp.value;
    this.player.plating = this.player.stats.MaxPlating.value;
    this.player.xpToNextLevel = PlayerStatsSet.getPointsNeededToLevelUp(
      1,
      1.0 + cfg.difficultyLevel * 0.02,
      cfg.challengeId === 1024 ? 0.67 : 1.0
    );

    this.map.ensureRegionsAroundPlayer(0, 0);
    this.director.populateInitialEcosystem(this.player, this.map);

    this.isRunning = true;
    this.isPausedForModal = false;
    this.spawnFloatingText('RUN STARTED! EAT & EVOLVE!', 0, -35, '#ffbe0b');
  }

  private getDifficultyData() {
    return (
      worldConfig.difficulties.find(d => d.level === this.runConfig.difficultyLevel) ||
      worldConfig.difficulties[1]
    );
  }

  private applyGeneticTrait(geneticId: number): void {
    const gen = worldConfig.genetics.find(g => g.id === geneticId);
    if (!gen) return;
    const b = gen.bonuses as Record<string, number | undefined>;
    if (b.MaxHpPct) this.player.stats.MaxHp.addPercentage(b.MaxHpPct);
    if (b.DamagePct) this.player.stats.BasePhysicalDamage.addPercentage(b.DamagePct);
    if (b.Rerolls) this.evoSystem.freeRerolls += b.Rerolls;
    if (b.ApexFlat) this.player.stats.ApexPredator.addFlat(b.ApexFlat);
    if (b.PlatingFlat) this.player.stats.MaxPlating.addFlat(b.PlatingFlat);
    if (b.DamageReductionFlat) this.player.stats.DamageReduction.addFlat(b.DamageReductionFlat);
    if (b.XpPct) this.player.stats.PercentageFoodRequirementCompleted.addPercentage(b.XpPct);
    if (b.SpeedFlat) this.player.stats.MovementSpeed.addFlat(b.SpeedFlat);
    if (b.StartCarc) this.evoSystem.addCarcinisation(b.StartCarc);
    if (b.CooldownPct) this.player.stats.AbilityCooldownSpeed.addPercentage(b.CooldownPct);
  }

  private spawnFloatingText(text: string, x: number, y: number, color: string): void {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -32,
      color,
      life: 1.15,
      maxLife: 1.15
    });
  }

  private spawnParticles(x: number, y: number, color: string, count = 6, speed = 85, size = 4): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size,
        color,
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45
      });
    }
  }

  private tryDash(): void {
    if (this.player.dashCooldown > 0) return;
    this.sound.playDash();
    this.player.inBurrow = false;
    this.spawnParticles(this.player.x, this.player.y, '#e2e8f0', 8, 95, 4);

    const soakPenalty = 1.0 + this.player.soakBuildup * 0.75;
    const cdSpeed = Math.max(0.25, this.player.stats.DashCooldownSpeed.value);
    this.player.dashCooldown = (2.1 / cdSpeed) * soakPenalty;
    this.player.dashActiveTimer = 0.24;

    // Dash ability shockwave (Dash_Leap = 404 or Dash_JetPropulsion = 408)
    for (const evoId of [404, 408]) {
      const lvl = this.evoSystem.ownedEvolutions.get(evoId) ?? 0;
      if (lvl > 0) {
        const def = this.evoSystem.allEvolutions.find(e => e.id === evoId)!;
        const lvlDef = def.levels[lvl - 1];
        const dmg = this.player.stats.calculateAttackDamage(
          def.damageType,
          lvlDef.damageMultiplier,
          this.player.plating,
          10
        );
        this.attackArcs.push({
          x: this.player.x,
          y: this.player.y,
          angle: this.player.angle,
          radius: 85,
          color: evoId === 408 ? '#38bdf8' : '#fbbf24',
          life: 0.22,
          maxLife: 0.22
        });
        for (const c of this.director.creatures) {
          if (c.isCharmed || c.hp <= 0) continue;
          if (Math.hypot(c.x - this.player.x, c.y - this.player.y) <= 95 + c.radius) {
            this.director.damageCreature(
              c,
              dmg,
              def.statusEffect,
              lvlDef.knockback,
              this.player.angle,
              this.player,
              (txt, x, y, col) => this.spawnFloatingText(txt, x, y, col)
            );
          }
        }
      }
    }
  }

  private tryInteractBurrowOrPoi(): void {
    // 1. Check Burrows
    if (this.player.inBurrow) {
      this.player.inBurrow = false;
      this.spawnFloatingText('EXITED BURROW', this.player.x, this.player.y - 25, '#fde68a');
      return;
    }
    for (const b of this.map.burrows) {
      if (Math.hypot(b.x - this.player.x, b.y - this.player.y) <= b.radius + 24) {
        this.player.inBurrow = true;
        this.player.x = b.x;
        this.player.y = b.y;
        this.spawnFloatingText('HIDDEN IN BURROW (3x Temp Recovery)', b.x, b.y - 28, '#fde68a');
        return;
      }
    }

    // 2. Check POIs (PointOfInterestMappings.asset)
    for (const p of this.map.pois) {
      if (p.used) continue;
      if (Math.hypot(p.x - this.player.x, p.y - this.player.y) <= p.radius + 28) {
        p.used = true;
        this.sound.playLevelUp();
        if (p.poiType === 'GrowingTree' || p.poiType === 'ChaosTree') {
          this.evoSystem.freeRerolls++;
          this.spawnFloatingText(`${p.name}: FORCED EVOLUTION!`, p.x, p.y - 30, '#10b981');
          this.openDraftModal(false);
        } else if (p.poiType === 'HealingPond' || p.poiType === 'Oasis') {
          const heal = this.player.stats.MaxHp.value * 0.45 * this.getDifficultyData().healEff;
          this.player.hp = Math.min(this.player.stats.MaxHp.value, this.player.hp + heal);
          this.player.heatBuildup = 0;
          this.player.coldBuildup = 0;
          this.spawnFloatingText(`+${Math.round(heal)} HP & TEMP CLEARED!`, p.x, p.y - 30, '#06d6a0');
        } else {
          this.player.plating = Math.min(this.player.stats.MaxPlating.value, this.player.plating + 35);
          this.gainCalories(35);
          this.spawnFloatingText('+35 CAL & PLATING!', p.x, p.y - 30, '#38bdf8');
        }
        return;
      }
    }
  }

  private gainCalories(rawCalories: number): void {
    // Endless XP contribution impact (WorldStats._timeToAllXpContributionImpact: drops to 0.45x in Endless)
    const endlessXpMult = this.endlessLevel > 0 ? 0.45 : 1.0;
    const gained =
      rawCalories *
      this.player.stats.PercentageFoodRequirementCompleted.value *
      endlessXpMult;

    this.player.xp += gained;
    while (this.player.xp >= this.player.xpToNextLevel) {
      this.player.xp -= this.player.xpToNextLevel;
      this.player.level++;
      this.player.xpToNextLevel = PlayerStatsSet.getPointsNeededToLevelUp(
        this.player.level,
        1.0 + this.runConfig.difficultyLevel * 0.02,
        this.runConfig.challengeId === 1024 ? 0.67 : 1.0
      );

      // Heal MaxHpGainPerLevel on level up unless Wounded (64) challenge is active
      if (this.runConfig.challengeId !== 64) {
        const lvlHeal = this.runConfig.difficultyLevel >= 12 ? 6 : 12;
        this.player.hp = Math.min(this.player.stats.MaxHp.value, this.player.hp + lvlHeal);
      }

      this.sound.playLevelUp();
      this.openDraftModal(false);
    }
  }

  private openDraftModal(isBossFruit: boolean): void {
    this.isPausedForModal = true;
    this.ui.showDraftModal(
      this.player.level,
      isBossFruit,
      this.evoSystem,
      this.player.mutagen,
      cost => {
        if (this.player.mutagen >= cost) {
          this.player.mutagen -= cost;
          return true;
        }
        return false;
      },
      chosen => {
        this.evoSystem.applyDraftOption(chosen, this.player.stats);
        this.player.syncMaxHpAndPlating(true);
        this.isPausedForModal = false;
        this.saveRunState();
      }
    );
  }

  private handleEatFood(f: FoodItem): void {
    this.sound.playEatCrunch();
    const crumbCol =
      f.kind === 'Legendary' || f.kind === 'BossFruit'
        ? '#fbbf24'
        : f.kind === 'Epic'
        ? '#c084fc'
        : f.kind === 'Rare'
        ? '#38bdf8'
        : f.kind === 'PlatingShard'
        ? '#4cc9f0'
        : '#f43f5e';
    this.spawnParticles(f.x, f.y, crumbCol, 5, 65, 3);
    const diff = this.getDifficultyData();

    if (f.kind === 'BossFruit') {
      this.player.hp = Math.min(this.player.stats.MaxHp.value, this.player.hp + f.healValue * diff.healEff);
      this.player.plating = Math.min(this.player.stats.MaxPlating.value, this.player.plating + f.platingValue);
      this.spawnFloatingText('BOSS FRUIT CONSUMED!', f.x, f.y - 20, '#f43f5e');
      this.openDraftModal(true);
      return;
    }

    if (f.kind === 'HpFood') {
      if (this.runConfig.challengeId !== 64) {
        const heal = f.healValue * diff.healEff;
        this.player.hp = Math.min(this.player.stats.MaxHp.value, this.player.hp + heal);
        this.spawnFloatingText(`+${Math.round(heal)} HP`, f.x, f.y - 16, '#fb7185');
      }
      this.gainCalories(f.xpValue);
      return;
    }

    if (f.kind === 'PlatingShard') {
      this.player.plating = Math.min(this.player.stats.MaxPlating.value, this.player.plating + f.platingValue);
      this.spawnFloatingText(`+${Math.round(f.platingValue)} PLATING`, f.x, f.y - 16, '#4cc9f0');
      return;
    }

    if (f.kind === 'Mushroom') {
      if (f.mushroomEffect === 'SpeedBoost') {
        this.player.speedBuffTimer = 10;
        this.spawnFloatingText('MUSHROOM: +35% SPEED (10s)', f.x, f.y - 18, '#e879f9');
      } else if (f.mushroomEffect === 'DamageFrenzy') {
        this.player.damageBuffTimer = 10;
        this.spawnFloatingText('MUSHROOM: +40% DAMAGE (10s)', f.x, f.y - 18, '#fbbf24');
      } else if (f.mushroomEffect === 'ThermalShield') {
        this.player.thermalBuffTimer = 14;
        this.player.heatBuildup = 0;
        this.player.coldBuildup = 0;
        this.spawnFloatingText('MUSHROOM: THERMAL IMMUNITY!', f.x, f.y - 18, '#38bdf8');
      } else {
        this.player.mutagen += 12;
        this.spawnFloatingText('MUSHROOM: +12 MUTAGEN!', f.x, f.y - 18, '#c084fc');
      }
      this.gainCalories(f.xpValue);
      return;
    }

    this.gainCalories(f.xpValue);
    this.spawnFloatingText(`+${f.xpValue} CAL`, f.x, f.y - 14, '#a3e635');
  }

  private triggerNextScheduledBoss(forceImmediate = false): void {
    if (this.director.activeBoss) return;
    const isBossRush = this.runConfig.challengeId === 1024;
    const schedule = isBossRush
      ? [
          { timeSeconds: 60, label: '1:00 Boss Rush 1', timeout: 75, pool: [1000], isFinal: false },
          { timeSeconds: 120, label: '2:00 Boss Rush 2', timeout: 75, pool: [1050, 1060], isFinal: false },
          { timeSeconds: 180, label: '3:00 Boss Rush 3', timeout: 75, pool: [1040, 1020], isFinal: false },
          { timeSeconds: 240, label: '4:00 Boss Rush 4', timeout: 75, pool: [1001, 1051, 1061], isFinal: false },
          { timeSeconds: 300, label: '5:00 Boss Rush 5', timeout: 75, pool: [1052, 1062, 1002], isFinal: false },
          { timeSeconds: 360, label: '6:00 Boss Rush 6', timeout: 75, pool: [1022, 1042], isFinal: false },
          { timeSeconds: 420, label: '7:00 Final Boss: The Krabken', timeout: 105, pool: [1180], isFinal: true }
        ]
      : worldConfig.bossEventsStandard;

    for (const ev of schedule) {
      if (this.director.triggeredBossTimestamps.has(ev.timeSeconds)) continue;
      if (forceImmediate || this.segmentTimeSec >= ev.timeSeconds) {
        this.director.triggeredBossTimestamps.add(ev.timeSeconds);
        const diff = this.getDifficultyData();
        this.director.startBossEncounter(
          this.player,
          ev.pool,
          ev.timeout,
          ev.isFinal,
          ev.label,
          diff.dualBosses,
          diff.bossHpMult,
          diff.bossDmgMult,
          diff.enrageMult,
          this.evoSystem,
          () => this.sound.playBossAlarm()
        );
        this.spawnFloatingText(`BOSS ENCOUNTER: ${ev.label}!`, this.player.x, this.player.y - 50, '#f43f5e');
        break;
      }
    }
  }

  private loop(now: number): void {
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    if (this.isRunning && !this.isPausedForModal) {
      this.updateSimulation(dt);
    }

    // Compute Day/Night blend (125s Day, 85s Night, 15s transition = 210s full period)
    const cyclePos = this.totalTimeSec % 210;
    let dayNightBlend = 0;
    if (cyclePos >= 125) {
      const nightElapsed = cyclePos - 125;
      if (nightElapsed < 15) dayNightBlend = nightElapsed / 15;
      else if (nightElapsed > 70) dayNightBlend = 1 - (nightElapsed - 70) / 15;
      else dayNightBlend = 1.0;
    }

    const currentTerrain = this.map.getTerrainAtWorld(this.player.x, this.player.y);

    this.renderer.render(
      dt,
      this.player,
      this.map,
      this.director,
      this.evoSystem,
      dayNightBlend,
      this.activeWeather,
      this.attackArcs,
      this.floatingTexts,
      this.particles
    );

    if (this.isRunning) {
      this.ui.updateHUD(
        this.player,
        this.evoSystem,
        this.director,
        this.segmentTimeSec,
        cyclePos >= 125,
        currentTerrain,
        this.activeWeather,
        this.runConfig.difficultyLevel,
        this.endlessLevel,
        this.autoAttack,
        {
          onToggleAutoAttack: () => {
            this.autoAttack = !this.autoAttack;
            return this.autoAttack;
          },
          onToggleMute: () => {
            this.sound.muted = !this.sound.muted;
            return this.sound.muted;
          }
        }
      );
      const mmCanvas = this.ui.getMinimapCanvas();
      if (mmCanvas) {
        this.renderer.renderMinimap(mmCanvas, this.player, this.map, this.director);
      }
    }

    requestAnimationFrame(ts => this.loop(ts));
  }

  private updateSimulation(dt: number): void {
    const diff = this.getDifficultyData();
    const isFrenzy = this.runConfig.challengeId === 512;

    // 1. Clocks: SegmentRunTime pauses during active boss fights (_timeCanFlowWhenBossFightIsActive = false)
    this.totalTimeSec += dt;
    if (!this.director.activeBoss) {
      this.segmentTimeSec += dt;
    }

    // Unlock secondary genetic splicing at 0:30 (MarkSplicingOpportunityUnlocked_Event)
    if (!this.secondaryGeneticSpliced && this.segmentTimeSec >= 30) {
      this.secondaryGeneticSpliced = true;
      this.applyGeneticTrait(this.runConfig.genetic2Id);
      this.player.syncMaxHpAndPlating(true);
      this.spawnFloatingText('0:30 GENETIC SPLICING UNLOCKED!', this.player.x, this.player.y - 45, '#c084fc');
    }

    // Check scheduled Boss Event timestamps (4:00, 8:00, 12:00, 16:00)
    this.triggerNextScheduledBoss(false);

    // 2. Player Movement & Aiming
    let mx = 0;
    let my = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;

    const currentTerrain = this.map.getTerrainAtWorld(this.player.x, this.player.y);
    const waterDepth = this.map.getWaterDepthAtWorld(this.player.x, this.player.y);
    const moveSpeed = this.player.getCurrentSpeed(currentTerrain, waterDepth, this.runConfig.difficultyLevel);

    if (this.player.dashActiveTimer > 0) {
      this.player.dashActiveTimer = Math.max(0, this.player.dashActiveTimer - dt);
      this.player.x += this.player.dashDirX * moveSpeed * dt;
      this.player.y += this.player.dashDirY * moveSpeed * dt;
    } else if (mx !== 0 || my !== 0) {
      this.player.inBurrow = false;
      const len = Math.hypot(mx, my);
      const nx = mx / len;
      const ny = my / len;
      this.player.dashDirX = nx;
      this.player.dashDirY = ny;
      this.player.x += nx * moveSpeed * dt;
      this.player.y += ny * moveSpeed * dt;
    }

    // Snowstorm wind pushback
    if (this.activeWeather === 'Snowstorm' && !this.player.inBurrow) {
      const coldRes = Math.min(1, this.player.stats.ColdResistance.value);
      this.player.x -= 28 * (1 - coldRes) * dt;
    }

    // Aim toward mouse cursor (accounting for cameraZoom)
    const z = this.renderer.cameraZoom;
    const worldMouseX = this.player.x + (this.mouseScreenX - this.canvas.width / 2) / z;
    const worldMouseY = this.player.y + (this.mouseScreenY - this.canvas.height / 2) / z;
    this.player.angle = Math.atan2(worldMouseY - this.player.y, worldMouseX - this.player.x);

    this.map.ensureRegionsAroundPlayer(this.player.x, this.player.y);

    // 3. Cooldowns, Regen & Buff Timers
    if (this.player.dashCooldown > 0) this.player.dashCooldown = Math.max(0, this.player.dashCooldown - dt);
    if (this.player.attackLungeTimer > 0) this.player.attackLungeTimer = Math.max(0, this.player.attackLungeTimer - dt);
    if (this.player.slowTimer > 0) this.player.slowTimer = Math.max(0, this.player.slowTimer - dt);
    if (this.player.lastStandCooldown > 0) this.player.lastStandCooldown = Math.max(0, this.player.lastStandCooldown - dt);
    if (this.player.hitFlash > 0) this.player.hitFlash = Math.max(0, this.player.hitFlash - dt);
    if (this.player.speedBuffTimer > 0) this.player.speedBuffTimer = Math.max(0, this.player.speedBuffTimer - dt);
    if (this.player.damageBuffTimer > 0) this.player.damageBuffTimer = Math.max(0, this.player.damageBuffTimer - dt);
    if (this.player.thermalBuffTimer > 0) this.player.thermalBuffTimer = Math.max(0, this.player.thermalBuffTimer - dt);

    if (this.runConfig.challengeId !== 64 && this.player.stats.HpRegenPerSec.value > 0) {
      this.player.hp = Math.min(
        this.player.stats.MaxHp.value,
        this.player.hp + this.player.stats.HpRegenPerSec.value * diff.healEff * dt
      );
    }

    // 4. Weather & Temperature/Soak Regulation (Player_CharacterTemperatureRegulator.asset)
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 18 + Math.random() * 14;
      if (this.activeWeather !== 'None') {
        this.activeWeather = 'None';
      } else {
        if (currentTerrain === 'Grass') this.activeWeather = 'Rain';
        else if (currentTerrain === 'Sand') this.activeWeather = 'Heatwave';
        else if (currentTerrain === 'Snow') this.activeWeather = 'Snowstorm';
      }
    }

    const cyclePos = this.totalTimeSec % 210;
    const isNight = cyclePos >= 125;
    this.updateTemperatureAndSoak(dt, currentTerrain, isNight, diff.envDmgMult);

    // 5. Execute Owned Evolution Abilities (Auto-fire / Mouse-fire)
    this.updateEvolutionAbilities(dt, moveSpeed / 26, isFrenzy);

    // 6. Update Ecosystem AI Director
    const progressTimeMultiplier =
      this.endlessLevel > 0
        ? 2.0 + this.endlessLevel * 0.16
        : this.runConfig.challengeId === 1024
        ? 2.66
        : this.runConfig.difficultyLevel === 0
        ? 0.75
        : 1.0;

    this.director.update(
      dt,
      this.player,
      this.map,
      this.evoSystem,
      this.totalTimeSec * progressTimeMultiplier,
      this.endlessLevel,
      {
        level: this.runConfig.difficultyLevel,
        enemyHpMult: diff.enemyHpMult,
        enemyDmgMult: diff.enemyDmgMult,
        bossHpMult: diff.bossHpMult,
        bossDmgMult: diff.bossDmgMult,
        enrageMult: diff.enrageMult
      },
      isNight,
      isFrenzy,
      {
        onFloatingText: (txt, x, y, col) => this.spawnFloatingText(txt, x, y, col),
        onPlayerDamaged: () => {
          this.sound.playHurt();
          if (this.player.hp <= 0) {
            this.endRun(false, 'Died');
          }
        },
        onBossFightEnded: (state, isFinalBoss, killedByMeteor) => {
          if (isFinalBoss && state === 'Killed') {
            this.endRun(true, killedByMeteor ? 'WonBySurviving' : 'WonByKillingBoss');
          }
        },
        onEatFood: food => this.handleEatFood(food)
      }
    );

    // 7. Update Visual Arcs, Particles & Floating Texts
    for (let i = this.attackArcs.length - 1; i >= 0; i--) {
      this.attackArcs[i].life -= dt;
      if (this.attackArcs[i].life <= 0) this.attackArcs.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // 8. Periodic Auto-Save (every 2s)
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= 2.0) {
      this.autoSaveTimer = 0;
      this.saveRunState();
    }
  }

  private updateTemperatureAndSoak(
    dt: number,
    terrain: string,
    isNight: boolean,
    envDmgMult: number
  ): void {
    // Rain / Water Soak buildup (Grass_BiomeEffectSettings.asset: up to 1.75x cooldown penalty)
    if (this.activeWeather === 'Rain' && !this.player.inBurrow) {
      this.player.soakBuildup = Math.min(1.0, this.player.soakBuildup + 0.06 * dt);
    } else {
      this.player.soakBuildup = Math.max(0.0, this.player.soakBuildup - 0.14 * dt);
    }

    if (this.player.thermalBuffTimer > 0 || this.player.inBurrow) {
      // Burrow_TemperatureChangeData.asset: 3.0x neutral recovery rate
      this.player.heatBuildup = Math.max(0, this.player.heatBuildup - 0.25 * dt);
      this.player.coldBuildup = Math.max(0, this.player.coldBuildup - 0.25 * dt);
      return;
    }

    const heatRes = Math.min(1.0, this.player.stats.HeatResistance.value);
    const coldRes = Math.min(1.0, this.player.stats.ColdResistance.value);

    // Sand heats during Daytime or Heatwave
    if (terrain === 'Sand' && (!isNight || this.activeWeather === 'Heatwave')) {
      const rate = (this.activeWeather === 'Heatwave' ? 0.14 : 0.08) * (1.0 - heatRes);
      this.player.heatBuildup = Math.min(1.0, this.player.heatBuildup + rate * dt);
      this.player.coldBuildup = Math.max(0, this.player.coldBuildup - 0.16 * dt);
    } else if (terrain === 'Snow') {
      // Snow cools at 1.0x Day, 1.2x Night, or faster during Snowstorm
      const rate = (this.activeWeather === 'Snowstorm' ? 0.16 : isNight ? 0.11 : 0.085) * (1.0 - coldRes);
      this.player.coldBuildup = Math.min(1.0, this.player.coldBuildup + rate * dt);
      this.player.heatBuildup = Math.max(0, this.player.heatBuildup - 0.16 * dt);
    } else {
      const waterBonus = terrain === 'Water' ? 1.2 : 1.0;
      this.player.heatBuildup = Math.max(0, this.player.heatBuildup - 0.09 * waterBonus * dt);
      this.player.coldBuildup = Math.max(0, this.player.coldBuildup - 0.09 * waterBonus * dt);
    }

    // Piercing environmental damage every 2s at 100% Heat or Cold (5 base dmg * envDmgMult)
    if (this.player.heatBuildup >= 0.99 || this.player.coldBuildup >= 0.99) {
      this.player.tempDamageTimer += dt;
      if (this.player.tempDamageTimer >= 2.0) {
        this.player.tempDamageTimer = 0;
        const cat = this.player.heatBuildup >= 0.99 ? 'Heat' : 'Cold';
        const died = this.player.takeDamage(
          5 * envDmgMult,
          cat,
          this.runConfig.difficultyLevel,
          val => this.director.spawnPlatingShard(this.player.x, this.player.y, val),
          (txt, col) => this.spawnFloatingText(txt, this.player.x, this.player.y - 24, col)
        );
        if (died) this.endRun(false, 'Died');
      }
    } else {
      this.player.tempDamageTimer = 0;
    }
  }

  private updateEvolutionAbilities(dt: number, actualSpeedUnits: number, isFrenzy: boolean): void {
    if (this.player.inBurrow) return;

    // Soak increases ability cooldowns up to 1.75x (Grass_BiomeEffectSettings.asset)
    const soakMult = 1.0 + this.player.soakBuildup * 0.75;
    const frenzyMult = isFrenzy ? 0.66 : 1.0;
    const cdSpeed = Math.max(0.25, this.player.stats.AbilityCooldownSpeed.value);

    let activeAttackIndex = 0;
    for (const [evoId, lvl] of this.evoSystem.ownedEvolutions.entries()) {
      const def = this.evoSystem.allEvolutions.find(e => e.id === evoId);
      if (!def) continue;
      const lvlDef = def.levels[lvl - 1] || def.levels[0];
      if (lvlDef.cooldown <= 0 || lvlDef.damageMultiplier <= 0 || def.category === 'Dash') continue;

      const isPrimarySlot = activeAttackIndex === 0;
      activeAttackIndex++;

      let rem = (this.evoSystem.abilityCooldownTimers.get(evoId) ?? 0) - dt;
      if (rem > 0) {
        this.evoSystem.abilityCooldownTimers.set(evoId, rem);
        continue;
      }

      // Manual LMB / RMB control (authentic to Everything is Crab) or Auto-Attack [T]
      const range = lvlDef.range;
      const manualTriggered = isPrimarySlot
        ? this.mouseLeftDown
        : this.mouseRightDown || this.mouseLeftDown;
      const autoTriggered =
        this.autoAttack &&
        this.director.creatures.some(
          c => !c.isCharmed && c.hp > 0 && Math.hypot(c.x - this.player.x, c.y - this.player.y) <= range + c.radius + 25
        );

      if (!manualTriggered && !autoTriggered) {
        this.evoSystem.abilityCooldownTimers.set(evoId, 0);
        continue;
      }

      // Trigger swing lunge & reset cooldown
      this.player.attackLungeTimer = 0.12;
      const spec = this.evoSystem.ownedSpecializations.get(evoId);
      const effectiveCd = ((lvlDef.cooldown * frenzyMult) / cdSpeed) * soakMult;
      this.evoSystem.abilityCooldownTimers.set(evoId, effectiveCd);

      const dmgMult = lvlDef.damageMultiplier + (spec ? spec.damageMultiplierBonus : 0);
      const rawDamage = this.player.stats.calculateAttackDamage(
        def.damageType,
        dmgMult,
        this.player.plating,
        actualSpeedUnits
      );
      const status = spec?.statusEffect ?? def.statusEffect;

      if (def.bodyPart === 'RangedAttack') {
        // Fire projectile(s) toward aim angle
        this.sound.playAttackSnap(def.id === 302);
        const count = spec?.id === 19 ? 2 : 1;
        for (let s = 0; s < count; s++) {
          const spread = count > 1 ? (s - 0.5) * 0.16 : 0;
          const ang = this.player.angle + spread;
          const spd = def.id === 302 ? 540 : 420;
          this.director.projectiles.push({
            uid: this.director.makeUid('proj'),
            fromPlayer: true,
            x: this.player.x + Math.cos(ang) * this.player.radius,
            y: this.player.y + Math.sin(ang) * this.player.radius,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            damage: rawDamage,
            radius: def.id === 302 ? 12 : 7,
            life: range / spd,
            maxLife: range / spd,
            color: def.id === 302 ? '#38bdf8' : '#c084fc',
            statusEffect: status,
            knockback: lvlDef.knockback
          });
        }
      } else {
        // Melee / Radial AoE strike
        this.sound.playAttackSnap(def.rarity === 'Legendary' || def.damageType === 'Plating');
        const isRadial = def.id === 182 || def.id === 305;
        this.attackArcs.push({
          x: this.player.x,
          y: this.player.y,
          angle: this.player.angle,
          radius: range,
          color: spec ? '#f472b6' : def.id === 305 ? '#38bdf8' : '#ff6b35',
          life: 0.18,
          maxLife: 0.18
        });

        for (const c of this.director.creatures) {
          if (c.isCharmed || c.hp <= 0) continue;
          const dx = c.x - this.player.x;
          const dy = c.y - this.player.y;
          const d = Math.hypot(dx, dy);
          if (d > range + c.radius) continue;

          if (!isRadial) {
            const angToC = Math.atan2(dy, dx);
            let diffAng = Math.abs(angToC - this.player.angle);
            if (diffAng > Math.PI) diffAng = Math.PI * 2 - diffAng;
            if (diffAng > 1.05) continue;
          }

          this.director.damageCreature(
            c,
            rawDamage,
            status,
            lvlDef.knockback,
            Math.atan2(dy, dx),
            this.player,
            (txt, x, y, col) => this.spawnFloatingText(txt, x, y, col)
          );
          this.spawnParticles(c.x, c.y, '#ffbe0b', 5, 110, 4);
        }
      }
    }
  }

  private endRun(won: boolean, reason: string): void {
    this.isPausedForModal = true;
    this.clearSavedRun();
    this.ui.showEndScreen(
      won,
      reason,
      this.player,
      this.evoSystem,
      this.totalTimeSec,
      this.endlessLevel,
      () => {
        // Continue in Endless (Extinction) Mode!
        this.endlessLevel++;
        this.segmentTimeSec = 0;
        this.director.bannedBossGroups.clear();
        this.director.triggeredBossTimestamps.clear();
        this.player.hp = this.player.stats.MaxHp.value;
        this.player.plating = this.player.stats.MaxPlating.value;
        this.isRunning = true;
        this.isPausedForModal = false;
        this.saveRunState();
        this.spawnFloatingText(`EXTINCTION ${this.endlessLevel} BEGINS!`, this.player.x, this.player.y - 45, '#e11d48');
      },
      () => {
        this.isRunning = false;
        this.openTitleWithSave();
      }
    );
  }

  private saveRunState(): void {
    if (!this.isRunning || this.player.hp <= 0) return;
    try {
      const data = {
        runConfig: this.runConfig,
        segmentTimeSec: this.segmentTimeSec,
        totalTimeSec: this.totalTimeSec,
        endlessLevel: this.endlessLevel,
        secondaryGeneticSpliced: this.secondaryGeneticSpliced,
        activeWeather: this.activeWeather,
        weatherTimer: this.weatherTimer,
        autoAttack: this.autoAttack,
        player: {
          x: this.player.x,
          y: this.player.y,
          angle: this.player.angle,
          hp: this.player.hp,
          plating: this.player.plating,
          xp: this.player.xp,
          level: this.player.level,
          xpToNextLevel: this.player.xpToNextLevel,
          mutagen: this.player.mutagen,
          kills: this.player.kills,
          heatBuildup: this.player.heatBuildup,
          coldBuildup: this.player.coldBuildup,
          soakBuildup: this.player.soakBuildup,
          inBurrow: this.player.inBurrow,
          speedBuffTimer: this.player.speedBuffTimer,
          damageBuffTimer: this.player.damageBuffTimer,
          thermalBuffTimer: this.player.thermalBuffTimer
        },
        evo: {
          ownedEvolutions: Array.from(this.evoSystem.ownedEvolutions.entries()),
          ownedSpecializations: Array.from(this.evoSystem.ownedSpecializations.entries()).map(([k, v]) => [k, v.id]),
          bannedEvolutions: Array.from(this.evoSystem.bannedEvolutions.values()),
          carcinisationLevel: this.evoSystem.carcinisationLevel,
          activeCarcinisationEffects: this.evoSystem.activeCarcinisationEffects,
          freeRerolls: this.evoSystem.freeRerolls,
          remainingBans: this.evoSystem.remainingBans,
          numTimesEvolved: this.evoSystem.numTimesEvolved
        },
        director: {
          triggeredBossTimestamps: Array.from(this.director.triggeredBossTimestamps.values()),
          bannedBossGroups: Array.from(this.director.bannedBossGroups.values())
        },
        usedPoiIds: this.map.pois.filter(p => p.used).map(p => p.id)
      };
      localStorage.setItem(this.saveKey, JSON.stringify(data));
    } catch {
      // Ignore storage quota or sandboxed iframe errors
    }
  }

  private clearSavedRun(): void {
    try {
      localStorage.removeItem(this.saveKey);
    } catch {
      // Ignore
    }
  }

  private getSavedRunSummary(): string | null {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d?.player || !d?.runConfig) return null;
      const mins = Math.floor((d.segmentTimeSec || 0) / 60);
      const secs = Math.floor((d.segmentTimeSec || 0) % 60);
      const t = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      return `Lv.${d.player.level} • ${t} • P${d.runConfig.difficultyLevel}`;
    } catch {
      return null;
    }
  }

  private resumeSavedRun(): void {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      const cfg: RunStartConfig = d.runConfig;
      this.runConfig = cfg;
      const diff = this.getDifficultyData();

      this.player = new PlayerEntity();
      this.map = new WorldMap(cfg.seed, cfg.difficultyLevel, cfg.challengeId);
      this.evoSystem = new EvolutionSystem(diff.startCarc, cfg.difficultyLevel >= 12 ? -2 : 0);
      this.director = new EcosystemDirector();

      this.applyGeneticTrait(cfg.genetic1Id);
      if (d.secondaryGeneticSpliced) {
        this.applyGeneticTrait(cfg.genetic2Id);
      }

      this.evoSystem.ownedEvolutions.clear();
      this.evoSystem.ownedSpecializations.clear();
      this.evoSystem.bannedEvolutions = new Set(d.evo.bannedEvolutions || []);
      this.evoSystem.carcinisationLevel = 0;
      this.evoSystem.activeCarcinisationEffects = [];
      this.evoSystem.freeRerolls = d.evo.freeRerolls ?? 3;
      this.evoSystem.remainingBans = d.evo.remainingBans ?? 3;

      for (const [evoId, targetLvl] of d.evo.ownedEvolutions as Array<[number, number]>) {
        const def = this.evoSystem.allEvolutions.find(e => e.id === evoId);
        if (!def) continue;
        for (let l = 1; l <= targetLvl; l++) {
          this.evoSystem.applyDraftOption(
            { kind: 'evolution', evolution: def, targetLevel: l, isUpgrade: l > 1 },
            this.player.stats
          );
        }
      }
      for (const [, specId] of (d.evo.ownedSpecializations || []) as Array<[number, number]>) {
        const spec = this.evoSystem.allSpecializations.find(s => s.id === specId);
        if (spec) {
          this.evoSystem.applyDraftOption(
            { kind: 'specialization', specialization: spec, targetLevel: 1, isUpgrade: true },
            this.player.stats
          );
        }
      }
      this.evoSystem.carcinisationLevel = d.evo.carcinisationLevel ?? this.evoSystem.carcinisationLevel;
      this.evoSystem.activeCarcinisationEffects = d.evo.activeCarcinisationEffects || [];
      this.evoSystem.numTimesEvolved = d.evo.numTimesEvolved ?? this.evoSystem.numTimesEvolved;

      Object.assign(this.player, d.player);
      this.player.syncMaxHpAndPlating(false);

      this.segmentTimeSec = d.segmentTimeSec ?? 0;
      this.totalTimeSec = d.totalTimeSec ?? 0;
      this.endlessLevel = d.endlessLevel ?? 0;
      this.secondaryGeneticSpliced = !!d.secondaryGeneticSpliced;
      this.activeWeather = d.activeWeather ?? 'None';
      this.weatherTimer = d.weatherTimer ?? 20;
      this.autoAttack = !!d.autoAttack;

      this.director.triggeredBossTimestamps = new Set(d.director?.triggeredBossTimestamps || []);
      this.director.bannedBossGroups = new Set(d.director?.bannedBossGroups || []);

      this.map.ensureRegionsAroundPlayer(this.player.x, this.player.y);
      const usedSet = new Set<string>(d.usedPoiIds || []);
      for (const p of this.map.pois) {
        if (usedSet.has(p.id)) p.used = true;
      }

      this.director.populateInitialEcosystem(this.player, this.map);
      this.attackArcs = [];
      this.floatingTexts = [];
      this.particles = [];
      this.isRunning = true;
      this.isPausedForModal = false;
      this.spawnFloatingText('RUN RESUMED!', this.player.x, this.player.y - 35, '#06d6a0');
    } catch {
      this.clearSavedRun();
      this.openTitleWithSave();
    }
  }
}
