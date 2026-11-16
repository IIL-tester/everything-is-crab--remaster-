import { EVOLUTION_FACTS } from '../data/animalFacts';
import { ASSET_MANIFEST } from '../data/assetManifest';
import worldConfig from '../data/worldConfig.json';
import { EcosystemDirector } from '../ai/EcosystemDirector';
import { PlayerEntity } from '../entities/Entities';
import { DraftOption, EvolutionSystem } from '../evolution/EvolutionSystem';
import { TerrainType } from '../stats/StatValues';

export interface RunStartConfig {
  difficultyLevel: number;
  genetic1Id: number;
  genetic2Id: number;
  challengeId: number;
  seed: number;
}

export class UIManager {
  private root: HTMLElement;
  private hudContainer!: HTMLElement;
  private modalContainer!: HTMLElement;

  private assetUrl(path?: string): string {
    if (!path) return '';
    const base = (window as unknown as { CRAB_ASSET_BASE?: string }).CRAB_ASSET_BASE || '';
    return base ? base + path.replace(/^\.\//, '') : path;
  }

  constructor(root: HTMLElement) {
    this.root = root;
    this.initDOM();
  }

  private initDOM(): void {
    this.root.innerHTML = `
      <div id="hud-root" style="display:flex; flex-direction:column; justify-content:space-between; height:100%; width:100%;">
        <div class="hud-top">
          <div class="pixel-panel stats-bars" id="hud-left"></div>
          <div class="pixel-panel clock-card pointer-auto" id="hud-center"></div>
          <div class="pixel-panel stats-bars pointer-auto" id="hud-right" style="min-width:255px;"></div>
        </div>
        <div id="boss-banner-slot"></div>
        <div class="hud-bottom">
          <div class="ability-strip" id="hud-abilities"></div>
          <div class="pixel-panel minimap-box pointer-auto">
            <canvas id="minimap-canvas" width="128" height="128"></canvas>
            <div style="font-size:10px; color:#cbd5e1; text-align:center;">
              WASD Move &bull; LMB/RMB Attack<br/>SPACE Dash &bull; E Burrow/POI &bull; T Auto
            </div>
          </div>
        </div>
      </div>
      <div id="modal-root" class="modal-overlay hidden"></div>
    `;
    this.hudContainer = this.root.querySelector('#hud-root') as HTMLElement;
    this.modalContainer = this.root.querySelector('#modal-root') as HTMLElement;
  }

  public getMinimapCanvas(): HTMLCanvasElement | null {
    return this.hudContainer.querySelector('#minimap-canvas');
  }

  public showTitleScreen(onStartRun: (cfg: RunStartConfig) => void): void {
    this.modalContainer.classList.remove('hidden');
    const diffOptions = worldConfig.difficulties
      .map(d => `<option value="${d.level}" ${d.level === 1 ? 'selected' : ''}>${d.name}</option>`)
      .join('');
    const genOptions = worldConfig.genetics
      .map(g => `<option value="${g.id}">${g.name} — ${g.description}</option>`)
      .join('');
    const chalOptions = worldConfig.challenges
      .map(c => `<option value="${c.id}">${c.name}</option>`)
      .join('');

    this.modalContainer.innerHTML = `
      <div class="modal-box">
        <div style="display:flex; align-items:center; justify-content:center; gap:18px; margin-bottom:8px;">
          <img src="${this.assetUrl(ASSET_MANIFEST.player.body)}" alt="Darwin" style="width:48px; height:48px; object-fit:contain;" />
          <div>
            <div class="modal-title" style="margin-bottom:2px;">EVERYTHING IS CRAB</div>
            <div class="modal-subtitle" style="margin-bottom:0;">The Animal Evolution Roguelite</div>
          </div>
          <img src="${this.assetUrl(ASSET_MANIFEST.creatures[1180])}" alt="Krabken" style="width:56px; height:56px; object-fit:contain;" />
        </div>
        <div style="height:2px; background:#2f2623; margin:12px 0 16px 0;"></div>
        <div class="form-grid">
          <div class="form-group">
            <label>Pressure (Difficulty)</label>
            <select id="sel-diff">${diffOptions}</select>
          </div>
          <div class="form-group">
            <label>Challenge Mode</label>
            <select id="sel-chal">${chalOptions}</select>
          </div>
          <div class="form-group">
            <label>Primary Genetics</label>
            <select id="sel-gen1">${genOptions}</select>
          </div>
          <div class="form-group">
            <label>Spliced Genetics (0:30)</label>
            <select id="sel-gen2">${genOptions}</select>
          </div>
        </div>
        <div style="background:#0f172a; border:2px solid #334155; padding:10px 14px; margin-bottom:16px; font-size:12px; line-height:1.5; color:#cbd5e1;">
          Play as <b style="color:#07acdc;">Darwin</b>, a squishy blue blob! Eat berries, mushrooms &amp; prey to evolve crab parts, outrank predators with <b style="color:#ffbe0b;">Apex Score</b>, and defeat bosses at <b style="color:#f43f5e;">4:00, 8:00, 12:00 &amp; 16:00</b>.<br/>
          <span style="color:#94a3b8;">Controls: WASD Move &bull; Mouse Aim &bull; LMB/RMB Attack (T = Auto-Attack) &bull; SPACE Dash &bull; E Burrow/POI</span>
        </div>
        <div style="display:flex; justify-content:center;">
          <button class="btn" id="btn-start-run" style="font-size:18px; padding:12px 38px;">EVOLVE &amp; SURVIVE!</button>
        </div>
      </div>
    `;

    const gen2 = this.modalContainer.querySelector('#sel-gen2') as HTMLSelectElement;
    if (gen2 && gen2.options.length > 1) gen2.selectedIndex = 1;

    this.modalContainer.querySelector('#btn-start-run')?.addEventListener('click', () => {
      const difficultyLevel = Number((this.modalContainer.querySelector('#sel-diff') as HTMLSelectElement).value);
      const challengeId = Number((this.modalContainer.querySelector('#sel-chal') as HTMLSelectElement).value);
      const genetic1Id = Number((this.modalContainer.querySelector('#sel-gen1') as HTMLSelectElement).value);
      const genetic2Id = Number((this.modalContainer.querySelector('#sel-gen2') as HTMLSelectElement).value);
      this.modalContainer.classList.add('hidden');
      onStartRun({
        difficultyLevel,
        genetic1Id,
        genetic2Id,
        challengeId,
        seed: Math.floor(Math.random() * 999999) + 1
      });
    });
  }

  public showDraftModal(
    playerLevel: number,
    isBossFruit: boolean,
    evoSystem: EvolutionSystem,
    currentMutagen: number,
    onSpendMutagen: (cost: number) => boolean,
    onPick: (opt: DraftOption) => void
  ): void {
    let mutagen = currentMutagen;
    const MUTAGEN_REROLL_COST = 10;

    const renderCards = () => {
      const options = evoSystem.generateDraftOptions(playerLevel, isBossFruit, 3);
      this.modalContainer.classList.remove('hidden');

      const cardsHtml = options
        .map((opt, idx) => {
          if (opt.kind === 'specialization' && opt.specialization) {
            const s = opt.specialization;
            return `
              <div class="draft-card rarity-${s.rarity}" data-idx="${idx}">
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:11px; color:#f472b6; margin-bottom:4px;">
                    <span>SPECIALIZATION</span>
                    <span>${s.rarity.toUpperCase()}</span>
                  </div>
                  <div style="font-size:17px; color:#fff; margin-bottom:6px;">${s.name}</div>
                  <div style="font-size:12px; color:#cbd5e1; margin-bottom:8px;">${s.description}</div>
                </div>
                <div style="font-size:11px; color:#fde047;">
                  +${Math.round(s.damageMultiplierBonus * 100)}% Damage &bull; +${s.carcinisationGain} Crab
                </div>
              </div>
            `;
          }

          const e = opt.evolution!;
          const lvlDef = e.levels[opt.targetLevel - 1] || e.levels[0];
          const iconPath = this.assetUrl(ASSET_MANIFEST.evolutionIcons[e.id] || ASSET_MANIFEST.evolutionParts[e.id]);
          const fact = EVOLUTION_FACTS[e.id] || '';
          const bonusSummary = Object.entries(lvlDef.statBonuses)
            .map(([k, v]) => {
              const parts: string[] = [];
              if (v.flat) parts.push(`${v.flat > 0 ? '+' : ''}${v.flat}`);
              if (v.pct) parts.push(`${v.pct > 0 ? '+' : ''}${Math.round(v.pct * 100)}%`);
              return `${k}: ${parts.join(' ')}`;
            })
            .join(' &bull; ');

          return `
            <div class="draft-card rarity-${e.rarity}" data-idx="${idx}">
              <div>
                <div style="display:flex; justify-content:space-between; font-size:11px; color:#94a3b8; margin-bottom:6px;">
                  <span>${e.bodyPart.toUpperCase()} &bull; ${e.primaryAffinity}</span>
                  <span style="color:#ffbe0b;">${opt.isUpgrade ? `LV ${opt.targetLevel - 1} -> ${opt.targetLevel}` : 'NEW'}</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                  ${iconPath ? `<img src="${iconPath}" alt="" style="width:44px; height:44px; object-fit:contain; background:#0f172a; border:2px solid #334155; padding:3px;" />` : ''}
                  <div style="font-size:16px; color:#fff;">${e.name}</div>
                </div>
                <div style="font-size:12px; color:#e2e8f0; margin-bottom:8px;">${e.description}</div>
                ${bonusSummary ? `<div style="font-size:11px; color:#38bdf8; margin-bottom:8px;">${bonusSummary}</div>` : ''}
                ${fact ? `<div class="fact-box">FACT: ${fact}</div>` : ''}
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#fbbf24; margin-top:4px;">
                <span>${e.rarity.toUpperCase()}</span>
                <span>${!opt.isUpgrade && e.carcinisationGain > 0 ? `+${e.carcinisationGain} CRAB` : 'NO CRAB'}</span>
              </div>
              ${
                evoSystem.remainingBans > 0 && !isBossFruit
                  ? `<button class="btn btn-secondary btn-ban" data-evoid="${e.id}" style="margin-top:4px; padding:4px 8px; font-size:11px;">Ban (${evoSystem.remainingBans} left)</button>`
                  : ''
              }
            </div>
          `;
        })
        .join('');

      const canFreeReroll = evoSystem.freeRerolls > 0;
      const canMutagenReroll = !canFreeReroll && mutagen >= MUTAGEN_REROLL_COST;
      const rerollLabel = canFreeReroll
        ? `Reroll (${evoSystem.freeRerolls} Free)`
        : `Reroll (${MUTAGEN_REROLL_COST} Mutagen • Have ${mutagen})`;

      this.modalContainer.innerHTML = `
        <div class="modal-box">
          <div class="modal-title">${isBossFruit ? 'BOSS FRUIT MUTATION!' : `LEVEL ${playerLevel} EVOLUTION`}</div>
          <div class="modal-subtitle">Choose an evolution to attach to Darwin</div>
          <div class="draft-cards">${cardsHtml}</div>
          <div style="display:flex; justify-content:center; gap:12px;">
            <button class="btn btn-secondary" id="btn-reroll" ${!canFreeReroll && !canMutagenReroll ? 'disabled' : ''}>
              ${rerollLabel}
            </button>
          </div>
        </div>
      `;

      this.modalContainer.querySelectorAll('.draft-card').forEach(card => {
        card.addEventListener('click', ev => {
          const target = ev.target as HTMLElement;
          if (target.classList.contains('btn-ban')) return;
          const idx = Number((card as HTMLElement).dataset.idx);
          const chosen = options[idx];
          if (chosen) {
            this.modalContainer.classList.add('hidden');
            onPick(chosen);
          }
        });
      });

      this.modalContainer.querySelectorAll('.btn-ban').forEach(btn => {
        btn.addEventListener('click', ev => {
          ev.stopPropagation();
          const evoId = Number((btn as HTMLElement).dataset.evoid);
          if (evoSystem.banEvolution(evoId)) {
            renderCards();
          }
        });
      });

      this.modalContainer.querySelector('#btn-reroll')?.addEventListener('click', () => {
        if (evoSystem.freeRerolls > 0) {
          evoSystem.freeRerolls--;
          renderCards();
        } else if (onSpendMutagen(MUTAGEN_REROLL_COST)) {
          mutagen -= MUTAGEN_REROLL_COST;
          renderCards();
        }
      });
    };

    renderCards();
  }

  public showEndScreen(
    won: boolean,
    reason: string,
    player: PlayerEntity,
    evoSystem: EvolutionSystem,
    elapsedSec: number,
    endlessLevel: number,
    onContinueEndless: () => void,
    onRestart: () => void
  ): void {
    this.modalContainer.classList.remove('hidden');
    const mins = Math.floor(elapsedSec / 60);
    const secs = Math.floor(elapsedSec % 60);

    this.modalContainer.innerHTML = `
      <div class="modal-box" style="text-align:center;">
        <div class="modal-title" style="color:${won ? '#06d6a0' : '#ef476f'};">
          ${won ? 'APEX VICTORY — ECOSYSTEM CONQUERED!' : "GOT DARWIN'D! — EXTINCTION"}
        </div>
        <div class="modal-subtitle">Outcome: <b>${reason}</b></div>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin:18px 0; text-align:left;">
          <div class="pixel-panel"><b>Time:</b> ${mins}m ${secs}s (Ext ${endlessLevel})</div>
          <div class="pixel-panel"><b>Level:</b> ${player.level} (${evoSystem.numTimesEvolved} Evos)</div>
          <div class="pixel-panel"><b>Apex Score:</b> ${player.stats.ApexPredator.value.toFixed(1)}</div>
          <div class="pixel-panel"><b>Carcinisation:</b> ${evoSystem.carcinisationLevel} / 10</div>
          <div class="pixel-panel"><b>Kills:</b> ${player.kills}</div>
          <div class="pixel-panel"><b>Mutagen:</b> ${player.mutagen}</div>
        </div>
        <div style="display:flex; justify-content:center; gap:14px;">
          ${
            won
              ? `<button class="btn" id="btn-endless" style="background:#9333ea;">ENTER ENDLESS (EXT ${endlessLevel + 1})</button>`
              : ''
          }
          <button class="btn" id="btn-restart-run">NEW RUN</button>
        </div>
      </div>
    `;

    this.modalContainer.querySelector('#btn-endless')?.addEventListener('click', () => {
      this.modalContainer.classList.add('hidden');
      onContinueEndless();
    });

    this.modalContainer.querySelector('#btn-restart-run')?.addEventListener('click', () => {
      this.modalContainer.classList.add('hidden');
      onRestart();
    });
  }

  public updateHUD(
    player: PlayerEntity,
    evoSystem: EvolutionSystem,
    director: EcosystemDirector,
    segmentTimeSec: number,
    isNight: boolean,
    terrain: TerrainType,
    weather: string,
    difficultyLevel: number,
    endlessLevel: number,
    autoAttack: boolean,
    actions: {
      onToggleAutoAttack: () => boolean;
      onToggleMute: () => boolean;
    }
  ): void {
    const left = this.hudContainer.querySelector('#hud-left') as HTMLElement;
    const center = this.hudContainer.querySelector('#hud-center') as HTMLElement;
    const right = this.hudContainer.querySelector('#hud-right') as HTMLElement;
    const bossSlot = this.hudContainer.querySelector('#boss-banner-slot') as HTMLElement;
    const abilitiesEl = this.hudContainer.querySelector('#hud-abilities') as HTMLElement;

    const maxHp = Math.max(1, Math.round(player.stats.MaxHp.value));
    const curHp = Math.ceil(player.hp);
    const maxPlating = Math.round(player.stats.MaxPlating.value);
    const curPlating = Math.ceil(player.plating);
    const xpPct = Math.min(100, (player.xp / Math.max(1, player.xpToNextLevel)) * 100);
    const drPct = Math.round(player.stats.getDamageReductionFraction(difficultyLevel) * 100);
    const dodgePct = Math.round(
      Math.min(0.75, player.stats.DodgeChance.value + player.missedDodgeRollsInARow * 0.015) * 100
    );

    const tempPct = Math.round(Math.max(player.heatBuildup, player.coldBuildup) * 100);
    const tempLabel = player.heatBuildup >= player.coldBuildup ? 'HEAT' : 'COLD';
    const tempColor = player.heatBuildup >= player.coldBuildup ? '#fb923c' : '#38bdf8';

    left.innerHTML = `
      <div class="bar-row">
        <span class="bar-label">HP</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${Math.min(100, (curHp / maxHp) * 100)}%; background:var(--hp-green);"></div>
          <div class="bar-text">${curHp} / ${maxHp}</div>
        </div>
      </div>
      <div class="bar-row">
        <span class="bar-label">Plating</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${maxPlating > 0 ? Math.min(100, (curPlating / maxPlating) * 100) : 0}%; background:var(--plating-cyan);"></div>
          <div class="bar-text">${curPlating} / ${maxPlating}</div>
        </div>
      </div>
      <div class="bar-row">
        <span class="bar-label">Lv.${player.level}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${xpPct}%; background:var(--xp-green);"></div>
          <div class="bar-text">${Math.floor(player.xp)} / ${player.xpToNextLevel} CAL</div>
        </div>
      </div>
      <div class="bar-row">
        <span class="bar-label">${tempLabel}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${tempPct}%; background:${tempColor};"></div>
          <div class="bar-text">${tempPct}% &bull; Soak ${Math.round(player.soakBuildup * 100)}%</div>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:11px; color:#94a3b8; margin-top:2px;">
        <span>DR:${drPct}%</span>
        <span>Dodge:${dodgePct}%</span>
        <span>Dmg:${Math.round(player.stats.BasePhysicalDamage.value)}</span>
      </div>
    `;

    const mins = Math.floor(segmentTimeSec / 60);
    const secs = Math.floor(segmentTimeSec % 60);
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} / 16:00`;
    const runPct = Math.min(100, (segmentTimeSec / 960) * 100);

    center.innerHTML = `
      <div class="clock-time">${timeStr}</div>
      <div class="timeline-track">
        <div class="timeline-fill" style="width:${runPct}%;"></div>
        <div class="timeline-marker ${segmentTimeSec >= 240 ? 'done' : ''}" style="left:25%;" title="4:00 Boss">B1</div>
        <div class="timeline-marker ${segmentTimeSec >= 480 ? 'done' : ''}" style="left:50%;" title="8:00 Boss">B2</div>
        <div class="timeline-marker ${segmentTimeSec >= 720 ? 'done' : ''}" style="left:75%;" title="12:00 Boss">B3</div>
        <div class="timeline-marker ${segmentTimeSec >= 960 ? 'done' : ''}" style="left:98%;" title="16:00 Krabken">K</div>
      </div>
      <div style="font-size:11px; color:#94a3b8;">
        ${director.activeBoss ? 'BOSS FIGHT — CLOCK PAUSED' : `${isNight ? 'NIGHT' : 'DAY'} ${endlessLevel > 0 ? `• EXT ${endlessLevel}` : ''}`}
      </div>
      <div class="badges-row">
        <span class="badge">${terrain}</span>
        <span class="badge">${weather === 'None' ? 'Clear' : weather}</span>
        <span class="badge">P${difficultyLevel}</span>
      </div>
    `;

    const charmedCount = director.creatures.filter(c => c.isCharmed).length;
    const carcPips = Array.from({ length: 10 }, (_, i) => {
      const filled = i < evoSystem.carcinisationLevel;
      const isThresh = i === 3 || i === 6 || i === 9;
      return `<span style="display:inline-block; width:10px; height:10px; border:1px solid ${isThresh ? '#ffbe0b' : '#2f2623'}; background:${filled ? '#f43f5e' : '#0f172a'}; margin-right:2px;"></span>`;
    }).join('');

    if (!right.querySelector('#hud-btn-auto')) {
      right.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-size:12px;">
          <span style="color:#94a3b8;">APEX SCORE</span>
          <b id="hud-apex-val" style="color:#ffbe0b;"></b>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:12px; align-items:center;">
          <span style="color:#94a3b8;">CRAB</span>
          <span id="hud-carc-pips"></span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:12px;">
          <span style="color:#94a3b8;">MUTAGEN</span>
          <b id="hud-mut-val" style="color:#c084fc;"></b>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:12px;">
          <span style="color:#94a3b8;">PACK / KILLS</span>
          <b id="hud-kills-val" style="color:#06d6a0;"></b>
        </div>
        <div style="display:flex; gap:6px; margin-top:4px;">
          <button class="btn btn-secondary" id="hud-btn-auto" style="flex:1; padding:3px 6px; font-size:10px;"></button>
          <button class="btn btn-secondary" id="hud-btn-mute" style="padding:3px 8px; font-size:10px;">SFX:ON</button>
        </div>
      `;
      right.querySelector('#hud-btn-auto')?.addEventListener('click', () => actions.onToggleAutoAttack());
      right.querySelector('#hud-btn-mute')?.addEventListener('click', ev => {
        const muted = actions.onToggleMute();
        (ev.target as HTMLElement).textContent = muted ? 'SFX:OFF' : 'SFX:ON';
      });
    }
    (right.querySelector('#hud-apex-val') as HTMLElement).textContent = player.stats.ApexPredator.value.toFixed(1);
    (right.querySelector('#hud-carc-pips') as HTMLElement).innerHTML = carcPips;
    (right.querySelector('#hud-mut-val') as HTMLElement).textContent = String(player.mutagen);
    (right.querySelector('#hud-kills-val') as HTMLElement).textContent = `${charmedCount} / ${player.kills}`;
    (right.querySelector('#hud-btn-auto') as HTMLElement).textContent = autoAttack ? 'AUTO:ON [T]' : 'MANUAL [T]';

