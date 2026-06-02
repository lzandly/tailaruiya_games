(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const statsEl = document.getElementById("stats");
  const hotbarEl = document.getElementById("hotbar");
  const toastEl = document.getElementById("toast");
  const inventoryPanelEl = document.getElementById("inventoryPanel");
  const craftPanelEl = document.getElementById("craftPanel");
  const menuToggleEl = document.getElementById("menuToggle");
  const menuPanelEl = document.getElementById("menuPanel");
  const tooltipEl = document.getElementById("tooltip");
  const gameFrameEl = canvas.parentElement;

  const W = canvas.width;
  const H = canvas.height;
  const TILE = 32;
  const WORLD_W = 240;
  const WORLD_H = 92;
  const GRAVITY = 2250;
  const MAX_FALL = 980;
  const MOVE_SPEED = 285;
  const JUMP_SPEED = 900;
  const REACH = 5.5 * TILE;

  const COLORS = {
    outline: "#151220",
    outlineSoft: "#2a2434",
    grass: "#66d64f",
    grassDark: "#268c43",
    moss: "#8df05a",
    dirt: "#8a5a3e",
    dirtDark: "#4b342e",
    stone: "#67717b",
    stoneDark: "#353946",
    ore: "#ffd453",
    oreGlow: "#fff1a0",
    wood: "#a96b43",
    leaf: "#42b45d",
    torch: "#ffbd3d",
    bench: "#c07a46",
    portal: "#d554ff",
    slime: "#8ce448",
    slimePurple: "#b947e8",
  };

  const BLOCKS = {
    grass: { name: "草地", solid: true, hardness: 0.38, color: COLORS.grass, drop: "dirt" },
    dirt: { name: "泥土", solid: true, hardness: 0.35, color: COLORS.dirt, drop: "dirt" },
    stone: { name: "石块", solid: true, hardness: 0.7, color: COLORS.stone, drop: "stone" },
    ore: { name: "铜矿", solid: true, hardness: 0.95, color: COLORS.ore, drop: "ore" },
    wood: { name: "木材", solid: true, hardness: 0.42, color: COLORS.wood, drop: "wood" },
    leaf: { name: "树叶", solid: false, hardness: 0.2, color: COLORS.leaf, drop: null },
    torch: { name: "火把", solid: false, hardness: 0.15, color: COLORS.torch, drop: "torch", light: true },
    bench: { name: "工作台", solid: true, hardness: 0.45, color: COLORS.bench, drop: "bench" },
  };

  const PLACEABLE = new Set(["dirt", "stone", "wood", "torch", "bench"]);
  const ITEMS = {
    pickaxe: {
      name: "铜镐",
      type: "镐",
      rarity: "普通",
      sprite: "pickaxe",
      damage: 4,
      power: 35,
      useTime: 23,
      use: "用于挖掘泥土、石块和矿石。对石块/矿石效率最高。",
    },
    sword: {
      name: "铜短剑",
      type: "近战武器",
      rarity: "普通",
      sprite: "sword",
      damage: 5,
      useTime: 13,
      knockback: "弱",
      use: "点击左键快速刺击，适合开局防身。",
    },
    axe: {
      name: "铜斧",
      type: "斧",
      rarity: "普通",
      sprite: "axe",
      damage: 7,
      power: 35,
      useTime: 30,
      use: "用于砍树和清理树叶。对木材效率最高。",
    },
    bow: {
      name: "木弓",
      type: "远程武器",
      rarity: "普通",
      sprite: "bow",
      damage: 9,
      useTime: 30,
      use: "基础远程武器。左键发射木箭，消耗背包中的木箭。",
    },
    arrow: { name: "木箭", type: "弹药", rarity: "普通", sprite: "block", color: "#d9c48a", damage: 6, use: "木弓消耗的基础弹药。" },
    dirt: { name: "泥土块", type: "方块", rarity: "普通", sprite: "block", color: COLORS.dirt, use: "最基础的建筑方块，可右键放置。" },
    stone: { name: "石块", type: "方块", rarity: "普通", sprite: "block", color: COLORS.stone, use: "坚硬的建筑材料，可右键放置。" },
    wood: { name: "木材", type: "材料/方块", rarity: "普通", sprite: "block", color: COLORS.wood, use: "树木掉落的基础材料，可建造和合成。" },
    ore: { name: "铜矿石", type: "矿石", rarity: "普通", sprite: "block", color: COLORS.ore, use: "地下采集的矿物，后续可冶炼装备。" },
    torch: { name: "火把", type: "光源", rarity: "普通", sprite: "torch", use: "右键放置，照亮附近区域。" },
    bench: { name: "工作台", type: "制作站", rarity: "普通", sprite: "block", color: COLORS.bench, use: "右键放置。后续高级配方需要靠近工作台。" },
    gel: { name: "凝胶", type: "材料", rarity: "普通", sprite: "gel", use: "史莱姆掉落物，可与木材合成火把。" },
  };
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, right: false };
  let toastTimer = 0;
  let selected = 0;
  let last = performance.now();
  let craftCooldown = 0;
  let attackCooldown = 0;
  let dayTime = 0.78;
  let weather = "clear";
  let weatherTimer = 28;
  let mining = null;
  let shake = 0;
  let inventoryOpen = false;
  let craftOpen = false;
  let menuOpen = false;
  let walkTime = 0;
  let lastInventoryHtml = "";
  let lastCraftHtml = "";
  let draggedSlot = null;
  let pendingSwapSlot = null;
  let pointerDrag = null;
  let dragGhostEl = null;
  let suppressSlotClick = false;

  function mulberry32(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rand = mulberry32(20260602);
  const world = Array.from({ length: WORLD_H }, () => Array(WORLD_W).fill(null));
  const surface = new Array(WORLD_W).fill(0);

  const player = {
    x: WORLD_W * TILE * 0.5,
    y: 0,
    w: 24,
    h: 48,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: false,
    hp: 100,
    maxHp: 100,
    mana: 20,
    maxMana: 20,
    hurt: 0,
    swing: 0,
  };

  const inventory = {
    pickaxe: 1,
    sword: 1,
    axe: 1,
    bow: 0,
    arrow: 25,
    dirt: 24,
    stone: 0,
    wood: 0,
    ore: 0,
    torch: 8,
    bench: 0,
  };

  const inventorySlots = Array.from({ length: 40 }, (_, i) => [
    "pickaxe", "sword", "axe", "dirt", "stone", "wood", "torch", "bench", "bow", "arrow",
    "ore", "gel",
  ][i] || null);
  const recipes = [
    { id: "bench", name: "工作台", output: { bench: 1 }, needs: { wood: 10 } },
    { id: "torch", name: "火把 x3", output: { torch: 3 }, needs: { wood: 1, gel: 1 } },
    { id: "bow", name: "木弓", output: { bow: 1 }, needs: { wood: 8 } },
    { id: "arrow", name: "木箭 x15", output: { arrow: 15 }, needs: { wood: 1, stone: 1 } },
    { id: "heartCharm", name: "铜心护符", output: {}, needs: { stone: 12, ore: 4 }, effect: "heart" },
  ];
  const drops = [];
  const enemies = [];
  const particles = [];
  const projectiles = [];

  function noise(x, a = 1, b = 1) {
    return Math.sin(x * 0.13 + a) * 4 + Math.sin(x * 0.043 + b) * 9 + Math.sin(x * 0.011) * 12;
  }

  function generateWorld() {
    for (let x = 0; x < WORLD_W; x++) {
      const h = Math.floor(31 + noise(x, 0.2, 1.6));
      surface[x] = h;
      for (let y = h; y < WORLD_H; y++) {
        const depth = y - h;
        let id = depth === 0 ? "grass" : depth < 12 ? "dirt" : "stone";
        const cave = Math.sin(x * 0.22 + y * 0.16) + Math.sin(x * 0.07 - y * 0.2);
        if (depth > 7 && cave > 1.28 && rand() > 0.32) id = null;
        if (id === "stone" && rand() < 0.024 && depth > 12) id = "ore";
        world[y][x] = id;
      }
    }

    for (let x = 8; x < WORLD_W - 8; x += 8 + Math.floor(rand() * 8)) {
      if (rand() < 0.62) makeTree(x, surface[x] - 1);
    }

    player.y = (surface[Math.floor(player.x / TILE)] - 3) * TILE;
    showToast("基础世界生成完成：挖掘、建造、战斗、合成已开启");
  }

  function makeTree(tx, ty) {
    const trunk = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < trunk; i++) setTile(tx, ty - i, "wood");
    const top = ty - trunk;
    for (let oy = -2; oy <= 2; oy++) {
      for (let ox = -3; ox <= 3; ox++) {
        if (Math.abs(ox) + Math.abs(oy) < 5 && rand() > 0.15) setTile(tx + ox, top + oy, "leaf");
      }
    }
  }

  function getTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return "stone";
    return world[ty][tx];
  }

  function setTile(tx, ty, id) {
    if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return;
    world[ty][tx] = id;
  }

  function isSolidAt(tx, ty) {
    const id = getTile(tx, ty);
    return !!(id && BLOCKS[id]?.solid);
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    toastTimer = 2.2;
  }

  function addParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (rand() - 0.5) * 260,
        vy: -rand() * 260,
        r: 3 + rand() * 4,
        life: 0.5 + rand() * 0.35,
        color,
      });
    }
  }

  function addDrop(id, x, y, count = 1) {
    if (!id) return;
    drops.push({ id, count, x, y, vx: (rand() - 0.5) * 120, vy: -180 - rand() * 80, r: 11 });
  }

  function spawnEnemy() {
    const px = player.x / TILE;
    const side = rand() < 0.5 ? -1 : 1;
    let tx = Math.max(4, Math.min(WORLD_W - 5, Math.floor(px + side * (15 + rand() * 18))));
    let sy = surface[tx] - 2;
    if (Math.abs(tx * TILE - player.x) < 330) return;
    enemies.push({
      x: tx * TILE,
      y: sy * TILE,
      w: 30,
      h: 24,
      vx: 0,
      vy: 0,
      hp: dayTime > 0.73 || dayTime < 0.23 ? 42 : 26,
      maxHp: dayTime > 0.73 || dayTime < 0.23 ? 42 : 26,
      hurt: 0,
      jump: rand() * 1.4,
    });
  }

  function rectHitsWorld(x, y, w, h) {
    const left = Math.floor(x / TILE);
    const right = Math.floor((x + w - 1) / TILE);
    const top = Math.floor(y / TILE);
    const bottom = Math.floor((y + h - 1) / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (isSolidAt(tx, ty)) return true;
      }
    }
    return false;
  }

  function moveBody(body, dt) {
    body.vy = Math.min(MAX_FALL, body.vy + GRAVITY * dt);
    body.x += body.vx * dt;
    if (rectHitsWorld(body.x, body.y, body.w, body.h)) {
      const dir = Math.sign(body.vx) || 1;
      while (rectHitsWorld(body.x, body.y, body.w, body.h)) body.x -= dir;
      body.vx = 0;
    }
    body.y += body.vy * dt;
    body.onGround = false;
    if (rectHitsWorld(body.x, body.y, body.w, body.h)) {
      const dir = Math.sign(body.vy) || 1;
      while (rectHitsWorld(body.x, body.y, body.w, body.h)) body.y -= dir;
      if (dir > 0) body.onGround = true;
      body.vy = 0;
    }
  }

  function updatePlayer(dt) {
    const left = keys.has("a") || keys.has("arrowleft");
    const right = keys.has("d") || keys.has("arrowright");
    const jump = keys.has(" ") || keys.has("w") || keys.has("arrowup");
    const target = (right ? 1 : 0) - (left ? 1 : 0);
    player.vx += (target * MOVE_SPEED - player.vx) * Math.min(1, dt * 12);
    if (target) player.facing = target;
    if (Math.abs(player.vx) > 40 && player.onGround) walkTime += dt * 11;
    if (jump && player.onGround) player.vy = -JUMP_SPEED;
    moveBody(player, dt);
    player.x = Math.max(64, Math.min(WORLD_W * TILE - 96, player.x));
    if (player.y > WORLD_H * TILE + 300 || player.hp <= 0) respawn();
    player.hurt = Math.max(0, player.hurt - dt);
    player.swing = Math.max(0, player.swing - dt * 8);
  }

  function respawn() {
    player.hp = player.maxHp;
    player.vx = 0;
    player.vy = 0;
    const sx = Math.floor(WORLD_W * 0.5);
    player.x = sx * TILE;
    player.y = (surface[sx] - 4) * TILE;
    shake = 0.5;
    showToast("你回到了出生点");
  }

  function updateEnemies(dt) {
    const night = dayTime > 0.72 || dayTime < 0.22;
    if (enemies.length < (night ? 9 : 5) && rand() < dt * (night ? 0.45 : 0.18)) spawnEnemy();
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const dx = player.x - e.x;
      e.vx += Math.sign(dx) * (night ? 170 : 125) * dt;
      e.vx *= 0.92;
      e.jump -= dt;
      if (e.onGround && e.jump <= 0 && Math.abs(dx) < 520) {
        e.vy = -520;
        e.jump = 1 + rand() * 1.5;
      }
      moveBody(e, dt);
      e.hurt = Math.max(0, e.hurt - dt);
      if (overlap(player, e) && player.hurt <= 0) {
        player.hp -= night ? 12 : 8;
        player.hurt = 0.75;
        player.vx += Math.sign(player.x - e.x) * 330;
        player.vy = -280;
        shake = 0.18;
      }
      if (e.hp <= 0) {
        addParticles(e.x + e.w / 2, e.y + e.h / 2, "#72e186", 18);
        addDrop("gel", e.x, e.y, 1 + Math.floor(rand() * 2));
        enemies.splice(i, 1);
      }
    }
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function updateDrops(dt) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vy = Math.min(MAX_FALL, d.vy + GRAVITY * dt);
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (rectHitsWorld(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2)) {
        d.y -= d.vy * dt;
        d.vy *= -0.18;
        d.vx *= 0.78;
      }
      const dist = Math.hypot(d.x - (player.x + player.w / 2), d.y - (player.y + player.h / 2));
      if (dist < 128) {
        d.x += (player.x + player.w / 2 - d.x) * dt * 5;
        d.y += (player.y + player.h / 2 - d.y) * dt * 5;
      }
      if (dist < 30) {
        inventory[d.id] = (inventory[d.id] || 0) + d.count;
        ensureItemSlotted(d.id);
        drops.splice(i, 1);
      }
    }
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      p.vy += GRAVITY * 0.18 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0 || rectHitsWorld(p.x - 2, p.y - 2, 4, 4)) {
        addParticles(p.x, p.y, "#d9c48a", 4);
        projectiles.splice(i, 1);
        continue;
      }
      for (const e of enemies) {
        if (p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h) {
          e.hp -= p.damage;
          e.hurt = 0.18;
          e.vx += Math.sign(p.vx) * 260;
          addParticles(p.x, p.y, "#ffd36f", 7);
          projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.vy += GRAVITY * 0.45 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function screenToWorld() {
    const rect = canvas.getBoundingClientRect();
    const sx = (mouse.x - rect.left) * (W / rect.width);
    const sy = (mouse.y - rect.top) * (H / rect.height);
    const cam = getCamera();
    return { x: sx + cam.x, y: sy + cam.y, sx, sy };
  }

  function selectedItem() {
    return inventorySlots[selected] || null;
  }

  function updateActions(dt) {
    craftCooldown = Math.max(0, craftCooldown - dt);
    attackCooldown = Math.max(0, attackCooldown - dt);
    const item = selectedItem();
    if (mouse.down && item) {
      if (ITEMS[item]?.type?.includes("武器")) attack();
      else if (ITEMS[item]?.type === "镐" || ITEMS[item]?.type === "斧") mine(dt);
    } else {
      mining = null;
    }
    if (mouse.right) placeBlock();
  }

  function attack() {
    if (attackCooldown > 0) return;
    player.swing = 1;
    const item = selectedItem();
    const damage = ITEMS[item]?.damage || 8;
    attackCooldown = (ITEMS[item]?.useTime || 20) / 60;
    if (item === "bow") {
      shootArrow(damage + (ITEMS.arrow?.damage || 0));
      return;
    }
    const center = {
      x: player.x + player.w / 2 + player.facing * (item === "sword" ? 46 : 34),
      y: player.y + 24,
    };
    for (const e of enemies) {
      const dist = Math.hypot(e.x + e.w / 2 - center.x, e.y + e.h / 2 - center.y);
      if (dist < (item === "sword" ? 46 : 62)) {
        e.hp -= damage;
        e.hurt = 0.22;
        e.vx += player.facing * 360;
        e.vy = -240;
        addParticles(e.x + e.w / 2, e.y + e.h / 2, "#9bf06f", 7);
      }
    }
  }

  function shootArrow(damage) {
    if ((inventory.arrow || 0) <= 0) {
      showToast("没有木箭");
      return;
    }
    inventory.arrow--;
    projectiles.push({
      x: player.x + player.w / 2 + player.facing * 22,
      y: player.y + 20,
      vx: player.facing * 620,
      vy: -70,
      damage,
      life: 1.4,
    });
  }

  function mine(dt) {
    const p = screenToWorld();
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor(p.y / TILE);
    const id = getTile(tx, ty);
    if (!id) return;
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    if (Math.hypot(cx - (player.x + player.w / 2), cy - (player.y + player.h / 2)) > REACH) return;
    if (!mining || mining.tx !== tx || mining.ty !== ty) mining = { tx, ty, progress: 0 };
    const speed = miningSpeed(selectedItem(), id);
    mining.progress += dt * speed;
    if (mining.progress >= BLOCKS[id].hardness) {
      setTile(tx, ty, null);
      addDrop(BLOCKS[id].drop, cx, cy, 1);
      addParticles(cx, cy, BLOCKS[id].color, 12);
      mining = null;
    }
  }

  function miningSpeed(tool, block) {
    if (tool === "pickaxe" && ["dirt", "grass", "stone", "ore"].includes(block)) return block === "ore" ? 1.05 : 1.25;
    if (tool === "axe" && ["wood", "leaf"].includes(block)) return block === "leaf" ? 2.8 : 1.45;
    if (tool === "axe" && ["dirt", "grass"].includes(block)) return 0.36;
    if (tool === "pickaxe" && ["wood", "leaf"].includes(block)) return 0.28;
    return 0.18;
  }

  function placeBlock() {
    mouse.right = false;
    const item = selectedItem();
    if (!PLACEABLE.has(item) || (inventory[item] || 0) <= 0) return;
    const p = screenToWorld();
    let tx = Math.floor(p.x / TILE);
    let ty = Math.floor(p.y / TILE);
    if (getTile(tx, ty) && !getTile(tx, ty - 1)) ty -= 1;
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    if (Math.hypot(cx - (player.x + player.w / 2), cy - (player.y + player.h / 2)) > REACH) return;
    if (getTile(tx, ty)) return;
    if (item === "bench" && !isSolidAt(tx, ty + 1)) {
      showToast("工作台需要放在地面上");
      return;
    }
    if (rectIntersectsTile(player, tx, ty)) return;
    setTile(tx, ty, item);
    inventory[item]--;
    if (inventory[item] <= 0) clearEmptyStack(item);
    addParticles(cx, cy, BLOCKS[item].color, 5);
  }

  function ensureItemSlotted(id) {
    if (inventorySlots.includes(id)) return;
    const empty = inventorySlots.findIndex((slot) => slot === null);
    if (empty >= 0) inventorySlots[empty] = id;
  }

  function clearEmptyStack(id) {
    if ((inventory[id] || 0) > 0 || ["pickaxe", "sword", "axe"].includes(id)) return;
    for (let i = 0; i < inventorySlots.length; i++) {
      if (inventorySlots[i] === id) inventorySlots[i] = null;
    }
  }

  function rectIntersectsTile(rect, tx, ty) {
    return rect.x < (tx + 1) * TILE && rect.x + rect.w > tx * TILE && rect.y < (ty + 1) * TILE && rect.y + rect.h > ty * TILE;
  }

  function craft() {
    if (craftCooldown > 0) return;
    craftCooldown = 0.35;
    craftOpen = !craftOpen;
    if (craftOpen) inventoryOpen = true;
    showToast(craftOpen ? "合成面板已打开" : "合成面板已关闭");
    renderPanels();
  }

  function canCraft(recipe) {
    return Object.entries(recipe.needs).every(([id, count]) => (inventory[id] || 0) >= count);
  }

  function craftRecipe(recipeId) {
    const recipe = recipes.find((item) => item.id === recipeId);
    if (!recipe || !canCraft(recipe)) {
      showToast("材料不足");
      return;
    }
    for (const [id, count] of Object.entries(recipe.needs)) inventory[id] -= count;
    for (const [id, count] of Object.entries(recipe.output)) inventory[id] = (inventory[id] || 0) + count;
    if (recipe.effect === "heart") {
      player.maxHp += 10;
      player.hp = Math.min(player.maxHp, player.hp + 10);
    }
    showToast(`合成：${recipe.name}`);
    renderPanels();
  }

  function updateWorld(dt) {
    dayTime = (dayTime + dt / 480) % 1;
    weatherTimer -= dt;
    if (weatherTimer <= 0) {
      weather = rand() < 0.24 ? "rain" : "clear";
      weatherTimer = 26 + rand() * 42;
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl.classList.remove("show");
    }
    shake = Math.max(0, shake - dt);
  }

  function getCamera() {
    return {
      x: Math.max(0, Math.min(WORLD_W * TILE - W, player.x + player.w / 2 - W / 2)),
      y: Math.max(0, Math.min(WORLD_H * TILE - H, player.y + player.h / 2 - H / 2)),
    };
  }

  function draw() {
    const cam = getCamera();
    const sx = shake ? (rand() - 0.5) * shake * 16 : 0;
    const sy = shake ? (rand() - 0.5) * shake * 16 : 0;
    ctx.save();
    ctx.translate(sx, sy);
    drawSky(cam);
    drawTerrain(cam);
    drawForegroundDecor(cam);
    drawDrops(cam);
    drawProjectiles(cam);
    drawEnemies(cam);
    drawPlayer(cam);
    drawParticles(cam);
    drawCursor(cam);
    drawLighting();
    drawMinimap(cam);
    ctx.restore();
    renderHud();
  }

  function drawSky(cam) {
    const night = dayTime > 0.72 || dayTime < 0.22;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (night) {
      g.addColorStop(0, "#1b1550");
      g.addColorStop(0.48, "#3a246e");
      g.addColorStop(1, "#122b3d");
    } else {
      g.addColorStop(0, "#5aa7ff");
      g.addColorStop(0.52, "#9fd7ff");
      g.addColorStop(1, "#5cbe9f");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    drawTerrariaBackdrop(cam, night);
    drawGlowMotes(cam);
    if (weather === "rain") drawRain(cam);
  }

  function drawTerrariaBackdrop(cam, night) {
    const orbit = (dayTime * Math.PI * 2) - Math.PI * 0.18;
    const ox = (dayTime * W * 1.25 - W * 0.14) % (W * 1.15);
    const oy = 130 - Math.sin(orbit) * 92;
    drawCircle(ox, oy, night ? 28 : 34, night ? "#eef2ff" : "#ffe279", night ? "#7d8cc3" : "#d19a3c", 3);

    ctx.save();
    ctx.globalAlpha = night ? 0.8 : 0.45;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 26; i++) {
      const x = (i * 173 - cam.x * 0.06) % W;
      const y = 32 + ((i * 59) % 170);
      if (night) drawCircle(x < 0 ? x + W : x, y, 2, "#fff7d5", "transparent", 0);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = night ? "rgba(178, 193, 237, 0.24)" : "rgba(255,255,255,0.62)";
    for (let i = 0; i < 9; i++) {
      const x = ((i * 260 - cam.x * 0.1) % (W + 220)) - 110;
      const y = 72 + (i % 3) * 44;
      cloud(x, y, 0.9 + (i % 3) * 0.2);
    }

    drawMountainLayer(cam, 0.06, H - 160, night ? "#25324f" : "#6f8eb5", 0.95);
    drawMountainLayer(cam, 0.11, H - 116, night ? "#182d43" : "#4e8378", 1.12);
    drawForestLine(cam, H - 104, night ? "#102b27" : "#235b44", 0.18);
    drawForestLine(cam, H - 72, night ? "#0b211e" : "#1b4937", 0.32);
    ctx.restore();
  }

  function drawMountainLayer(cam, speed, baseY, color, scale) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = -1; i < 8; i++) {
      const x = ((i * 260 - cam.x * speed) % (W + 260)) - 130;
      ctx.lineTo(x, baseY + Math.sin(i * 2.1) * 18);
      ctx.lineTo(x + 130 * scale, baseY - 110 * scale - (i % 2) * 30);
      ctx.lineTo(x + 280 * scale, baseY + Math.cos(i) * 20);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawForestLine(cam, baseY, color, speed) {
    ctx.fillStyle = color;
    for (let i = 0; i < 24; i++) {
      const x = ((i * 74 - cam.x * speed) % (W + 120)) - 60;
      const h = 54 + (i % 5) * 16;
      ctx.beginPath();
      ctx.moveTo(x - 22, baseY);
      ctx.lineTo(x, baseY - h);
      ctx.lineTo(x + 22, baseY);
      ctx.closePath();
      ctx.fill();
      roundRect(x - 3, baseY - h * 0.45, 6, h * 0.45, 2, color, "transparent");
    }
  }

  function drawForestBackdrop(cam) {
    ctx.save();
    for (let layer = 0; layer < 3; layer++) {
      const alpha = 0.28 + layer * 0.18;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ["#183b3c", "#1d4b42", "#254934"][layer];
      for (let i = 0; i < 12; i++) {
        const x = ((i * 180 - cam.x * (0.05 + layer * 0.06)) % (W + 220)) - 100;
        const base = H - 80 + layer * 16;
        ctx.beginPath();
        ctx.moveTo(x - 48, base);
        ctx.quadraticCurveTo(x - 24, 150 + (i % 4) * 24, x + 22, base);
        ctx.closePath();
        ctx.fill();
        drawLeafMass(x - 28, 120 + (i % 5) * 30, 0.8 + layer * 0.2, layer);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawLeafMass(x, y, s, layer = 0) {
    const colors = ["#315f48", "#477d50", "#5f9659"];
    ctx.fillStyle = colors[layer] || colors[1];
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.ellipse(x + (i % 3) * 28 * s, y + Math.floor(i / 3) * 18 * s, 24 * s, 13 * s, (i % 2) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTreehouseBackdrop(cam) {
    ctx.save();
    const baseX = 150 - cam.x * 0.18;
    const baseY = 178;
    drawRoomCluster(520 - cam.x * 0.08, 126, 1.05);
    for (let i = 0; i < 4; i++) {
      const x = ((baseX + i * 300) % (W + 420)) - 120;
      drawRoomCluster(x, baseY + (i % 2) * 54, 0.78 + (i % 3) * 0.08);
    }
    ctx.restore();
  }

  function drawRoomCluster(x, y, s) {
    drawTrunk(x + 84 * s, y + 60 * s, 28 * s, 260 * s);
    drawHouse(x, y + 70 * s, 160 * s, 82 * s, s);
    drawHouse(x + 86 * s, y + 12 * s, 142 * s, 76 * s, s * 0.92);
    drawHouse(x + 44 * s, y - 52 * s, 112 * s, 72 * s, s * 0.85);
    drawLadder(x + 28 * s, y + 60 * s, 136 * s, s);
    drawLeafMass(x - 30 * s, y - 78 * s, 0.78 * s, 2);
    drawLeafMass(x + 120 * s, y - 96 * s, 0.7 * s, 1);
  }

  function drawHouse(x, y, w, h, s) {
    roundRect(x, y, w, h, 4, "rgba(67, 50, 47, 0.88)", COLORS.outline);
    ctx.fillStyle = "#26394b";
    ctx.beginPath();
    ctx.moveTo(x - 8 * s, y + 8 * s);
    ctx.lineTo(x + w * 0.45, y - 26 * s);
    ctx.lineTo(x + w + 12 * s, y + 8 * s);
    ctx.lineTo(x + w, y + 20 * s);
    ctx.lineTo(x, y + 20 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 3;
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = "rgba(23, 18, 25, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 10 * s, y + (28 + i * 12) * s);
      ctx.lineTo(x + w - 10 * s, y + (28 + i * 12) * s);
      ctx.stroke();
    }
    drawWindow(x + 18 * s, y + 28 * s, 30 * s, 22 * s);
    drawWindow(x + w - 48 * s, y + 32 * s, 28 * s, 20 * s);
    roundRect(x + w * 0.46, y + h - 34 * s, 24 * s, 34 * s, 4, "#5a3429", COLORS.outline);
  }

  function drawWindow(x, y, w, h) {
    roundRect(x, y, w, h, 3, "#ffe799", COLORS.outline);
    ctx.strokeStyle = "rgba(95, 58, 33, 0.68)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 2);
    ctx.lineTo(x + w / 2, y + h - 2);
    ctx.moveTo(x + 2, y + h / 2);
    ctx.lineTo(x + w - 2, y + h / 2);
    ctx.stroke();
  }

  function drawTrunk(x, y, w, h) {
    roundRect(x, y, w, h, 13, "rgba(58, 36, 31, 0.92)", "#151220");
    ctx.strokeStyle = "rgba(121, 82, 55, 0.45)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 8 + i * 8, y + 8);
      ctx.quadraticCurveTo(x + 2 + i * 10, y + h * 0.5, x + 10 + i * 6, y + h - 12);
      ctx.stroke();
    }
  }

  function drawLadder(x, y, h, s) {
    ctx.strokeStyle = "#b0774d";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.moveTo(x + 24 * s, y);
    ctx.lineTo(x + 24 * s, y + h);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + i * 18 * s);
      ctx.lineTo(x + 24 * s, y + i * 18 * s);
      ctx.stroke();
    }
  }

  function drawCaveBackdrop(cam) {
    ctx.save();
    ctx.globalAlpha = 0.72;
    for (let i = 0; i < 7; i++) {
      const baseX = ((i * 310 - cam.x * 0.12) % (W + 360)) - 170;
      const baseY = 130 + (i % 3) * 70;
      ctx.fillStyle = i % 2 ? "#263451" : "#314468";
      ctx.beginPath();
      ctx.moveTo(baseX - 70, H);
      ctx.quadraticCurveTo(baseX + 20, baseY - 80, baseX + 110, H);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(177, 202, 232, 0.16)";
      ctx.beginPath();
      ctx.ellipse(baseX + 28, baseY, 44, 105, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < 18; i++) {
      const x = ((i * 157 - cam.x * 0.28) % (W + 180)) - 80;
      const y = 34 + (i % 5) * 28;
      drawPebbleCluster(x, y, 0.75 + (i % 3) * 0.18);
    }
    ctx.restore();
  }

  function drawPebbleCluster(x, y, s) {
    const colors = ["#3a3d4e", "#565e68", "#2c2a39"];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.ellipse(x + i * 13 * s, y + ((i * 7) % 17) * s, 10 * s, 7 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPortal(cam) {
    const x = ((WORLD_W * TILE * 0.64 - cam.x) * 0.72) + 170;
    const y = H * 0.42;
    ctx.save();
    ctx.globalAlpha = 0.88;
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(213, 84, 255, ${0.2 + i * 0.13})`;
      ctx.lineWidth = 18 - i * 3;
      ctx.beginPath();
      ctx.ellipse(x, y, 38 + i * 9, 74 + i * 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "#f191ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, y, 30, 62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawVines(cam) {
    ctx.save();
    ctx.strokeStyle = "#38b85b";
    ctx.lineWidth = 4;
    for (let i = 0; i < 22; i++) {
      const x = ((i * 117 - cam.x * 0.38) % (W + 120)) - 40;
      const top = 28 + (i % 4) * 17;
      const len = 58 + (i % 5) * 22;
      ctx.beginPath();
      ctx.moveTo(x, top);
      for (let y = 0; y < len; y += 14) {
        ctx.lineTo(x + Math.sin((y + i * 9) * 0.16) * 8, top + y);
      }
      ctx.stroke();
      ctx.fillStyle = "#69d76c";
      for (let n = 0; n < 3; n++) {
        ctx.beginPath();
        ctx.ellipse(x + 9 * (n % 2 ? 1 : -1), top + 16 + n * 19, 7, 3, n, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawGlowMotes(cam) {
    ctx.save();
    for (let i = 0; i < 30; i++) {
      const x = ((i * 89 + dayTime * 18000 - cam.x * 0.18) % W + W) % W;
      const y = 80 + ((i * 61 + dayTime * 14000) % (H - 180));
      const a = 0.25 + Math.sin(dayTime * 80 + i) * 0.18;
      drawCircle(x, y, 2 + (i % 3), `rgba(255, 220, 89, ${a})`, "transparent", 0);
    }
    ctx.restore();
  }

  function drawRain(cam) {
    ctx.strokeStyle = "rgba(212, 238, 255, 0.55)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 120; i++) {
      const x = (i * 67 + dayTime * 80000 - cam.x * 0.25) % W;
      const y = (i * 43 + dayTime * 110000) % H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 10, y + 24);
      ctx.stroke();
    }
  }

  function cloud(x, y, s) {
    ctx.beginPath();
    ctx.ellipse(x, y + 16 * s, 38 * s, 17 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 34 * s, y + 9 * s, 44 * s, 21 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 78 * s, y + 17 * s, 38 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTerrain(cam) {
    const startX = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const endX = Math.min(WORLD_W - 1, Math.ceil((cam.x + W) / TILE) + 1);
    const startY = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const endY = Math.min(WORLD_H - 1, Math.ceil((cam.y + H) / TILE) + 1);
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const id = world[y][x];
        if (!id) continue;
        drawBlock(id, x * TILE - cam.x, y * TILE - cam.y, x, y);
      }
    }
  }

  function drawForegroundDecor(cam) {
    const startX = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const endX = Math.min(WORLD_W - 1, Math.ceil((cam.x + W) / TILE) + 1);
    for (let tx = startX; tx <= endX; tx++) {
      const ty = surface[tx];
      if (getTile(tx, ty) !== "grass") continue;
      const x = tx * TILE - cam.x;
      const y = ty * TILE - cam.y;
      if ((tx * 17) % 11 < 3) drawGrassTuft(x + 6, y - 5, 0.9 + ((tx * 13) % 4) * 0.12);
      if ((tx * 29) % 37 === 8) drawMushroom(x + 20, y - 3, "#56b6da");
      if ((tx * 31) % 43 === 12) drawMushroom(x + 12, y - 3, "#7c6cf0");
      if ((tx * 19) % 53 === 7) drawFirefly(x + 17, y - 22);
    }
  }

  function drawGrassTuft(x, y, s) {
    ctx.save();
    ctx.strokeStyle = "#7cf05f";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 5 * s, y + 8 * s);
      ctx.quadraticCurveTo(x + (i * 5 - 4) * s, y - (6 + i) * s, x + (i * 5 - 1) * s, y - 12 * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMushroom(x, y, color) {
    roundRect(x - 3, y - 12, 6, 13, 3, "#d6d0bd", COLORS.outline);
    ctx.beginPath();
    ctx.ellipse(x, y - 13, 13, 8, 0, Math.PI, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.outline;
    ctx.stroke();
    drawCircle(x - 4, y - 16, 2, "#e5f8ff", "transparent", 0);
    drawCircle(x + 5, y - 14, 2, "#e5f8ff", "transparent", 0);
  }

  function drawFirefly(x, y) {
    const pulse = 0.45 + Math.sin(performance.now() * 0.006 + x) * 0.22;
    drawCircle(x, y, 12, `rgba(255, 218, 73, ${pulse * 0.25})`, "transparent", 0);
    drawCircle(x, y, 3, `rgba(255, 230, 105, ${pulse})`, "transparent", 0);
  }

  function drawBlock(id, x, y, tx, ty) {
    const block = BLOCKS[id];
    const r = id === "torch" ? 7 : 8;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.outline;
    ctx.fillStyle = block.color;
    if (id === "torch") {
      drawCircle(x + 16, y + 12, 30 + Math.sin(performance.now() * 0.008) * 5, "rgba(255, 156, 45, 0.22)", "transparent", 0);
      drawCircle(x + 16, y + 12, 14 + Math.sin(performance.now() * 0.008) * 2, "rgba(255, 208, 80, 0.5)", "transparent", 0);
      roundRect(x + 12, y + 8, 8, 22, 4, "#7a482f", COLORS.outline);
      drawCircle(x + 16, y + 8, 8, "#ffd55e", COLORS.outline, 2);
      drawCircle(x + 16, y + 7, 4, "#fff0a1", "transparent", 0);
    } else if (id === "leaf") {
      drawCircle(x + 16, y + 16, 17, block.color, COLORS.outline, 2);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.arc(x + 8, y + 8, 7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const base = id === "grass" ? COLORS.dirt : block.color;
      roundRect(x + 1, y + 2, TILE - 2, TILE - 2, r, base, COLORS.outline);
      ctx.fillStyle = shadeFor(id);
      ctx.beginPath();
      ctx.roundRect(x + 5, y + 21, TILE - 10, 7, 4);
      ctx.fill();
      ctx.fillStyle = id === "stone" ? "rgba(210,220,222,0.12)" : "rgba(255,220,160,0.14)";
      ctx.beginPath();
      ctx.roundRect(x + 6, y + 7, 12, 5, 4);
      ctx.fill();
      if (id === "grass") {
        ctx.fillStyle = COLORS.grass;
        ctx.beginPath();
        ctx.roundRect(x + 0, y - 1, TILE, 12, 6);
        ctx.fill();
        ctx.fillStyle = COLORS.moss;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.ellipse(x + 5 + i * 7, y + 2 + (i % 2) * 2, 5, 8, -0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = COLORS.grassDark;
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 9, TILE - 6, 6, 4);
        ctx.fill();
      }
      if (id === "dirt" || id === "stone") drawStoneFacets(x, y, id);
      if (id === "ore") {
        drawStoneFacets(x, y, "stone");
        for (let i = 0; i < 4; i++) {
          const gx = x + 8 + i * 6;
          const gy = y + 9 + (i % 2) * 9;
          drawCircle(gx, gy, 9, "rgba(255, 204, 61, 0.18)", "transparent", 0);
          drawCircle(gx, gy, 4, COLORS.oreGlow, "rgba(36,29,21,0.7)", 1);
        }
      }
      if (id === "wood") drawWoodLines(x, y);
      if (id === "bench") drawBenchDetails(x, y);
    }

    if (mining && mining.tx === tx && mining.ty === ty) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + 16, y + 16, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, mining.progress / block.hardness));
      ctx.stroke();
    }
    ctx.restore();
  }

  function shadeFor(id) {
    if (id === "dirt") return COLORS.dirtDark;
    if (id === "stone") return COLORS.stoneDark;
    if (id === "grass") return COLORS.grassDark;
    if (id === "wood") return "#7e4a2d";
    if (id === "bench") return "#8d5634";
    return "rgba(91,72,35,0.28)";
  }

  function drawStoneFacets(x, y, id) {
    const lines = id === "stone" ? "rgba(22, 18, 32, 0.42)" : "rgba(51, 31, 28, 0.44)";
    const hi = id === "stone" ? "rgba(198, 213, 218, 0.18)" : "rgba(255, 205, 144, 0.13)";
    ctx.strokeStyle = lines;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 18);
    ctx.lineTo(x + 15, y + 13);
    ctx.lineTo(x + 25, y + 17);
    ctx.moveTo(x + 10, y + 26);
    ctx.lineTo(x + 18, y + 22);
    ctx.lineTo(x + 27, y + 27);
    ctx.stroke();
    ctx.fillStyle = hi;
    ctx.beginPath();
    ctx.ellipse(x + 12, y + 9, 8, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWoodLines(x, y) {
    ctx.strokeStyle = "rgba(62, 35, 25, 0.55)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 8 + i * 7, y + 5);
      ctx.quadraticCurveTo(x + 5 + i * 8, y + 16, x + 10 + i * 6, y + 28);
      ctx.stroke();
    }
  }

  function drawBenchDetails(x, y) {
    ctx.strokeStyle = "rgba(63, 36, 24, 0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 11);
    ctx.lineTo(x + 27, y + 11);
    ctx.moveTo(x + 9, y + 21);
    ctx.lineTo(x + 9, y + 29);
    ctx.moveTo(x + 23, y + 21);
    ctx.lineTo(x + 23, y + 29);
    ctx.stroke();
  }

  function drawPlayer(cam) {
    const x = player.x - cam.x;
    const y = player.y - cam.y;
    const walking = Math.abs(player.vx) > 45 && player.onGround;
    const step = Math.sin(walkTime);
    const jumpLean = player.onGround ? 0 : Math.max(-0.28, Math.min(0.28, player.vy / 1600));
    const miningPose = mining && selectedItem() === "pickaxe";
    ctx.save();
    if (player.hurt > 0) ctx.globalAlpha = 0.62 + Math.sin(performance.now() * 0.04) * 0.2;
    ctx.translate(x + player.w / 2, y + player.h / 2);
    ctx.scale(player.facing, 1);
    ctx.rotate(jumpLean);

    ctx.save();
    ctx.rotate(-0.18 * step);
    roundRect(-15, -9, 9, 24, 4, "#d58a54", COLORS.outline);
    roundRect(-17, 10, 9, 21 + step * 2, 4, "#5c8b4c", COLORS.outline);
    ctx.restore();

    ctx.save();
    ctx.rotate(0.18 * step);
    roundRect(7, -8, 9, 24, 4, "#d58a54", COLORS.outline);
    roundRect(7, 10, 9, 21 - step * 2, 4, "#6b4735", COLORS.outline);
    ctx.restore();

    roundRect(-12, -15, 24, 31, 7, "#b96642", COLORS.outline);
    roundRect(-9, -10, 18, 19, 5, "#2f9a58", COLORS.outline);
    roundRect(-13, -17, 26, 9, 4, "#d98954", COLORS.outline);
    drawCircle(0, -29, 14, "#f2b98f", COLORS.outline, 3);

    ctx.fillStyle = "#238fd0";
    ctx.beginPath();
    ctx.ellipse(-5, -35, 16, 10, -0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 3;
    ctx.stroke();
    roundRect(-15, -33, 9, 17, 5, "#1b74b7", COLORS.outline);
    roundRect(-14, 15, 8, 18 + step * 2, 4, "#7a493a", COLORS.outline);
    roundRect(5, 15, 8, 18 - step * 2, 4, "#7a493a", COLORS.outline);
    drawCircle(-5, -26, 2, "#142033", "transparent", 0);
    drawCircle(6, -26, 2, "#142033", "transparent", 0);
    ctx.strokeStyle = "#7a3d39";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(1, -20, 5, 0.15, Math.PI - 0.15);
    ctx.stroke();

    const held = selectedItem();
    if (miningPose) {
      const lift = Math.sin((mining?.progress || 0) * 18) * 0.7;
      ctx.save();
      ctx.rotate(-1.15 + lift);
      drawHeldTool(held, "mine");
      ctx.restore();
    } else if (player.swing > 0) {
      ctx.save();
      if (held === "sword") {
        ctx.translate((1 - player.swing) * 18, 0);
        ctx.rotate(0.08);
      } else {
        ctx.rotate(-0.95 + player.swing * 1.45);
        ctx.fillStyle = "rgba(255, 209, 82, 0.18)";
        ctx.beginPath();
        ctx.ellipse(37, 0, 54, 18, 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
      drawHeldTool(held, "attack");
      ctx.restore();
    } else if (held) {
      ctx.save();
      ctx.rotate(held === "bow" ? -0.25 : 0.45);
      drawHeldTool(held, "idle");
      ctx.restore();
    }
    ctx.restore();
  }

  function drawHeldTool(item, mode) {
    if (item === "pickaxe" || item === "axe") {
      roundRect(13, -7, 40, 7, 3, "#7d5638", COLORS.outline);
      if (item === "pickaxe") {
        ctx.beginPath();
        ctx.moveTo(45, -17);
        ctx.lineTo(70, -8);
        ctx.lineTo(50, 5);
        ctx.lineTo(41, 1);
        ctx.closePath();
      } else {
        ctx.beginPath();
        ctx.ellipse(52, -5, 15, 10, -0.45, 0, Math.PI * 2);
      }
      ctx.fillStyle = item === "axe" ? "#c1c9c9" : "#a8b6bd";
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 3;
      ctx.stroke();
      return;
    }
    if (item === "sword") {
      if (mode === "attack") {
        roundRect(15, -4, 52, 8, 3, "#f2a044", COLORS.outline);
        roundRect(22, -1, 34, 3, 2, "#ffd47c", "transparent");
        return;
      }
      ctx.beginPath();
      ctx.moveTo(13, -8);
      ctx.lineTo(66, -2);
      ctx.lineTo(74, 2);
      ctx.lineTo(64, 8);
      ctx.lineTo(13, 5);
      ctx.closePath();
      ctx.fillStyle = "#f2a044";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.outline;
      ctx.stroke();
      roundRect(18, -3, 40, 4, 2, "#ffd47c", "transparent");
      return;
    }
    if (item === "bow") {
      ctx.strokeStyle = "#bd7741";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(32, 0, 22, -1.25, 1.25);
      ctx.stroke();
      ctx.strokeStyle = "#f7e2ba";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(39, -20);
      ctx.lineTo(39, 20);
      ctx.stroke();
      return;
    }
    if (item === "torch") {
      roundRect(16, -1, 8, 30, 4, "#75452c", COLORS.outline);
      drawCircle(20, -5, 10, "rgba(255, 190, 68, 0.35)", "transparent", 0);
      drawCircle(20, -7, 6, "#ffd55e", COLORS.outline, 2);
      return;
    }
    if (PLACEABLE.has(item) || item === "ore" || item === "gel") {
      const color = itemMeta(item).color || COLORS.ore;
      roundRect(19, -6, 18, 18, 4, color, COLORS.outline);
    }
  }

  function drawEnemies(cam) {
    for (const e of enemies) {
      const x = e.x - cam.x;
      const y = e.y - cam.y;
      ctx.save();
      if (e.hurt > 0) ctx.globalAlpha = 0.55;
      ctx.scale(1, 1 + Math.sin(performance.now() * 0.008 + e.x) * 0.04);
      const bodyColor = e.maxHp > 30 ? COLORS.slimePurple : COLORS.slime;
      ctx.fillStyle = "rgba(0,0,0,0.24)";
      ctx.beginPath();
      ctx.ellipse(x + 15, y + 27, 20, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 1, y + 22);
      ctx.quadraticCurveTo(x + 5, y + 3, x + 16, y + 3);
      ctx.quadraticCurveTo(x + 30, y + 4, x + 31, y + 22);
      ctx.quadraticCurveTo(x + 24, y + 31, x + 15, y + 29);
      ctx.quadraticCurveTo(x + 5, y + 31, x + 1, y + 22);
      ctx.fillStyle = bodyColor;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.outline;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.ellipse(x + 10, y + 10, 6, 3, -0.3, 0, Math.PI * 2);
      ctx.fill();
      drawCircle(x + 9, y + 16, 3, "#24172b", "transparent", 0);
      drawCircle(x + 22, y + 16, 3, "#24172b", "transparent", 0);
      ctx.strokeStyle = "#24172b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 16, y + 20, 6, 0.05, Math.PI - 0.05);
      ctx.stroke();
      ctx.restore();
      roundRect(x - 6, y - 14, 42, 7, 3, "rgba(0,0,0,0.48)", "#fff5df");
      roundRect(x - 4, y - 12, 38 * Math.max(0, e.hp / e.maxHp), 3, 2, "#75f061", "transparent");
    }
  }

  function drawDrops(cam) {
    for (const d of drops) {
      const color = BLOCKS[d.id]?.color || "#8de870";
      drawCircle(d.x - cam.x, d.y - cam.y, d.r, color, COLORS.outline, 2);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.arc(d.x - cam.x - 4, d.y - cam.y - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawProjectiles(cam) {
    for (const p of projectiles) {
      const x = p.x - cam.x;
      const y = p.y - cam.y;
      const angle = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      roundRect(-13, -2, 22, 4, 2, "#d9c48a", COLORS.outline);
      ctx.beginPath();
      ctx.moveTo(10, -5);
      ctx.lineTo(20, 0);
      ctx.lineTo(10, 5);
      ctx.closePath();
      ctx.fillStyle = "#bfc8c7";
      ctx.fill();
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawParticles(cam) {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 1.6);
      drawCircle(p.x - cam.x, p.y - cam.y, p.r, p.color, "transparent", 0);
      ctx.globalAlpha = 1;
    }
  }

  function drawCursor(cam) {
    const p = screenToWorld();
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor(p.y / TILE);
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    const inReach = Math.hypot(cx - (player.x + player.w / 2), cy - (player.y + player.h / 2)) <= REACH;
    ctx.strokeStyle = inReach ? "rgba(255, 231, 126, 0.9)" : "rgba(255,255,255,0.28)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(tx * TILE - cam.x + 3, ty * TILE - cam.y + 3, TILE - 6, TILE - 6, 7);
    ctx.stroke();
  }

  function drawLighting() {
    const nightStrength = dayTime > 0.72 || dayTime < 0.22 ? 0.2 : 0.08;
    const rainStrength = weather === "rain" ? 0.1 : 0;
    ctx.fillStyle = `rgba(10, 5, 18, ${nightStrength + rainStrength})`;
    ctx.fillRect(0, 0, W, H);

    const p = ctx.createRadialGradient(player.x - getCamera().x + 12, player.y - getCamera().y + 10, 20, player.x - getCamera().x + 12, player.y - getCamera().y + 10, 210);
    p.addColorStop(0, "rgba(255, 205, 104, 0.14)");
    p.addColorStop(1, "rgba(255, 205, 104, 0)");
    ctx.fillStyle = p;
    ctx.fillRect(0, 0, W, H);
  }

  function drawMinimap(cam) {
    const boxW = 176;
    const boxH = 118;
    const x = W - boxW - 20;
    const y = 86;
    roundRect(x - 5, y - 5, boxW + 10, boxH + 10, 5, "rgba(10, 5, 10, 0.86)", "#d28b58");
    roundRect(x, y, boxW, boxH, 3, "#050906", "#3a231f");
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, boxW, boxH);
    ctx.clip();
    const scale = 0.085;
    const centerX = player.x / TILE;
    const centerY = player.y / TILE;
    for (let ty = Math.max(0, Math.floor(centerY - 28)); ty < Math.min(WORLD_H, Math.ceil(centerY + 28)); ty++) {
      for (let tx = Math.max(0, Math.floor(centerX - 42)); tx < Math.min(WORLD_W, Math.ceil(centerX + 42)); tx++) {
        const id = getTile(tx, ty);
        if (!id) continue;
        ctx.fillStyle = id === "grass" ? "#45d95b" : id === "stone" ? "#7c8491" : id === "ore" ? "#ffd44e" : "#8f5e3d";
        ctx.fillRect(x + boxW / 2 + (tx - centerX) * TILE * scale, y + boxH / 2 + (ty - centerY) * TILE * scale, Math.ceil(TILE * scale), Math.ceil(TILE * scale));
      }
    }
    drawCircle(x + boxW / 2, y + boxH / 2, 3, "#ff3b40", "transparent", 0);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill && fill !== "transparent") {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && stroke !== "transparent") {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function drawCircle(x, y, r, fill, stroke, line = 2) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill && fill !== "transparent") {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && stroke !== "transparent" && line > 0) {
      ctx.lineWidth = line;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function itemMeta(id) {
    return ITEMS[id] || { name: id, type: "物品", rarity: "普通", sprite: "block", color: "#dfe8ef", use: "" };
  }

  function renderHud() {
    const hour = Math.floor(dayTime * 24);
    const minute = Math.floor((dayTime * 24 - hour) * 60);
    const hearts = iconMeter("heart", Math.ceil(player.hp / player.maxHp * 8), 8, "♥");
    const stars = iconMeter("star", Math.ceil(player.mana / player.maxMana * 3), 3, "★");
    statsEl.innerHTML = `
      <div class="icon-row"><span class="hearts">${hearts}</span> ${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}</div>
      <div class="icon-row"><span class="stars">${stars}</span> ${player.mana}/${player.maxMana}</div>
      <div>时间 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} · ${weather === "rain" ? "雨天" : "晴天"} · 敌人 ${enemies.length}</div>
    `;
    hotbarEl.innerHTML = inventorySlots.slice(0, 10).map((id, i) => {
      if (!id) {
        return `<div class="slot ${slotClass(i)}" data-slot="${i}"><span class="key">${i === 9 ? 0 : i + 1}</span></div>`;
      }
      const meta = itemMeta(id);
      const count = inventory[id] || 0;
      const icon = itemIcon(id);
      return `<div class="slot ${slotClass(i)}" data-slot="${i}" data-item="${id}" data-tip="${itemTip(id)}">
        <span class="key">${i === 9 ? 0 : i + 1}</span>${icon}<span class="count">${count || ""}</span>
      </div>`;
    }).join("");
    renderPanels();
  }

  function iconMeter(cls, filled, total, mark) {
    return Array.from({ length: total }, (_, i) => `<span class="${cls} ${i >= filled ? "empty" : ""}">${mark}</span>`).join("");
  }

  function slotClass(i) {
    return `${i === selected ? "active" : ""} ${pendingSwapSlot === i ? "moving" : ""}`.trim();
  }

  function itemIcon(id) {
    const meta = itemMeta(id);
    const color = meta.color || BLOCKS[id]?.color || "#dfe8ef";
    const sprite = meta.sprite === "block" ? "sprite-block" : `sprite-${meta.sprite}`;
    return `<span class="item-sprite ${sprite}" style="--item-color:${color}"></span>`;
  }

  function renderPanels() {
    inventoryPanelEl.classList.toggle("open", inventoryOpen);
    craftPanelEl.classList.toggle("open", craftOpen);
    if (inventoryOpen) {
      const slots = Array.from({ length: 40 }, (_, i) => {
        const id = inventorySlots[i];
        if (!id) return `<div class="bag-slot ${pendingSwapSlot === i ? "moving" : ""}" data-slot="${i}"></div>`;
        const count = inventory[id] || 0;
        const meta = itemMeta(id);
        return `<div class="bag-slot ${pendingSwapSlot === i ? "moving" : ""}" data-slot="${i}" data-item="${id}" data-tip="${itemTip(id)}">
          <span class="name">${meta.name}</span>${itemIcon(id)}<span class="count">${count || ""}</span>
        </div>`;
      }).join("");
      const html = `<div class="panel-title"><span>背包</span><span>E关闭</span></div><div class="inventory-grid">${slots}</div>`;
      if (html !== lastInventoryHtml) {
        inventoryPanelEl.innerHTML = html;
        lastInventoryHtml = html;
      }
    }
    if (craftOpen) {
      const list = recipes.map((recipe) => {
        const enough = canCraft(recipe);
        const needs = Object.entries(recipe.needs).map(([id, count]) => `${itemMeta(id).name}x${count}`).join("  ");
        return `<button class="recipe" data-recipe="${recipe.id}" ${enough ? "" : "disabled"}>
          <strong>${recipe.name}</strong><span>${needs}</span>
        </button>`;
      }).join("");
      const html = `<div class="panel-title"><span>合成</span><span>C关闭</span></div><div class="recipe-list">${list}</div>`;
      if (html !== lastCraftHtml) {
        craftPanelEl.innerHTML = html;
        lastCraftHtml = html;
      }
    }
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    updateWorld(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    updateDrops(dt);
    updateProjectiles(dt);
    updateParticles(dt);
    updateActions(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
    keys.add(k);
    if (/^[1-9]$/.test(k)) selected = Number(k) - 1;
    if (k === "0") selected = 9;
    if (k === "c" && !e.repeat) craft();
    if (k === "e" && !e.repeat) {
      inventoryOpen = !inventoryOpen;
      if (!inventoryOpen) craftOpen = false;
      showToast(inventoryOpen ? "背包已打开" : "背包已关闭");
      renderPanels();
    }
  });

  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) mouse.down = true;
    if (e.button === 2) mouse.right = true;
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.right = false;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  craftPanelEl.addEventListener("click", (e) => {
    const button = e.target.closest("[data-recipe]");
    if (button) craftRecipe(button.dataset.recipe);
  });
  menuToggleEl.addEventListener("click", () => {
    menuOpen = !menuOpen;
    menuToggleEl.setAttribute("aria-expanded", String(menuOpen));
    menuPanelEl.parentElement.classList.toggle("open", menuOpen);
  });
  document.addEventListener("mousemove", (e) => {
    const itemEl = e.target instanceof Element ? e.target.closest("[data-item]") : null;
    if (!itemEl) {
      tooltipEl.classList.remove("show");
      return;
    }
    showItemTooltip(itemEl.dataset.item, e.clientX, e.clientY);
  });
  document.addEventListener("mouseleave", () => tooltipEl.classList.remove("show"));
  document.addEventListener("pointerdown", (e) => {
    const slotEl = e.target instanceof Element ? e.target.closest("[data-slot]") : null;
    if (!slotEl || !slotEl.dataset.item || e.button !== 0) return;
    const slot = Number(slotEl.dataset.slot);
    if (slot >= 10 && !inventoryOpen) return;
    pointerDrag = { slot, item: slotEl.dataset.item, startX: e.clientX, startY: e.clientY, active: false };
  });
  document.addEventListener("pointermove", (e) => {
    if (!pointerDrag) return;
    const moved = Math.hypot(e.clientX - pointerDrag.startX, e.clientY - pointerDrag.startY);
    if (!pointerDrag.active && moved > 6) {
      pointerDrag.active = true;
      pendingSwapSlot = pointerDrag.slot;
      tooltipEl.classList.remove("show");
      createDragGhost(pointerDrag.item, e.clientX, e.clientY);
      renderHud();
    }
    if (pointerDrag.active) {
      e.preventDefault();
      moveDragGhost(e.clientX, e.clientY);
    }
  });
  document.addEventListener("pointerup", (e) => {
    if (!pointerDrag) return;
    const wasActive = pointerDrag.active;
    const from = pointerDrag.slot;
    cleanupDragGhost();
    pointerDrag = null;
    if (!wasActive) return;
    suppressSlotClick = true;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = target instanceof Element ? target.closest("[data-slot]") : null;
    if (slotEl) swapSlots(from, Number(slotEl.dataset.slot));
    else {
      pendingSwapSlot = null;
      renderHud();
    }
  });
  document.addEventListener("click", (e) => {
    if (suppressSlotClick) {
      suppressSlotClick = false;
      return;
    }
    const slotEl = e.target instanceof Element ? e.target.closest("[data-slot]") : null;
    if (!slotEl) return;
    const slot = Number(slotEl.dataset.slot);
    if (slot < 10 && !inventoryOpen) {
      selected = slot;
      renderHud();
      return;
    }
    if (!inventoryOpen) return;
    if (pendingSwapSlot === null) {
      pendingSwapSlot = slot;
      renderHud();
      return;
    }
    swapSlots(pendingSwapSlot, slot);
    pendingSwapSlot = null;
    renderHud();
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    selected = (selected + Math.sign(e.deltaY) + 10) % 10;
  }, { passive: false });

  function swapSlots(from, to) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= inventorySlots.length || to >= inventorySlots.length || from === to) return;
    const temp = inventorySlots[from];
    inventorySlots[from] = inventorySlots[to];
    inventorySlots[to] = temp;
    if (selected === from && to < 10) selected = to;
    pendingSwapSlot = null;
    renderHud();
    showToast("物品位置已交换");
  }

  function createDragGhost(item, clientX, clientY) {
    cleanupDragGhost();
    dragGhostEl = document.createElement("div");
    dragGhostEl.className = "drag-ghost";
    dragGhostEl.innerHTML = itemIcon(item);
    gameFrameEl.appendChild(dragGhostEl);
    moveDragGhost(clientX, clientY);
  }

  function moveDragGhost(clientX, clientY) {
    if (!dragGhostEl) return;
    const rect = gameFrameEl.getBoundingClientRect();
    dragGhostEl.style.left = `${clientX - rect.left}px`;
    dragGhostEl.style.top = `${clientY - rect.top}px`;
  }

  function cleanupDragGhost() {
    if (dragGhostEl) dragGhostEl.remove();
    dragGhostEl = null;
  }

  function showItemTooltip(id, clientX, clientY) {
    const item = itemMeta(id);
    const lines = [
      `<span class="tooltip-name">${item.name}</span>`,
      `<span class="tooltip-line tooltip-rare">${item.rarity || "普通"} · ${item.type || "物品"}</span>`,
    ];
    if (item.damage) lines.push(`<span class="tooltip-line">${item.damage} 伤害</span>`);
    if (item.power) lines.push(`<span class="tooltip-line">${item.power}% 工具力</span>`);
    if (item.knockback) lines.push(`<span class="tooltip-line">击退：${item.knockback}</span>`);
    if (item.use) lines.push(`<span class="tooltip-line">${item.use}</span>`);
    tooltipEl.innerHTML = lines.join("");
    const frame = canvas.getBoundingClientRect();
    const x = Math.min(frame.width - 280, Math.max(8, clientX - frame.left + 14));
    const y = Math.min(frame.height - 132, Math.max(8, clientY - frame.top + 16));
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
    tooltipEl.classList.add("show");
  }

  function itemTip(id) {
    const item = itemMeta(id);
    const parts = [`${item.name}`, `${item.rarity || "普通"} · ${item.type || "物品"}`];
    if (item.damage) parts.push(`${item.damage} 伤害`);
    if (item.power) parts.push(`${item.power}% 工具力`);
    if (item.knockback) parts.push(`击退：${item.knockback}`);
    if (item.use) parts.push(item.use);
    return escapeAttr(parts.join("\n"));
  }

  function escapeAttr(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("\"", "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function polyfillRoundRect(x, y, w, h, r) {
      const radius = Math.min(r, w / 2, h / 2);
      this.moveTo(x + radius, y);
      this.arcTo(x + w, y, x + w, y + h, radius);
      this.arcTo(x + w, y + h, x, y + h, radius);
      this.arcTo(x, y + h, x, y, radius);
      this.arcTo(x, y, x + w, y, radius);
      return this;
    };
  }

  generateWorld();
  requestAnimationFrame(loop);
})();
