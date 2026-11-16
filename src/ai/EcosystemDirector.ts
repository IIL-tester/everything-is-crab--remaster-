import creaturesData from '../data/creatures.json';
import worldConfig from '../data/worldConfig.json';
import {
  CataclysmMeteor,
  CreatureEntity,
  CreatureRank,
  CreatureTemplate,
  FloatingText,
  FoodItem,
  FoodKind,
  PlayerEntity,
  Projectile
} from '../entities/Entities';
import { EvolutionSystem } from '../evolution/EvolutionSystem';
import { WorldMap } from '../world/WorldMap';

export interface ActiveBossEncounter {
  bosses: CreatureEntity[];
  arenaX: number;
  arenaY: number;
  arenaRadius: number;
  timer: number;
  maxTimer: number;
  isFinalBoss: boolean;
  cataclysmActive: boolean;
  cataclysmElapsed: number;
  wasKilledByMeteor: boolean;
  label: string;
}

export class EcosystemDirector {
  public readonly templates: CreatureTemplate[] = creaturesData as unknown as CreatureTemplate[];
  public creatures: CreatureEntity[] = [];
  public foods: FoodItem[] = [];
  public projectiles: Projectile[] = [];
  public meteors: CataclysmMeteor[] = [];

  public activeBoss: ActiveBossEncounter | null = null;
  public bannedBossGroups = new Set<string>();
  public triggeredBossTimestamps = new Set<number>();

  private nextUid = 1;
  private spawnTimer = 0;
  private charmTickTimer = 0;
  private tentacleSpawnTimer = 0;
  private meteorSpawnTimer = 0;
  private hpFoodPityBonus = 0;

  public makeUid(prefix: string): string {
    return `${prefix}_${this.nextUid++}`;
  }

  /**
   * GlobalEnemyStatProgressionData.asset curves evaluated at normalized progress time (t = 0..1 at 16m)
   */
  public getProgressionMultipliers(
    progressTimeSec: number,
    endlessLevel: number,
    diffHpMult: number,
    diffDmgMult: number,
    isFrenzy: boolean
  ): { hpMult: number; dmgMult: number; spdMult: number; alphaChance: number } {
    const t = Math.max(0, progressTimeSec / 960.0);
    const endlessMult = endlessLevel > 0 ? 1.8 + endlessLevel * 0.35 : 1.0;

    // 0.5x at t=0 -> 3.0x at t=1.0
    const timeHp = (0.5 + 2.5 * Math.min(2.5, t)) * endlessMult;
    const timeDmg = (0.5 + 2.5 * Math.min(2.5, t)) * endlessMult;
    const timeSpd = 0.9 + 0.4 * Math.min(1.5, t);
    const alphaChance = Math.min(0.55, 0.02 + t * 0.36);

    return {
      hpMult: timeHp * diffHpMult * (isFrenzy ? 1.35 : 1.0),
      dmgMult: timeDmg * diffDmgMult,
      spdMult: timeSpd * (isFrenzy ? 1.25 : 1.0),
      alphaChance
    };
  }

  public populateInitialEcosystem(player: PlayerEntity, map: WorldMap): void {
    for (let i = 0; i < 28; i++) {
      this.spawnRandomFoodAround(player.x, player.y, 120, 680, 0, player);
    }
    for (let i = 0; i < 14; i++) {
      this.spawnAmbientCreature(player, map, 0, 0, 1.0, 1.0, false);
    }
  }

  public spawnRandomFoodAround(
    cx: number,
    cy: number,
    minDist: number,
    maxDist: number,
    progressTimeSec: number,
    player: PlayerEntity
  ): void {
    if (this.foods.length >= worldConfig.worldConsts.MAX_ALLOWED_FOOD_ON_MAP) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;

    // HP Food check with pity when player HP < 75%
    const hpRatio = player.hp / Math.max(1, player.stats.MaxHp.value);
    const hpFoodChance = (hpRatio < 0.75 ? 0.12 : 0.04) + this.hpFoodPityBonus;
    if (Math.random() < hpFoodChance) {
      this.hpFoodPityBonus = 0;
      this.foods.push({
        uid: this.makeUid('food'),
        kind: 'HpFood',
        x,
        y,
        xpValue: 4,
        healValue: 22,
        platingValue: 0,
        radius: 11,
        bobPhase: Math.random() * 6.28
      });
      return;
    } else if (hpRatio < 0.6) {
      this.hpFoodPityBonus = Math.min(0.25, this.hpFoodPityBonus + 0.01);
    }

    // Mushroom spawn check (8% chance)
    if (Math.random() < 0.08) {
      const effects: Array<'SpeedBoost' | 'DamageFrenzy' | 'ThermalShield' | 'MutagenBurst'> = [
        'SpeedBoost',
        'DamageFrenzy',
        'ThermalShield',
        'MutagenBurst'
      ];
      this.foods.push({
        uid: this.makeUid('food'),
        kind: 'Mushroom',
        x,
        y,
        xpValue: 10,
        healValue: 0,
        platingValue: 0,
        mushroomEffect: effects[Math.floor(Math.random() * effects.length)],
        radius: 13,
        bobPhase: Math.random() * 6.28
      });
      return;
    }

    // Standard Food Rarity brackets from TimeManagementData_FullRun.asset
    const t = progressTimeSec / 960.0;
    const r = Math.random();
    let kind: FoodKind = 'Common';
    let xpVal = 6;
    let rad = 9;
    if (t > 0.22 && r < 0.08 + t * 0.15) {
      kind = 'Legendary';
      xpVal = 36;
      rad = 15;
    } else if (t > 0.08 && r < 0.22 + t * 0.25) {
      kind = 'Epic';
      xpVal = 20;
      rad = 13;
    } else if (r < 0.45 + t * 0.2) {
      kind = 'Rare';
      xpVal = 12;
      rad = 11;
    }

    this.foods.push({
      uid: this.makeUid('food'),
      kind,
      x,
      y,
      xpValue: xpVal,
      healValue: 0,
      platingValue: 0,
      radius: rad,
      bobPhase: Math.random() * 6.28
    });
  }

