#!/usr/bin/env python3
"""Replaces broken/placeholder sprites in public/assets with crisp pixel art matching the game's #2f2623 outline style."""
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "assets")


def draw_grid(grid, palette):
    h = len(grid)
    w = len(grid[0])
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch in palette:
                px[x, y] = palette[ch]
    return img


def save_asset(rel_path, img):
    out = os.path.join(ROOT, rel_path)
    img.save(out)
    print(f"Updated {rel_path} ({img.size[0]}x{img.size[1]})")


def make_darwin():
    # Darwin: squishy blue blob (matches part_401 / evo_* style with #2f2623 outline)
    pal = {
        "O": (47, 38, 35, 255),      # #2f2623 outline
        "B": (7, 172, 220, 255),     # #07acdc mid blue
        "L": (94, 239, 210, 255),    # #5eefd2 cyan highlight
        "D": (22, 110, 175, 255),    # deeper blue shadow
        "W": (255, 255, 255, 255),   # specular
        "E": (24, 48, 91, 255),      # dark eye
    }
    grid = [
        "......OOOOO.....",
        ".....OLLLWLO....",
        "....OLLLLLLLO...",
        "...OLLLELLLELO..",
        "...OLLLELLLELO..",
        "...OLLLLLLLLLO..",
        "..OBLLLLLLLLBO..",
        "..OBBBBBBBBBBO..",
        "..OBBBBBBBBBBO..",
        "..OBBBBBBBBBBO..",
        "..ODBBBBBBBBDO..",
        "..ODDDDDDDDDDO..",
        "...OODDDDDDOO...",
        ".....OOOOOO.....",
    ]
    save_asset("creatures/player_body.png", draw_grid(grid, pal))

    # Minimal stubby blue blob arms
    arm_pal = {
        "O": (47, 38, 35, 255),
        "B": (7, 172, 220, 255),
        "L": (94, 239, 210, 255),
    }
    arm_grid = [
        "................",
        "..OO........OO..",
        ".OLLO......OLLO.",
        ".OBBO......OBBO.",
        "..OO........OO..",
        "................",
    ]
    save_asset("creatures/player_arms.png", draw_grid(arm_grid, arm_pal))


