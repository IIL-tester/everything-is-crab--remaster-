import { GameEngine } from './engine/GameEngine';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiLayer = document.getElementById('ui-layer') as HTMLElement;
  if (canvas && uiLayer) {
    new GameEngine(canvas, uiLayer);
  }
});