  public spawnAmbientCreature(
    player: PlayerEntity,
    map: WorldMap,
    progressTimeSec: number,
    endlessLevel: number,
    diffHpMult: number,
    diffDmgMult: number,
    isFrenzy: boolean
  ): void {
    if (this.creatures.length >= worldConfig.worldConsts.MAX_ALLOWED_ENEMIES_ON_MAP_HARDCAP) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 420 + Math.random() * 480;
    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;
    const terrain = map.getTerrainAtWorld(x, y);

    const t = progressTimeSec / 960.0;
    const allowedTiers = t < 0.22 ? ['Early'] : t < 0.58 ? ['Early', 'Mid'] : ['Early', 'Mid', 'Late'];

    const pool = this.templates.filter(
      c => c.biome === terrain && allowedTiers.includes(c.tier)
    );
    const chosen =
      pool[Math.floor(Math.random() * pool.length)] ||
      this.templates.find(c => c.id === 10)!;

    const mults = this.getProgressionMultipliers(progressTimeSec, endlessLevel, diffHpMult, diffDmgMult, isFrenzy);

    // Rank roll: Shiny (1/512 enhanced visibility or 1/4096) vs Alpha vs Basic
    let rank: CreatureRank = 'Basic';
    if (Math.random() < 1 / 512) {
      rank = 'Shiny';
    } else if (Math.random() < mults.alphaChance) {
      rank = 'Alpha';
    }

    const rankHpMult = rank === 'Alpha' ? 1.65 : rank === 'Shiny' ? 1.4 : 1.0;
    const rankDmgMult = rank === 'Alpha' ? 1.35 : rank === 'Shiny' ? 1.2 : 1.0;
    const rankSizeMult = rank === 'Alpha' ? 1.22 : rank === 'Shiny' ? 1.12 : 1.0;

    const maxHp = Math.round(chosen.maxHp * mults.hpMult * rankHpMult);
    const maxPlating = Math.round(chosen.maxPlating * mults.hpMult * rankHpMult);
    const size = chosen.size * rankSizeMult;

    this.creatures.push({
      uid: this.makeUid('npc'),
      template: chosen,
      rank,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: Math.random() * Math.PI * 2,
      hp: maxHp,
      maxHp,
      plating: maxPlating,
      maxPlating,
      damage: Math.max(2, Math.round(chosen.baseDamage * mults.dmgMult * rankDmgMult)),
      moveSpeed: chosen.moveSpeed * mults.spdMult,
      chaseSpeed: chosen.chaseSpeed * mults.spdMult,
      size,
      radius: 18 * size,
      apexRank: chosen.apexRank + (rank === 'Alpha' ? 1.2 : 0),
      xpDrop: Math.round(chosen.xpDrop * (rank === 'Shiny' ? 3.0 : rank === 'Alpha' ? 1.75 : 1.0)),
      aiState: 'Wander',
      stateTimer: 1 + Math.random() * 2,
      attackCooldown: 0,
      isCharmed: false,
      charmTimer: 0,
      poisonTimer: 0,
      poisonDps: 0,
      bleedTimer: 0,
      bleedDps: 0,
      stunTimer: 0,
      hitFlash: 0,
      provoked: false
    });
  }