def make_food_and_items():
    O = (47, 38, 35, 255)
    # 1. Common food: Red Wild Berry cluster
    save_asset("environment/item_common.png", draw_grid([
        "......OOOO......",
        ".....OGGGGO.....",
        "....OOGGGGOO....",
        "...ORRRRRRRRO...",
        "..ORRWWRRRRRRO..",
        "..ORRRRRRRRRRO..",
        "..ORRRRRRRRRDO..",
        "...ORRRRRRRDO...",
        "....ODDDDDOO....",
        ".....OOOOOO.....",
    ], {"O": O, "G": (76, 175, 80, 255), "R": (239, 68, 68, 255), "W": (254, 202, 202, 255), "D": (185, 28, 28, 255)}))

    # 2. Rare food: Plump Sea-Blueberry
    save_asset("environment/item_rare.png", draw_grid([
        ".....OOOOOO.....",
        "....OGGGGGGO....",
        "...OOBBBBBBOO...",
        "..OBBWWBBBBBB0..".replace("0", "O"),
        "..OBBBBBBBBBBO..",
        "..OBBBBBBBBBDO..",
        "..OBBBBBBBBBDO..",
        "...ODDDDDDDDO...",
        "....OOOOOOOO....",
    ], {"O": O, "G": (52, 211, 153, 255), "B": (56, 189, 248, 255), "W": (224, 242, 254, 255), "D": (2, 132, 199, 255)}))

    # 3. Epic food: Glowing Purple Starfruit
    save_asset("environment/item_epic.png", draw_grid([
        "......OOOO......",
        ".....OPPPPO.....",
        "...OOPPWWPPOO...",
        "..OPPPPPPPPPPO..",
        ".OPPPPPPPPPPPPO.",
        "..OPPPPPPPPPDO..",
        "...OPPPPPPDDDO..",
        "..OPPPDOODPPPDO.",
        "..ODDO....ODDO..",
        "...OO......OO...",
    ], {"O": O, "P": (192, 132, 252, 255), "W": (243, 232, 255, 255), "D": (126, 34, 206, 255)}))

    # 4. Legendary food: Golden Crown Pineapple
    save_asset("environment/item_legendary.png", draw_grid([
        "....OO..OO..OO..",
        "....OGGGGGGGGO..",
        ".....OGGGGGGO...",
        "...OOYYYYYYYYOO.",
        "..OYYWWYYYYYYYO.",
        "..OYYYGYYYYGYYO.",
        "..OYYYYYYYYYYDO.",
        "..OYYYGYYYYGYDO.",
        "..OYYYYYYYYYYDO.",
        "...OYYDDDDDDYO..",
        "....OOOOOOOOO...",
    ], {"O": O, "G": (34, 197, 94, 255), "Y": (251, 191, 36, 255), "W": (254, 249, 195, 255), "D": (217, 119, 6, 255)}))

    # 5. HpFood: Juicy Heart-Meat
    save_asset("environment/item_hpfood.png", draw_grid([
        "..OOOO....OOOO..",
        ".ORRRRO..ORRRRO.",
        "ORRWWWRRORRRRRRO",
        "ORRRRRRRRRRRRRDO",
        "ORRRRRRRRRRRRRDO",
        ".ORRRRRRRRRRRDO.",
        "..ORRRRRRRRRDO..",
        "...ORRRRRRRDO...",
        "....ORRRRRDO....",
        ".....ORRRDO.....",
        "......OOOO......",
    ], {"O": O, "R": (244, 63, 94, 255), "W": (255, 228, 230, 255), "D": (190, 18, 60, 255)}))

    # 6. Mushroom: Spotted Red Mushroom
    save_asset("environment/item_mushroom.png", draw_grid([
        "....OOOOOOOO....",
        "..OORRRRRRRROO..",
        ".ORRWWRRRRRWWRO.",
        ".ORRWWRRRRRWWRO.",
        "ORRRRRRWWRRRRRRO",
        "ORRRRRRRRRRRRRRO",
        ".OOOOOOOOOOOOOO.",
        "....OSWWWWSSO...",
        "....OSWWWWSSO...",
        "....OSSWWWSSO...",
        ".....OOOOOOO....",
    ], {"O": O, "R": (225, 29, 72, 255), "W": (255, 241, 242, 255), "S": (226, 232, 240, 255)}))

    # 7. PlatingShard: Cyan Chitin Armor Shard
    save_asset("environment/item_platingshard.png", draw_grid([
        "......OOOO......",
        ".....OCCCCO.....",
        "....OCCWWCCO....",
        "...OCCCCCCCCO...",
        "..OCCCCCCCCDDO..",
        "..OCCCCCCDDDDO..",
        "...OCCDDDDDDO...",
        "....ODDDDDDO....",
        ".....OOOOOO.....",
    ], {"O": O, "C": (76, 201, 240, 255), "W": (224, 242, 254, 255), "D": (14, 116, 144, 255)}))

    # 8. Burrow: Earthy Tunnel Entrance
    save_asset("environment/item_burrow.png", draw_grid([
        ".....OOOOOOOOOO.....",
        "...OOBBBBBBBBBBOO...",
        "..OBBKKKKKKKKKKBBO..",
        ".OBBKKKKKKKKKKKKBBO.",
        ".OBKKKKKKKKKKKKKKBO.",
        ".OBBKKKKKKKKKKKKBBO.",
        "..OOBBKKKKKKKKBBOO..",
        "...OOBBBBBBBBBBOO...",
        ".....OOOOOOOOOO.....",
    ], {"O": O, "B": (146, 94, 52, 255), "K": (30, 20, 16, 255)}))


