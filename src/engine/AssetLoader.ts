import { ASSET_MANIFEST } from '../data/assetManifest';

export class AssetLoader {
  private images = new Map<string, HTMLImageElement>();
  public loadedCount = 0;
  public totalCount = 0;

  public async preloadAll(): Promise<void> {
    const paths = new Set<string>();
    if (ASSET_MANIFEST.player.body) paths.add(ASSET_MANIFEST.player.body);
    if (ASSET_MANIFEST.player.arms) paths.add(ASSET_MANIFEST.player.arms);
    for (const p of Object.values(ASSET_MANIFEST.evolutionParts)) paths.add(p);
    for (const p of Object.values(ASSET_MANIFEST.evolutionIcons)) paths.add(p);
    for (const p of Object.values(ASSET_MANIFEST.creatures)) paths.add(p);
    for (const p of Object.values(ASSET_MANIFEST.items)) paths.add(p);
    for (const p of Object.values(ASSET_MANIFEST.pois)) paths.add(p);
    for (const p of Object.values(ASSET_MANIFEST.terrains)) paths.add(p);

    this.totalCount = paths.size;
    this.loadedCount = 0;

    const base = (window as unknown as { CRAB_ASSET_BASE?: string }).CRAB_ASSET_BASE || '';

    const tasks = Array.from(paths).map(
      path =>
        new Promise<void>(resolve => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            this.images.set(path, img);
            this.loadedCount++;
            resolve();
          };
          img.onerror = () => {
            this.loadedCount++;
            resolve();
          };
          img.src = base ? base + path.replace(/^\.\//, '') : path;
        })
    );

    await Promise.all(tasks);
  }

  public getImage(path?: string): HTMLImageElement | null {
    if (!path) return null;
    const img = this.images.get(path);
    if (!img || !img.complete || img.naturalWidth === 0) return null;
    return img;
  }
}