    // Boss Banner
    if (director.activeBoss) {
      const enc = director.activeBoss;
      const totalHp = enc.bosses.reduce((s, b) => s + Math.max(0, b.hp), 0);
      const totalMaxHp = enc.bosses.reduce((s, b) => s + b.maxHp, 0);
      const pct = Math.min(100, (totalHp / Math.max(1, totalMaxHp)) * 100);
      bossSlot.innerHTML = `
        <div class="boss-banner">
          <div style="font-size:14px; color:#fda4af; margin-bottom:4px;">
            ${enc.label} — ${enc.cataclysmActive ? 'CATACLYSM METEOR SHOWER!' : `${Math.ceil(enc.timer)}s`}
          </div>
          <div class="bar-track" style="height:14px;">
            <div class="bar-fill" style="width:${pct}%; background:#f43f5e;"></div>
            <div class="bar-text">${Math.ceil(totalHp)} / ${totalMaxHp} HP</div>
          </div>
        </div>
      `;
    } else {
      bossSlot.innerHTML = '';
    }

    // Owned Evolutions Strip
    const slotsHtml: string[] = [];
    let atkIdx = 0;
    for (const [evoId, lvl] of evoSystem.ownedEvolutions.entries()) {
      const def = evoSystem.allEvolutions.find(e => e.id === evoId);
      if (!def) continue;
      const spec = evoSystem.ownedSpecializations.get(evoId);
      const lvlDef = def.levels[lvl - 1] || def.levels[0];
      const remCd = evoSystem.abilityCooldownTimers.get(evoId) ?? 0;
      const cdPct = lvlDef.cooldown > 0 ? Math.min(100, (remCd / lvlDef.cooldown) * 100) : 0;
      const iconPath = this.assetUrl(ASSET_MANIFEST.evolutionIcons[evoId] || ASSET_MANIFEST.evolutionParts[evoId]);

      let keyTag = '';
      if (def.category === 'Dash') keyTag = 'SPC';
      else if (lvlDef.cooldown > 0 && lvlDef.damageMultiplier > 0) {
        keyTag = atkIdx === 0 ? 'LMB' : atkIdx === 1 ? 'RMB' : '';
        atkIdx++;
      }

      slotsHtml.push(`
        <div class="ability-slot rarity-${spec ? spec.rarity : def.rarity}">
          ${keyTag ? `<span class="ability-slot-key">${keyTag}</span>` : ''}
          <div class="ability-slot-cd" style="height:${cdPct}%;"></div>
          ${iconPath ? `<img src="${iconPath}" alt="" style="width:26px; height:26px; object-fit:contain; z-index:2;" />` : ''}
          <div class="ability-slot-name">${spec ? spec.name : def.name}</div>
          <div class="ability-slot-lvl">LV ${lvl}${spec ? '★' : ''}</div>
        </div>
      `);
    }
    abilitiesEl.innerHTML = slotsHtml.join('');
  }
}