  /**
   * EnemyDirector Boss Spawning & 9x9 Bramble Arena Setup (GAME_SPEC.md Section 1.4.2)
   */
  public startBossEncounter(
    player: PlayerEntity,
    poolIds: number[],
    timeoutSeconds: number,
    isFinalBoss: boolean,
    label: string,
    dualBosses: boolean,
    bossHpMult: number,
    bossDmgMult: number,
    enrageMult: number,
    evoSystem: EvolutionSystem,
    onBossAlarm: () => void
  ): void {
    const validTemplates = poolIds
      .map(id => this.templates.find(t => t.id === id))
      .filter((t): t is CreatureTemplate => !!t && (!t.group || !this.bannedBossGroups.has(t.group)));

    const candidatePool =
      validTemplates.length > 0
        ? validTemplates
        : poolIds.map(id => this.templates.find(t => t.id === id)!).filter(Boolean);

    const primaryTemplate = candidatePool[Math.floor(Math.random() * candidatePool.length)];
    if (!primaryTemplate) return;
    if (primaryTemplate.group && !isFinalBoss) {
      this.bannedBossGroups.add(primaryTemplate.group);
    }

    const arenaX = player.x;
    const arenaY = player.y - 70;
    const arenaRadius = 350;

    const spawnBossEntity = (tmpl: CreatureTemplate, offsetX: number): CreatureEntity => {
      const multiBossScale = dualBosses && !isFinalBoss ? 0.75 : 1.0;
      const carcScale = 1.0 + evoSystem.carcinisationLevel * 0.04;
      const maxHp = Math.round(tmpl.maxHp * bossHpMult * multiBossScale * carcScale);
      const maxPlating = Math.round(tmpl.maxPlating * bossHpMult * multiBossScale * carcScale);
      return {
        uid: this.makeUid('boss'),
        template: tmpl,
        rank: 'Boss',
        x: arenaX + offsetX,
        y: arenaY - 120,
        vx: 0,
        vy: 0,
        angle: Math.PI / 2,
        hp: maxHp,
        maxHp,
        plating: maxPlating,
        maxPlating,
        damage: Math.round(tmpl.baseDamage * bossDmgMult * carcScale),
        moveSpeed: tmpl.moveSpeed,
        chaseSpeed: tmpl.chaseSpeed,
        size: tmpl.size,
        radius: 22 * tmpl.size,
        apexRank: tmpl.apexRank,
        xpDrop: tmpl.xpDrop,
        aiState: 'Chase',
        stateTimer: 10,
        attackCooldown: 1.0,
        isCharmed: false,
        charmTimer: 0,
        poisonTimer: 0,
        poisonDps: 0,
        bleedTimer: 0,
        bleedDps: 0,
        stunTimer: 0,
        hitFlash: 0,
        provoked: true
      };
    };

    const bosses: CreatureEntity[] = [spawnBossEntity(primaryTemplate, dualBosses && !isFinalBoss ? -85 : 0)];
    if (dualBosses && !isFinalBoss && candidatePool.length > 0) {
      const secondTemplate = candidatePool[Math.floor(Math.random() * candidatePool.length)];
      bosses.push(spawnBossEntity(secondTemplate, 85));
    }

    for (const b of bosses) {
      this.creatures.push(b);
    }

    this.activeBoss = {
      bosses,
      arenaX,
      arenaY,
      arenaRadius,
      timer: Math.round(timeoutSeconds * enrageMult),
      maxTimer: Math.round(timeoutSeconds * enrageMult),
      isFinalBoss,
      cataclysmActive: false,
      cataclysmElapsed: 0,
      wasKilledByMeteor: false,
      label
    };

    onBossAlarm();
  }