def make_creatures():
    O = (47, 38, 35, 255)
    # Sidewinder Rattler (creature_120)
    save_asset("creatures/creature_120.png", draw_grid([
        "..........OOOOOO........",
        ".........OYYYYYYO.......",
        "........OYYEYYYEYO......",
        "........OYYYYYYYYOR.....",
        "....OOOOOYYDDDDYO.RR....",
        "..OOYYYYYYYYYYYYO.......",
        ".OYYDDYYYYDDYYYYO.......",
        "OYYDDDDYYDDDDYYYO..OOO..",
        "OYYYYYYYYYYYYYYYO.ORRRO.",
        ".OOYYYYDDDDYYYYOO.ORRRO.",
        "...OOOOOOOOOOOO....OOO..",
    ], {"O": O, "Y": (234, 179, 8, 255), "D": (161, 98, 7, 255), "E": (24, 24, 27, 255), "R": (239, 68, 68, 255)}))

    # Krabken Tentacle (creature_2100)
    save_asset("creatures/creature_2100.png", draw_grid([
        "......OOOO......",
        ".....OPPPPO.....",
        "....OPPSSPPO....",
        "....OPPPPPPO....",
        ".....OPPSSPO....",
        ".....OPPPPPO....",
        "....OPPPSSPO....",
        "....OPPPPPPO....",
        "...OPPPPSSPO....",
        "...OPPPPPPPO....",
        "..OPPPPPSSPO....",
        "..OPPPPPPPPO....",
        ".ODDDDDDDDDDO...",
        ".OOOOOOOOOOOO...",
    ], {"O": O, "P": (136, 70, 181, 255), "S": (238, 116, 247, 255), "D": (97, 44, 133, 255)}))

    # Aquaconda (creature_1020, 1021, 1022)
    aqua_variants = [
        ("creatures/creature_1020.png", (20, 184, 166, 255), (15, 118, 110, 255), (94, 234, 212, 255)),
        ("creatures/creature_1021.png", (56, 189, 248, 255), (3, 105, 161, 255), (186, 230, 253, 255)),
        ("creatures/creature_1022.png", (244, 63, 94, 255), (159, 18, 57, 255), (254, 205, 211, 255)),
    ]
    for path, mid, dark, light in aqua_variants:
        save_asset(path, draw_grid([
            "........OOOOOO..........",
            ".......OLLLLLLO.........",
            "......OLLYLLYYLO........",
            "......OLLLLLLLLO..R.....",
            ".......OOMMMMO...RR.....",
            "....OOOOOMMMOOOO........",
            "..OOMMMMMMMMMMMMO.......",
            ".OMMDDMMMMMMMMDDMO..OO..",
            "OMMDDDDMMMMMMDDDDMOOMMO.",
            "OMMMMMMMMMMMMMMMMMMMMMO.",
            ".OOMMMMDDDDDDMMMMMMMOO..",
            "...OOOOOOOOOOOOOOOOOO...",
        ], {"O": O, "M": mid, "D": dark, "L": light, "Y": (253, 224, 71, 255), "R": (239, 68, 68, 255)}))

    # Krabaroo (creature_1060, 1061, 1062)
    roo_variants = [
        ("creatures/creature_1060.png", (249, 115, 22, 255), (194, 65, 12, 255), (239, 68, 68, 255)),
        ("creatures/creature_1061.png", (234, 179, 8, 255), (161, 98, 7, 255), (249, 115, 22, 255)),
        ("creatures/creature_1062.png", (225, 29, 72, 255), (136, 19, 55, 255), (251, 191, 36, 255)),
    ]
    for path, body, dark, claw in roo_variants:
        save_asset(path, draw_grid([
            "......OO..OO............",
            ".....OBBOOBBO...........",
            ".....OBBBBBBO...........",
            ".....OBEYEYBO....OOOO...",
            "....OOBBBBBBOO..OCCCCO..",
            "...OBBDDDDDDBBOOCC..CCO.",
            "..OBBDDDDDDDDDOOCC..CCO.",
            "..OBBBBBBBBBBBO..OOOO...",
            ".OOBBBBBBBBBBOO.........",
            "OBBO.OBBBOOBBO..........",
            "OO...OBBO.OBBO..........",
            ".....OOOO.OOOO..........",
        ], {"O": O, "B": body, "D": dark, "C": claw, "E": (254, 240, 138, 255), "Y": (24, 24, 27, 255)}))


def make_tiles():
    # Seamless 32x32 pixel-art tiles with gentle organic variation
    # Grass
    g = Image.new("RGB", (32, 32), (82, 168, 74))
    px = g.load()
    for x, y in [(4, 6), (5, 5), (6, 6), (18, 12), (19, 11), (20, 12), (10, 24), (11, 23), (26, 26), (27, 25)]:
        px[x, y] = (64, 138, 58)
    for x, y in [(12, 4), (24, 16), (6, 18), (22, 28)]:
        px[x, y] = (104, 190, 88)
    save_asset("environment/tile_grass.png", g)

    # Sand
    s = Image.new("RGB", (32, 32), (228, 198, 102))
    px = s.load()
    for x, y in [(5, 8), (6, 8), (7, 8), (19, 20), (20, 20), (21, 20), (12, 27), (13, 27)]:
        px[x, y] = (208, 170, 78)
    for x, y in [(15, 5), (26, 12), (8, 19)]:
        px[x, y] = (242, 218, 130)
    save_asset("environment/tile_sand.png", s)

    # Snow
    sn = Image.new("RGB", (32, 32), (235, 245, 252))
    px = sn.load()
    for x, y in [(4, 9), (5, 9), (6, 9), (20, 22), (21, 22), (14, 14)]:
        px[x, y] = (198, 220, 238)
    for x, y in [(10, 4), (25, 8), (7, 26)]:
        px[x, y] = (255, 255, 255)
    save_asset("environment/tile_snow.png", sn)

    # Water
    w = Image.new("RGB", (32, 32), (38, 152, 204))
    px = w.load()
    for x, y in [(4, 6), (5, 6), (6, 6), (7, 6), (18, 18), (19, 18), (20, 18), (10, 27), (11, 27)]:
        px[x, y] = (86, 196, 236)
    for x, y in [(14, 10), (15, 10), (24, 24), (25, 24)]:
        px[x, y] = (28, 124, 174)
    save_asset("environment/tile_water.png", w)


if __name__ == "__main__":
    make_darwin()
    make_food_and_items()
    make_creatures()
    make_tiles()
    print("All assets updated!")
