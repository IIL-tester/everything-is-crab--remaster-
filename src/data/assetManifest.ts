export interface AssetManifest {
  player: { body?: string; arms?: string };
  evolutionParts: Record<number, string>;
  evolutionIcons: Record<number, string>;
  creatures: Record<number, string>;
  items: Record<string, string>;
  pois: Record<string, string>;
  terrains: Record<string, string>;
}

export const ASSET_MANIFEST: AssetManifest = {
  "player": {
    "body": "./assets/creatures/player_body.png",
    "arms": "./assets/creatures/player_arms.png"
  },
  "evolutionParts": {
    "130": "./assets/evolutions/part_130.png",
    "180": "./assets/evolutions/part_180.png",
    "170": "./assets/evolutions/part_170.png",
    "173": "./assets/evolutions/part_173.png",
    "175": "./assets/evolutions/part_175.png",
    "176": "./assets/evolutions/part_176.png",
    "182": "./assets/evolutions/part_182.png",
    "302": "./assets/evolutions/part_302.png",
    "305": "./assets/evolutions/part_305.png",
    "306": "./assets/evolutions/part_306.png",
    "404": "./assets/evolutions/part_404.png",
    "401": "./assets/evolutions/part_401.png",
    "408": "./assets/evolutions/part_408.png",
    "750": "./assets/evolutions/part_750.png",
    "1100": "./assets/evolutions/part_1100.png"
  },
  "evolutionIcons": {
    "130": "./assets/ui/evo_130.png",
    "180": "./assets/evolutions/part_180.png",
    "170": "./assets/ui/evo_170.png",
    "173": "./assets/ui/evo_173.png",
    "175": "./assets/ui/evo_175.png",
    "176": "./assets/ui/evo_176.png",
    "182": "./assets/ui/evo_182.png",
    "302": "./assets/ui/evo_302.png",
    "305": "./assets/ui/evo_305.png",
    "306": "./assets/ui/evo_306.png",
    "404": "./assets/ui/evo_404.png",
    "401": "./assets/ui/evo_401.png",
    "408": "./assets/ui/evo_408.png",
    "900": "./assets/ui/evo_900.png",
    "1001": "./assets/ui/evo_1001.png",
    "1003": "./assets/ui/evo_1003.png",
    "706": "./assets/ui/evo_706.png",
    "901": "./assets/ui/evo_901.png",
    "1100": "./assets/ui/evo_1100.png",
    "1200": "./assets/ui/evo_1200.png",
    "1300": "./assets/ui/evo_1300.png",
    "750": "./assets/ui/evo_750.png",
    "751": "./assets/ui/evo_751.png",
    "1540": "./assets/ui/evo_1540.png"
  },
  "creatures": {
    "10": "./assets/creatures/creature_10.png",
    "20": "./assets/creatures/creature_20.png",
    "30": "./assets/creatures/creature_30.png",
    "40": "./assets/creatures/creature_40.png",
    "50": "./assets/creatures/creature_50.png",
    "80": "./assets/creatures/creature_80.png",
    "90": "./assets/creatures/creature_90.png",
    "100": "./assets/creatures/creature_100.png",
    "110": "./assets/creatures/creature_110.png",
    "120": "./assets/creatures/creature_120.png",
    "130": "./assets/creatures/creature_130.png",
    "200": "./assets/creatures/creature_200.png",
    "220": "./assets/creatures/creature_220.png",
    "230": "./assets/creatures/creature_230.png",
    "260": "./assets/creatures/creature_260.png",
    "300": "./assets/creatures/creature_300.png",
    "310": "./assets/creatures/creature_310.png",
    "330": "./assets/creatures/creature_330.png",
    "380": "./assets/creatures/creature_380.png",
    "1000": "./assets/creatures/creature_1000.png",
    "1001": "./assets/creatures/creature_1001.png",
    "1002": "./assets/creatures/creature_1002.png",
    "1050": "./assets/creatures/creature_1050.png",
    "1051": "./assets/creatures/creature_1051.png",
    "1052": "./assets/creatures/creature_1052.png",
    "1060": "./assets/creatures/creature_1060.png",
    "1061": "./assets/creatures/creature_1061.png",
    "1062": "./assets/creatures/creature_1062.png",
    "1020": "./assets/creatures/creature_1020.png",
    "1021": "./assets/creatures/creature_1021.png",
    "1022": "./assets/creatures/creature_1022.png",
    "1040": "./assets/creatures/creature_1042.png",
    "1041": "./assets/creatures/creature_1042.png",
    "1042": "./assets/creatures/creature_1042.png",
    "1180": "./assets/creatures/creature_1180.png",
    "2100": "./assets/creatures/creature_2100.png"
  },
  "items": {
    "Common": "./assets/environment/item_common.png",
    "Rare": "./assets/environment/item_rare.png",
    "Epic": "./assets/environment/item_epic.png",
    "Legendary": "./assets/environment/item_legendary.png",
    "BossFruit": "./assets/environment/item_bossfruit.png",
    "HpFood": "./assets/environment/item_hpfood.png",
    "PlatingShard": "./assets/environment/item_platingshard.png",
    "Mushroom": "./assets/environment/item_mushroom.png",
    "Burrow": "./assets/environment/item_burrow.png"
  },
  "pois": {
    "GrowingTree": "./assets/environment/poi_growingtree.png",
    "HealingPond": "./assets/environment/poi_healingpond.png",
    "ChaosTree": "./assets/environment/poi_chaostree.png",
    "Oasis": "./assets/environment/poi_oasis.png",
    "AlgaeReef": "./assets/environment/poi_algaereef.png"
  },
  "terrains": {
    "Grass": "./assets/environment/tile_grass.png",
    "Sand": "./assets/environment/tile_sand.png",
    "Snow": "./assets/environment/tile_snow.png",
    "Water": "./assets/environment/tile_water.png"
  }
};