  public update(
    dt: number,
    player: PlayerEntity,
    map: WorldMap,
    evoSystem: EvolutionSystem,
    progressTimeSec: number,
    endlessLevel: number,
    difficulty: { level: number; enemyHpMult: number; enemyDmgMult: number; bossHpMult: number; bossDmgMult: number; enrageMult: number },
    isNight: boolean,
    isFrenzy: boolean,
    callbacks: {
      onFloatingText: (txt: string, x: number, y: number, col: string) => void;
      onPlayerDamaged: () => void;
      onBossFightEnded: (state: 'Killed' | 'Survived', isFinalBoss: boolean, killedByMeteor: boolean) => void;
      onEatFood: (food: FoodItem) => void;
    }
  ): void {
    // 1. Repopulate ecosystem periodically
    this.spawnTimer += dt;
    if (this.spawnTimer >= 2.2) {
      this.spawnTimer = 0;
      if (this.foods.length < 48) {
        for (let i = 0; i < 4; i++) {
          this.spawnRandomFoodAround(player.x, player.y, 180, 760, progressTimeSec, player);
        }
      }
      if (!this.activeBoss && this.creatures.length < 24) {
        this.spawnAmbientCreature(
          player,
          map,
          progressTimeSec,
          endlessLevel,
          difficulty.enemyHpMult,
          difficulty.enemyDmgMult,
          isFrenzy
        );
      }
    }

    // 2. Passive Charm Pulse (EnemyPassiveCharmController)
    if (player.stats.CharmChance.value > 0) {
      this.charmTickTimer += dt;
      if (this.charmTickTimer >= 3.0) {
        this.charmTickTimer = 0;
        const charmedCount = this.creatures.filter(c => c.isCharmed).length;
        const maxCharm = Math.max(0, player.stats.MaxCharmedCompanions.value + (difficulty.level >= 10 ? -3 : 0));
        if (charmedCount < maxCharm) {
          for (const c of this.creatures) {
            if (c.rank === 'Boss' || c.isCharmed || c.template.behavior === 'Tentacle') continue;
            const d = Math.hypot(c.x - player.x, c.y - player.y);
            if (d <= 210 && Math.random() <= player.stats.CharmChance.value * 0.45) {
              c.isCharmed = true;
              c.charmTimer = 45;
              c.aiState = 'FollowPlayer';
              callbacks.onFloatingText('CHARMED!', c.x, c.y - 24, '#f472b6');
              break;
            }
          }
        }
      }
    }

    // 3. Active Boss Arena & Krabken Tentacle / Cataclysm Logic
    if (this.activeBoss) {
      const enc = this.activeBoss;
      // Keep player inside the 9x9 Bramble Arena ring; CrabbyBramble deals thorn damage on contact
      const distFromCenter = Math.hypot(player.x - enc.arenaX, player.y - enc.arenaY);
      if (distFromCenter > enc.arenaRadius - player.radius) {
        const ang = Math.atan2(player.y - enc.arenaY, player.x - enc.arenaX);
        player.x = enc.arenaX + Math.cos(ang) * (enc.arenaRadius - player.radius);
        player.y = enc.arenaY + Math.sin(ang) * (enc.arenaRadius - player.radius);
        if (evoSystem.activeCarcinisationEffects.includes('CrabbyBramble') && player.hitFlash <= 0) {
          player.takeDamage(
            8,
            'Physical',
            difficulty.level,
            val => this.spawnPlatingShard(player.x, player.y, val),
            (txt, col) => callbacks.onFloatingText(txt, player.x, player.y - 20, col)
          );
        }
      }

      // Check if all bosses in the encounter are dead
      const aliveBosses = enc.bosses.filter(b => b.hp > 0);
      if (aliveBosses.length === 0) {
        const isFinal = enc.isFinalBoss;
        const meteorDeath = enc.wasKilledByMeteor;
        // Spawn Boss Fruit & Legendary Loot at arena center
        this.foods.push({
          uid: this.makeUid('bossfruit'),
          kind: 'BossFruit',
          x: enc.arenaX,
          y: enc.arenaY,
          xpValue: 85,
          healValue: 40,
          platingValue: 30,
          radius: 20,
          bobPhase: 0
        });
        this.activeBoss = null;
        callbacks.onBossFightEnded('Killed', isFinal, meteorDeath);
      } else {
        // Tick boss timeout timer
        if (!enc.cataclysmActive) {
          enc.timer -= dt;
          if (enc.timer <= 0) {
            if (enc.isFinalBoss) {
              // FinalBossNoSurrender (3) -> Trigger Krabken Cataclysm Meteor Shower!
              enc.cataclysmActive = true;
              enc.timer = 0;
              callbacks.onFloatingText('CATACLYSM METEOR SHOWER!', player.x, player.y - 50, '#f43f5e');
            } else {
              // Regular boss timeout -> Boss flees/survives, player gains Carcinisation!
              for (const b of aliveBosses) {
                const idx = this.creatures.indexOf(b);
                if (idx !== -1) this.creatures.splice(idx, 1);
              }
              this.activeBoss = null;
              evoSystem.addCarcinisation(2);
              callbacks.onFloatingText('BOSS SURVIVED! (+2 CARCINISATION)', player.x, player.y - 45, '#fbbf24');
              callbacks.onBossFightEnded('Survived', false, false);
            }
          }
        } else {
          // Cataclysm meteor spawning (Default_KrabkenCataclysmData.asset)
          enc.cataclysmElapsed += dt;
          const normT = Math.min(1.5, enc.cataclysmElapsed / 80.0);
          const interval = Math.max(0.14, 1.1 - normT * 0.75);
          this.meteorSpawnTimer += dt;
          if (this.meteorSpawnTimer >= interval) {
            this.meteorSpawnTimer = 0;
            const targetX = enc.arenaX + (Math.random() * 2 - 1) * (enc.arenaRadius * 0.85);
            const targetY = enc.arenaY + (Math.random() * 2 - 1) * (enc.arenaRadius * 0.85);
            this.meteors.push({
              uid: this.makeUid('meteor'),
              targetX,
              targetY,
              progress: 0,
              fallDuration: 1.15,
              radius: 48 + normT * 24,
              damage: 28
            });
          }
        }

        // Krabken Tentacle Spawner (Default_KrabkenTentacleSpawnerData.asset)
        if (enc.isFinalBoss) {
          const hasMoreTentacles = evoSystem.activeCarcinisationEffects.includes('MoreTentacles');
          const maxTentacles = hasMoreTentacles ? 8 : 5;
          const currentTentacles = this.creatures.filter(c => c.template.id === 2100).length;
          this.tentacleSpawnTimer += dt;
          if (currentTentacles < maxTentacles && this.tentacleSpawnTimer >= (hasMoreTentacles ? 3.8 : 5.2)) {
            this.tentacleSpawnTimer = 0;
            const tentacleTmpl = this.templates.find(t => t.id === 2100)!;
            const ang = Math.random() * Math.PI * 2;
            const dist = 90 + Math.random() * 140;
            const tx = player.x + Math.cos(ang) * dist;
            const ty = player.y + Math.sin(ang) * dist;
            const isProtected = evoSystem.activeCarcinisationEffects.includes('ProtectedTentacles');
            this.creatures.push({
              uid: this.makeUid('tentacle'),
              template: tentacleTmpl,
              rank: Math.random() < 0.2 ? 'Alpha' : 'Basic',
              x: tx,
              y: ty,
              vx: 0,
              vy: 0,
              angle: 0,
              hp: tentacleTmpl.maxHp,
              maxHp: tentacleTmpl.maxHp,
              plating: isProtected ? 45 : tentacleTmpl.maxPlating,
              maxPlating: isProtected ? 45 : tentacleTmpl.maxPlating,
              damage: tentacleTmpl.baseDamage,
              moveSpeed: tentacleTmpl.moveSpeed,
              chaseSpeed: tentacleTmpl.chaseSpeed,
              size: tentacleTmpl.size,
              radius: 18,
              apexRank: tentacleTmpl.apexRank,
              xpDrop: tentacleTmpl.xpDrop,
              aiState: 'Chase',
              stateTimer: 10,
              attackCooldown: 0.8,
              isCharmed: false,
              charmTimer: 0,
              poisonTimer: 0,
              poisonDps: 0,
              bleedTimer: 0,
              bleedDps: 0,
              stunTimer: 0,
              hitFlash: 0,
              provoked: true
            });
          }
        }
      }
    }

    // 4. Update Cataclysm Meteors
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.progress += dt / m.fallDuration;
      if (m.progress >= 1.0) {
        // Impact damage to player and bosses/creatures
        if (Math.hypot(player.x - m.targetX, player.y - m.targetY) <= m.radius + player.radius * 0.6) {
          player.takeDamage(
            m.damage,
            'Cataclysm',
            difficulty.level,
            val => this.spawnPlatingShard(player.x, player.y, val),
            (txt, col) => callbacks.onFloatingText(txt, player.x, player.y - 20, col)
          );
          callbacks.onPlayerDamaged();
        }
        for (const c of this.creatures) {
          if (Math.hypot(c.x - m.targetX, c.y - m.targetY) <= m.radius + c.radius) {
            c.hp -= m.damage * 1.5;
            c.hitFlash = 0.2;
            if (c.hp <= 0 && this.activeBoss && this.activeBoss.bosses.includes(c)) {
              this.activeBoss.wasKilledByMeteor = true;
            }
          }
        }
        this.meteors.splice(i, 1);
      }
    }

    // 5. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.fromPlayer) {
        for (const c of this.creatures) {
          if (c.isCharmed || c.hp <= 0) continue;
          if (Math.hypot(c.x - p.x, c.y - p.y) <= c.radius + p.radius) {
            this.damageCreature(c, p.damage, p.statusEffect, p.knockback, Math.atan2(p.vy, p.vx), player, callbacks.onFloatingText);
            this.projectiles.splice(i, 1);
            break;
          }
        }
      } else {
        if (Math.hypot(player.x - p.x, player.y - p.y) <= player.radius + p.radius) {
          player.takeDamage(
            p.damage,
            'Physical',
            difficulty.level,
            val => this.spawnPlatingShard(player.x, player.y, val),
            (txt, col) => callbacks.onFloatingText(txt, player.x, player.y - 20, col)
          );
          callbacks.onPlayerDamaged();
          this.projectiles.splice(i, 1);
        }
      }
    }

    // 6. Update Creatures AI & Statuses
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];

      // Despawn far non-boss creatures
      const distToPlayer = Math.hypot(c.x - player.x, c.y - player.y);
      if (c.rank !== 'Boss' && distToPlayer > 1150) {
        this.creatures.splice(i, 1);
        continue;
      }

      if (c.hitFlash > 0) c.hitFlash = Math.max(0, c.hitFlash - dt);
      if (c.attackCooldown > 0) c.attackCooldown = Math.max(0, c.attackCooldown - dt);

      // Poison & Bleed DoTs
      if (c.poisonTimer > 0) {
        c.poisonTimer -= dt;
        c.hp -= c.poisonDps * dt;
      }
      if (c.bleedTimer > 0) {
        c.bleedTimer -= dt;
        c.hp -= c.bleedDps * dt;
      }

      // Check Creature Death
      if (c.hp <= 0) {
        this.handleCreatureDeath(c, player, callbacks.onFloatingText);
        this.creatures.splice(i, 1);
        continue;
      }

      if (c.stunTimer > 0) {
        c.stunTimer -= dt;
        continue;
      }

      // Charmed companion behavior
      if (c.isCharmed) {
        c.charmTimer -= dt;
        if (c.charmTimer <= 0) {
          c.isCharmed = false;
        } else {
          // Find nearest hostile creature to attack, else follow player
          let targetHostile: CreatureEntity | null = null;
          let bestDist = 260;
          for (const other of this.creatures) {
            if (other === c || other.isCharmed || other.hp <= 0) continue;
            const d = Math.hypot(other.x - c.x, other.y - c.y);
            if (d < bestDist) {
              bestDist = d;
              targetHostile = other;
            }
          }
          if (targetHostile) {
            const ang = Math.atan2(targetHostile.y - c.y, targetHostile.x - c.x);
            c.angle = ang;
            const spd = c.chaseSpeed * 22;
            c.x += Math.cos(ang) * spd * dt;
            c.y += Math.sin(ang) * spd * dt;
            if (bestDist <= c.radius + targetHostile.radius + 10 && c.attackCooldown <= 0) {
              c.attackCooldown = 1.1;
              this.damageCreature(targetHostile, c.damage, null, 40, ang, player, callbacks.onFloatingText);
            }
          } else if (distToPlayer > 75) {
            const ang = Math.atan2(player.y - c.y, player.x - c.x);
            c.angle = ang;
            const spd = c.moveSpeed * 22;
            c.x += Math.cos(ang) * spd * dt;
            c.y += Math.sin(ang) * spd * dt;
          }
          continue;
        }
      }

      // Standard & Boss AI State Machine (AIDetectionController + Apex Comparison + Living Ecosystem)
      const detectRadius = (isNight ? 210 : 285) * (player.inBurrow ? 0.15 : 1.0);
      const playerApex = player.stats.ApexPredator.value;
      let ecosystemTarget: CreatureEntity | null = null;
      let ecosystemFleeFrom: CreatureEntity | null = null;
      let forageFood: FoodItem | null = null;

      if (c.rank === 'Boss' || c.template.behavior === 'Boss' || c.template.behavior === 'FinalBoss' || c.template.behavior === 'Tentacle') {
        c.aiState = 'Chase';
      } else if (distToPlayer <= detectRadius) {
        if (c.template.behavior === 'Prey') {
          c.aiState = 'Flee';
        } else if (c.template.behavior === 'Scavenger') {
          c.aiState = distToPlayer < 150 ? 'Flee' : 'Forage';
        } else if (c.template.behavior === 'Neutral' || c.template.behavior === 'NeutralGiant') {
          c.aiState = c.provoked ? 'Chase' : 'Wander';
        } else if (c.template.behavior === 'Predator') {
          // Intimidated if player's Apex Predator score far exceeds creature's Apex rank!
          if (!c.provoked && playerApex >= c.apexRank + 2.2) {
            c.aiState = 'Flee';
          } else {
            c.aiState = 'Chase';
          }
        }
      } else {
        // Living Ecosystem: Predators hunt nearby Prey/Scavengers; Prey flee Predators; Scavengers steal food
        if (c.template.behavior === 'Predator') {
          let bestDist = 240;
          for (const other of this.creatures) {
            if (other === c || other.hp <= 0 || other.isCharmed) continue;
            if (other.template.behavior === 'Prey' || other.template.behavior === 'Scavenger') {
              const d = Math.hypot(other.x - c.x, other.y - c.y);
              if (d < bestDist) {
                bestDist = d;
                ecosystemTarget = other;
              }
            }
          }
          c.aiState = ecosystemTarget ? 'Chase' : 'Wander';
        } else if (c.template.behavior === 'Prey') {
          let bestPredDist = 175;
          for (const other of this.creatures) {
            if (other === c || other.hp <= 0) continue;
            if (other.template.behavior === 'Predator') {
              const d = Math.hypot(other.x - c.x, other.y - c.y);
              if (d < bestPredDist) {
                bestPredDist = d;
                ecosystemFleeFrom = other;
              }
            }
          }
          c.aiState = ecosystemFleeFrom ? 'Flee' : 'Wander';
        } else if (c.template.behavior === 'Scavenger') {
          let bestFoodDist = 200;
          for (const f of this.foods) {
            if (f.kind === 'BossFruit') continue;
            const d = Math.hypot(f.x - c.x, f.y - c.y);
            if (d < bestFoodDist) {
              bestFoodDist = d;
              forageFood = f;
            }
          }
          c.aiState = forageFood ? 'Forage' : 'Wander';
        } else {
          c.aiState = 'Wander';
        }
      }

      // Execute AI Movement & Combat
      if (c.aiState === 'Flee') {
        const threatX = ecosystemFleeFrom ? ecosystemFleeFrom.x : player.x;
        const threatY = ecosystemFleeFrom ? ecosystemFleeFrom.y : player.y;
        const ang = Math.atan2(c.y - threatY, c.x - threatX);
        c.angle = ang;
        const spd = c.chaseSpeed * 21;
        c.x += Math.cos(ang) * spd * dt;
        c.y += Math.sin(ang) * spd * dt;
      } else if (c.aiState === 'Forage' && forageFood) {
        const ang = Math.atan2(forageFood.y - c.y, forageFood.x - c.x);
        c.angle = ang;
        const spd = c.chaseSpeed * 18;
        c.x += Math.cos(ang) * spd * dt;
        c.y += Math.sin(ang) * spd * dt;
        if (Math.hypot(forageFood.x - c.x, forageFood.y - c.y) <= c.radius + forageFood.radius + 4) {
          const fIdx = this.foods.indexOf(forageFood);
          if (fIdx !== -1) this.foods.splice(fIdx, 1);
        }
      } else if (c.aiState === 'Chase') {
        const tx = ecosystemTarget ? ecosystemTarget.x : player.x;
        const ty = ecosystemTarget ? ecosystemTarget.y : player.y;
        const targetDist = ecosystemTarget ? Math.hypot(tx - c.x, ty - c.y) : distToPlayer;
        const targetRad = ecosystemTarget ? ecosystemTarget.radius : player.radius;
        const ang = Math.atan2(ty - c.y, tx - c.x);
        c.angle = ang;
        const spd = c.chaseSpeed * 21;
        if (targetDist > c.radius + targetRad - 4) {
          c.x += Math.cos(ang) * spd * dt;
          c.y += Math.sin(ang) * spd * dt;
        }
        // Contact / Melee Attack
        if (targetDist <= c.radius + targetRad + 12 && c.attackCooldown <= 0) {
          c.attackCooldown = isFrenzy ? 0.85 : 1.25;
          if (ecosystemTarget) {
            ecosystemTarget.hp -= c.damage * 0.8;
            ecosystemTarget.hitFlash = 0.14;
          } else {
            const isPoisonTentacle =
              c.template.id === 2100 && evoSystem.activeCarcinisationEffects.includes('PoisonousTentacles');
            player.takeDamage(
              c.damage,
              isPoisonTentacle ? 'Poison' : 'Physical',
              difficulty.level,
              val => this.spawnPlatingShard(player.x, player.y, val),
              (txt, col) => callbacks.onFloatingText(txt, player.x, player.y - 20, col)
            );
            callbacks.onPlayerDamaged();
          }
        } else if (c.rank === 'Boss' && c.attackCooldown <= 0 && targetDist > c.radius + player.radius + 45 && targetDist < 340) {
          // Boss ranged / special projectile attack (Clawdia webs, Aquaconda venom, Krabken ink burst)
          const gid = c.template.id;
          if (gid === 1040 || gid === 1041 || gid === 1042 || gid === 1020 || gid === 1021 || gid === 1022 || gid === 1180) {
            c.attackCooldown = gid === 1180 ? 2.2 : 2.8;
            const bolts = gid === 1180 ? 5 : 1;
            for (let b = 0; b < bolts; b++) {
              const spread = bolts > 1 ? (b - (bolts - 1) / 2) * 0.28 : 0;
              const pAng = ang + spread;
              const pSpd = gid >= 1040 && gid <= 1042 ? 230 : 290;
              this.projectiles.push({
                uid: this.makeUid('bproj'),
                fromPlayer: false,
                x: c.x + Math.cos(pAng) * c.radius,
                y: c.y + Math.sin(pAng) * c.radius,
                vx: Math.cos(pAng) * pSpd,
                vy: Math.sin(pAng) * pSpd,
                damage: Math.max(4, Math.round(c.damage * 0.7)),
                radius: gid >= 1040 && gid <= 1042 ? 10 : 7,
                life: 1.5,
                maxLife: 1.5,
                color: gid >= 1040 && gid <= 1042 ? '#e2e8f0' : gid === 1180 ? '#c084fc' : '#2dd4bf',
                statusEffect: null,
                knockback: 30
              });
            }
          }
        }
      } else {
        // Wander / Forage
        c.stateTimer -= dt;
        if (c.stateTimer <= 0) {
          c.stateTimer = 1.5 + Math.random() * 2.5;
          c.angle += (Math.random() - 0.5) * 2.2;
        }
        const spd = c.moveSpeed * 14;
        c.x += Math.cos(c.angle) * spd * dt;
        c.y += Math.sin(c.angle) * spd * dt;
      }

      // Constrain Boss inside Arena
      if (this.activeBoss && this.activeBoss.bosses.includes(c)) {
        const dArena = Math.hypot(c.x - this.activeBoss.arenaX, c.y - this.activeBoss.arenaY);
        if (dArena > this.activeBoss.arenaRadius - c.radius) {
          const a = Math.atan2(c.y - this.activeBoss.arenaY, c.x - this.activeBoss.arenaX);
          c.x = this.activeBoss.arenaX + Math.cos(a) * (this.activeBoss.arenaRadius - c.radius);
          c.y = this.activeBoss.arenaY + Math.sin(a) * (this.activeBoss.arenaRadius - c.radius);
        }
      }
    }

    // 7. Player Food Collection (magnet pull scales with EatingSpeed)
    const magnetRange = 28 + player.stats.EatingSpeed.value * 16;
    const pullSpeed = 190 * player.stats.EatingSpeed.value;
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      f.bobPhase += dt * 3.5;
      const dx = player.x - f.x;
      const dy = player.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d <= player.radius + f.radius + 6) {
        callbacks.onEatFood(f);
        this.foods.splice(i, 1);
      } else if (d <= magnetRange && d > 1) {
        f.x += (dx / d) * pullSpeed * dt;
        f.y += (dy / d) * pullSpeed * dt;
      }
    }
  }

  public spawnPlatingShard(x: number, y: number, platingVal: number): void {
    const ang = Math.random() * Math.PI * 2;
    const dist = 35 + Math.random() * 35;
    this.foods.push({
      uid: this.makeUid('plating'),
      kind: 'PlatingShard',
      x: x + Math.cos(ang) * dist,
      y: y + Math.sin(ang) * dist,
      xpValue: 2,
      healValue: 0,
      platingValue: platingVal,
      radius: 10,
      bobPhase: 0
    });
  }

  public damageCreature(
    c: CreatureEntity,
    rawDamage: number,
    statusEffect: string | null,
    knockback: number,
    hitAngle: number,
    player: PlayerEntity,
    onFloatingText: (txt: string, x: number, y: number, col: string) => void
  ): void {
    c.provoked = true;
    let dmg = rawDamage * (player.damageBuffTimer > 0 ? 1.4 : 1.0);

    // Absorb with creature Plating first
    if (c.plating > 0) {
      if (c.plating >= dmg) {
        c.plating -= dmg;
        c.hitFlash = 0.12;
        onFloatingText(`-${Math.round(dmg)}`, c.x, c.y - 18, '#4cc9f0');
        return;
      } else {
        dmg -= c.plating;
        c.plating = 0;
      }
    }

    c.hp -= dmg;
    c.hitFlash = 0.15;
    onFloatingText(`-${Math.round(dmg)}`, c.x, c.y - 18, '#ffbe0b');

    // Knockback (Bosses have 50% Stun & Knockback resistance per *_EnemyStats.asset)
    const kbMult = c.rank === 'Boss' ? 0.35 : 1.0;
    c.x += Math.cos(hitAngle) * knockback * 0.18 * kbMult;
    c.y += Math.sin(hitAngle) * knockback * 0.18 * kbMult;

    // Apply Status Effects
    if (statusEffect === 'Poison') {
      c.poisonTimer = 4.0;
      c.poisonDps = Math.max(3, rawDamage * 0.28 * player.stats.PoisonDamagePercentage.value);
    } else if (statusEffect === 'Bleed') {
      c.bleedTimer = 3.0;
      c.bleedDps = Math.max(3, rawDamage * 0.25);
    } else if (statusEffect === 'Stun') {
      c.stunTimer = c.rank === 'Boss' ? 0.45 : 0.95;
    } else if (statusEffect === 'Lifesteal') {
      const heal = Math.max(2, dmg * 0.3);
      player.hp = Math.min(player.stats.MaxHp.value, player.hp + heal);
      onFloatingText(`+${Math.round(heal)} HP`, player.x, player.y - 28, '#06d6a0');
    }
  }

  private handleCreatureDeath(
    c: CreatureEntity,
    player: PlayerEntity,
    onFloatingText: (txt: string, x: number, y: number, col: string) => void
  ): void {
    player.kills++;
    const mutagenGain = c.rank === 'Boss' ? 25 : c.rank === 'Shiny' ? 15 : c.rank === 'Alpha' ? 4 : 1;
    player.mutagen = Math.min(999, player.mutagen + mutagenGain);

    // Drop meat / food cluster on death (DropItemsOnDeath.cs)
    const dropKind: FoodKind =
      c.rank === 'Boss' || c.rank === 'Shiny'
        ? 'Legendary'
        : c.rank === 'Alpha' || c.template.tier === 'Late'
        ? 'Epic'
        : c.template.tier === 'Mid'
        ? 'Rare'
        : 'Common';

    this.foods.push({
      uid: this.makeUid('drop'),
      kind: dropKind,
      x: c.x,
      y: c.y,
      xpValue: c.xpDrop,
      healValue: c.rank === 'Alpha' ? 10 : 0,
      platingValue: 0,
      radius: 13,
      bobPhase: 0
    });

    onFloatingText(`+${c.xpDrop} CAL`, c.x, c.y, '#06d6a0');
  }
}
