extends Node2D

const TILE := 32
const WORLD_W := 240
const WORLD_H := 92
const GRAVITY := 2250.0
const MAX_FALL := 980.0
const MOVE_SPEED := 285.0
const JUMP_SPEED := 900.0
const REACH := 5.5 * TILE

const COLORS := {
	"outline": Color("#151220"),
	"grass": Color("#66d64f"),
	"grass_dark": Color("#268c43"),
	"moss": Color("#8df05a"),
	"dirt": Color("#8a5a3e"),
	"dirt_dark": Color("#4b342e"),
	"stone": Color("#67717b"),
	"stone_dark": Color("#353946"),
	"ore": Color("#ffd453"),
	"ore_glow": Color("#fff1a0"),
	"wood": Color("#a96b43"),
	"leaf": Color("#42b45d"),
	"torch": Color("#ffbd3d"),
	"bench": Color("#c07a46"),
	"slime": Color("#8ce448"),
	"slime_purple": Color("#b947e8"),
}

const BLOCKS := {
	"grass": {"name": "草地", "solid": true, "hardness": 0.38, "drop": "dirt"},
	"dirt": {"name": "泥土", "solid": true, "hardness": 0.35, "drop": "dirt"},
	"stone": {"name": "石块", "solid": true, "hardness": 0.70, "drop": "stone"},
	"ore": {"name": "铜矿", "solid": true, "hardness": 0.95, "drop": "ore"},
	"wood": {"name": "木材", "solid": true, "hardness": 0.42, "drop": "wood"},
	"leaf": {"name": "树叶", "solid": false, "hardness": 0.20, "drop": null},
	"torch": {"name": "火把", "solid": false, "hardness": 0.15, "drop": "torch"},
	"bench": {"name": "工作台", "solid": true, "hardness": 0.45, "drop": "bench"},
}

const ITEMS := {
	"pickaxe": {"name": "铜镐", "type": "镐", "rarity": "普通", "damage": 4, "power": 35, "use_time": 23, "use": "用于挖掘泥土、石块和矿石。对石块/矿石效率最高。"},
	"sword": {"name": "铜短剑", "type": "近战武器", "rarity": "普通", "damage": 5, "use_time": 13, "knockback": "弱", "use": "点击左键快速刺击，适合开局防身。"},
	"axe": {"name": "铜斧", "type": "斧", "rarity": "普通", "damage": 7, "power": 35, "use_time": 30, "use": "用于砍树和清理树叶。对木材效率最高。"},
	"bow": {"name": "木弓", "type": "远程武器", "rarity": "普通", "damage": 9, "use_time": 30, "use": "基础远程武器。左键发射木箭，消耗背包中的木箭。"},
	"arrow": {"name": "木箭", "type": "弹药", "rarity": "普通", "damage": 6, "use": "木弓消耗的基础弹药。"},
	"dirt": {"name": "泥土块", "type": "方块", "rarity": "普通", "use": "最基础的建筑方块，可右键放置。"},
	"stone": {"name": "石块", "type": "方块", "rarity": "普通", "use": "坚硬的建筑材料，可右键放置。"},
	"wood": {"name": "木材", "type": "材料/方块", "rarity": "普通", "use": "树木掉落的基础材料，可建造和合成。"},
	"ore": {"name": "铜矿石", "type": "矿石", "rarity": "普通", "use": "地下采集的矿物，后续可冶炼装备。"},
	"torch": {"name": "火把", "type": "光源", "rarity": "普通", "use": "右键放置，照亮附近区域。"},
	"bench": {"name": "工作台", "type": "制作站", "rarity": "普通", "use": "右键放置。后续高级配方需要靠近工作台。"},
	"gel": {"name": "凝胶", "type": "材料", "rarity": "普通", "use": "史莱姆掉落物，可与木材合成火把。"},
}

var placeable := {"dirt": true, "stone": true, "wood": true, "torch": true, "bench": true}
var world: Array = []
var surface: Array[int] = []
var rng := RandomNumberGenerator.new()

var player := {
	"x": 0.0, "y": 0.0, "w": 24.0, "h": 48.0,
	"vx": 0.0, "vy": 0.0, "facing": 1,
	"on_ground": false, "hp": 100, "max_hp": 100,
	"mana": 20, "max_mana": 20, "hurt": 0.0, "swing": 0.0,
}

var inventory := {
	"pickaxe": 1, "sword": 1, "axe": 1, "bow": 0, "arrow": 25,
	"dirt": 24, "stone": 0, "wood": 0, "ore": 0, "torch": 8, "bench": 0,
}
var inventory_slots: Array = []
var selected := 0
var inventory_open := false
var craft_open := false
var pending_swap_slot = null
var selected_drag_slot = null

var drops: Array = []
var enemies: Array = []
var projectiles: Array = []
var particles: Array = []
var mining = null
var attack_cooldown := 0.0
var craft_cooldown := 0.0
var day_time := 0.78
var weather := "clear"
var weather_timer := 28.0
var walk_time := 0.0
var toast := ""
var toast_timer := 0.0
var mouse_world := Vector2.ZERO

var ui: CanvasLayer
var hotbar_grid: GridContainer
var inventory_panel: PanelContainer
var inventory_grid: GridContainer
var craft_panel: PanelContainer
var craft_list: VBoxContainer
var stats_label: Label
var tooltip_panel: PanelContainer
var tooltip_label: RichTextLabel
var menu_panel: PanelContainer
var toast_label: Label

func _ready() -> void:
	rng.seed = 20260602
	_init_inventory_slots()
	_generate_world()
	_build_ui()
	show_toast("Godot版基础世界生成完成：挖掘、建造、战斗、合成已开启")

func _init_inventory_slots() -> void:
	var seed_slots := ["pickaxe", "sword", "axe", "dirt", "stone", "wood", "torch", "bench", "bow", "arrow", "ore", "gel"]
	inventory_slots.clear()
	for i in range(40):
		inventory_slots.append(seed_slots[i] if i < seed_slots.size() else null)

func _generate_world() -> void:
	world.clear()
	surface.clear()
	for y in range(WORLD_H):
		world.append([])
		for _x in range(WORLD_W):
			world[y].append(null)
	for x in range(WORLD_W):
		var h := int(floor(31 + _noise_height(x)))
		surface.append(h)
		for y in range(h, WORLD_H):
			var depth := y - h
			var id = "grass" if depth == 0 else ("dirt" if depth < 12 else "stone")
			var cave := sin(x * 0.22 + y * 0.16) + sin(x * 0.07 - y * 0.2)
			if depth > 7 and cave > 1.28 and rng.randf() > 0.32:
				id = null
			if id == "stone" and rng.randf() < 0.024 and depth > 12:
				id = "ore"
			world[y][x] = id
	for x in range(8, WORLD_W - 8, 10):
		if rng.randf() < 0.65:
			_make_tree(x, surface[x] - 1)
	player.x = WORLD_W * TILE * 0.5
	player.y = (surface[int(player.x / TILE)] - 3) * TILE

func _noise_height(x: int) -> float:
	return sin(x * 0.13 + 0.2) * 4 + sin(x * 0.043 + 1.6) * 9 + sin(x * 0.011) * 12

func _make_tree(tx: int, ty: int) -> void:
	var trunk := 4 + int(rng.randi_range(0, 2))
	for i in range(trunk):
		_set_tile(tx, ty - i, "wood")
	var top := ty - trunk
	for oy in range(-2, 3):
		for ox in range(-3, 4):
			if abs(ox) + abs(oy) < 5 and rng.randf() > 0.15:
				_set_tile(tx + ox, top + oy, "leaf")

func _process(delta: float) -> void:
	_update_world(delta)
	_update_player(delta)
	_update_enemies(delta)
	_update_drops(delta)
	_update_projectiles(delta)
	_update_particles(delta)
	_update_actions(delta)
	_update_ui()
	queue_redraw()

func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		mouse_world = get_viewport().get_mouse_position() + _camera()
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_RIGHT and event.pressed:
			_place_block()
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			selected = (selected + 9) % 10
		if event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			selected = (selected + 1) % 10
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode >= KEY_1 and event.keycode <= KEY_9:
			selected = event.keycode - KEY_1
		elif event.keycode == KEY_0:
			selected = 9
		elif event.keycode == KEY_E:
			inventory_open = not inventory_open
			if not inventory_open:
				craft_open = false
			show_toast("背包已打开" if inventory_open else "背包已关闭")
		elif event.keycode == KEY_C:
			craft_open = not craft_open
			if craft_open:
				inventory_open = true
			show_toast("合成面板已打开" if craft_open else "合成面板已关闭")

func _update_world(delta: float) -> void:
	day_time = fmod(day_time + delta / 480.0, 1.0)
	weather_timer -= delta
	if weather_timer <= 0.0:
		weather = "rain" if rng.randf() < 0.24 else "clear"
		weather_timer = 26.0 + rng.randf() * 42.0
	if toast_timer > 0.0:
		toast_timer -= delta
		if toast_timer <= 0.0:
			toast = ""

func _update_player(delta: float) -> void:
	var dir := 0
	if Input.is_action_pressed("move_left"):
		dir -= 1
	if Input.is_action_pressed("move_right"):
		dir += 1
	player.vx = lerpf(player.vx, dir * MOVE_SPEED, min(1.0, delta * 12.0))
	if dir != 0:
		player.facing = dir
	if abs(player.vx) > 40.0 and player.on_ground:
		walk_time += delta * 11.0
	if Input.is_action_pressed("jump") and player.on_ground:
		player.vy = -JUMP_SPEED
	_move_body(player, delta)
	player.x = clamp(player.x, 64.0, WORLD_W * TILE - 96.0)
	player.hurt = max(0.0, player.hurt - delta)
	player.swing = max(0.0, player.swing - delta * 8.0)
	if player.y > WORLD_H * TILE + 300 or player.hp <= 0:
		_respawn()

func _respawn() -> void:
	player.hp = player.max_hp
	player.vx = 0.0
	player.vy = 0.0
	var sx := int(WORLD_W * 0.5)
	player.x = sx * TILE
	player.y = (surface[sx] - 4) * TILE
	show_toast("你回到了出生点")

func _update_actions(delta: float) -> void:
	craft_cooldown = max(0.0, craft_cooldown - delta)
	attack_cooldown = max(0.0, attack_cooldown - delta)
	var item = _selected_item()
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and item != null:
		var item_type: String = str(ITEMS[item].get("type", ""))
		if item_type.find("武器") >= 0:
			_attack()
		elif item_type == "镐" or item_type == "斧":
			_mine(delta)
	else:
		mining = null

func _attack() -> void:
	if attack_cooldown > 0.0:
		return
	var item = _selected_item()
	var damage := int(ITEMS[item].get("damage", 8))
	attack_cooldown = float(ITEMS[item].get("use_time", 20)) / 60.0
	player.swing = 1.0
	if item == "bow":
		_shoot_arrow(damage + int(ITEMS.arrow.damage))
		return
	var center := Vector2(player.x + player.w / 2 + player.facing * (46 if item == "sword" else 34), player.y + 24)
	for enemy in enemies:
		var enemy_center := Vector2(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2)
		if center.distance_to(enemy_center) < (46 if item == "sword" else 62):
			enemy.hp -= damage
			enemy.hurt = 0.22
			enemy.vx += player.facing * 360
			enemy.vy = -240
			_add_particles(enemy_center, Color("#9bf06f"), 7)

func _shoot_arrow(damage: int) -> void:
	if int(inventory.get("arrow", 0)) <= 0:
		show_toast("没有木箭")
		return
	inventory.arrow -= 1
	projectiles.append({"x": player.x + player.w / 2 + player.facing * 22, "y": player.y + 20, "vx": player.facing * 620.0, "vy": -70.0, "damage": damage, "life": 1.4})

func _mine(delta: float) -> void:
	var tx := int(floor(mouse_world.x / TILE))
	var ty := int(floor(mouse_world.y / TILE))
	var id = _get_tile(tx, ty)
	if id == null:
		return
	var center := Vector2(tx * TILE + TILE / 2, ty * TILE + TILE / 2)
	if center.distance_to(Vector2(player.x + player.w / 2, player.y + player.h / 2)) > REACH:
		return
	if mining == null or mining.tx != tx or mining.ty != ty:
		mining = {"tx": tx, "ty": ty, "progress": 0.0}
	mining.progress += delta * _mining_speed(_selected_item(), id)
	if mining.progress >= float(BLOCKS[id].hardness):
		_set_tile(tx, ty, null)
		_add_drop(BLOCKS[id].drop, center, 1)
		_add_particles(center, _block_color(id), 12)
		mining = null

func _mining_speed(tool, block: String) -> float:
	if tool == "pickaxe" and block in ["dirt", "grass", "stone", "ore"]:
		return 1.05 if block == "ore" else 1.25
	if tool == "axe" and block in ["wood", "leaf"]:
		return 2.8 if block == "leaf" else 1.45
	if tool == "axe" and block in ["dirt", "grass"]:
		return 0.36
	if tool == "pickaxe" and block in ["wood", "leaf"]:
		return 0.28
	return 0.18

func _place_block() -> void:
	var item = _selected_item()
	if item == null or not placeable.has(item) or int(inventory.get(item, 0)) <= 0:
		return
	var tx := int(floor(mouse_world.x / TILE))
	var ty := int(floor(mouse_world.y / TILE))
	if _get_tile(tx, ty) != null and _get_tile(tx, ty - 1) == null:
		ty -= 1
	var center := Vector2(tx * TILE + TILE / 2, ty * TILE + TILE / 2)
	if center.distance_to(Vector2(player.x + player.w / 2, player.y + player.h / 2)) > REACH:
		return
	if _get_tile(tx, ty) != null:
		return
	if item == "bench" and not _is_solid(tx, ty + 1):
		show_toast("工作台需要放在地面上")
		return
	if _rect_intersects_tile(player, tx, ty):
		return
	_set_tile(tx, ty, item)
	inventory[item] -= 1
	if int(inventory[item]) <= 0:
		_clear_empty_stack(item)
	_add_particles(center, _block_color(item), 5)

func _update_enemies(delta: float) -> void:
	var night := day_time > 0.72 or day_time < 0.22
	if enemies.size() < (9 if night else 5) and rng.randf() < delta * (0.45 if night else 0.18):
		_spawn_enemy()
	for i in range(enemies.size() - 1, -1, -1):
		var e = enemies[i]
		var dx: float = float(player.x - e.x)
		e.vx += sign(dx) * (170 if night else 125) * delta
		e.vx *= 0.92
		e.jump -= delta
		if e.on_ground and e.jump <= 0.0 and abs(dx) < 520.0:
			e.vy = -520.0
			e.jump = 1.0 + rng.randf() * 1.5
		_move_body(e, delta)
		e.hurt = max(0.0, e.hurt - delta)
		if _overlap(player, e) and player.hurt <= 0.0:
			player.hp -= 12 if night else 8
			player.hurt = 0.75
			player.vx += sign(player.x - e.x) * 330
			player.vy = -280
		if e.hp <= 0:
			_add_particles(Vector2(e.x + e.w / 2, e.y + e.h / 2), Color("#72e186"), 18)
			_add_drop("gel", Vector2(e.x, e.y), 1 + rng.randi_range(0, 1))
			enemies.remove_at(i)

func _spawn_enemy() -> void:
	var side := -1 if rng.randf() < 0.5 else 1
	var tx := clampi(int(player.x / TILE + side * (15 + rng.randf() * 18)), 4, WORLD_W - 5)
	if abs(tx * TILE - player.x) < 330:
		return
	var hp := 42 if day_time > 0.73 or day_time < 0.23 else 26
	enemies.append({"x": tx * TILE, "y": (surface[tx] - 2) * TILE, "w": 30.0, "h": 24.0, "vx": 0.0, "vy": 0.0, "hp": hp, "max_hp": hp, "hurt": 0.0, "jump": rng.randf() * 1.4, "on_ground": false})

func _update_drops(delta: float) -> void:
	for i in range(drops.size() - 1, -1, -1):
		var d = drops[i]
		d.vy = min(MAX_FALL, d.vy + GRAVITY * delta)
		d.x += d.vx * delta
		d.y += d.vy * delta
		if _rect_hits_world(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2):
			d.y -= d.vy * delta
			d.vy *= -0.18
			d.vx *= 0.78
		var dist := Vector2(d.x, d.y).distance_to(Vector2(player.x + player.w / 2, player.y + player.h / 2))
		if dist < 128:
			d.x = lerpf(d.x, player.x + player.w / 2, delta * 5)
			d.y = lerpf(d.y, player.y + player.h / 2, delta * 5)
		if dist < 30:
			inventory[d.id] = int(inventory.get(d.id, 0)) + d.count
			_ensure_item_slotted(d.id)
			drops.remove_at(i)

func _update_projectiles(delta: float) -> void:
	for i in range(projectiles.size() - 1, -1, -1):
		var p = projectiles[i]
		p.life -= delta
		p.vy += GRAVITY * 0.18 * delta
		p.x += p.vx * delta
		p.y += p.vy * delta
		if p.life <= 0.0 or _rect_hits_world(p.x - 2, p.y - 2, 4, 4):
			projectiles.remove_at(i)
			continue
		for enemy in enemies:
			if p.x > enemy.x and p.x < enemy.x + enemy.w and p.y > enemy.y and p.y < enemy.y + enemy.h:
				enemy.hp -= p.damage
				enemy.hurt = 0.18
				enemy.vx += sign(p.vx) * 260
				projectiles.remove_at(i)
				break

func _update_particles(delta: float) -> void:
	for i in range(particles.size() - 1, -1, -1):
		var p = particles[i]
		p.life -= delta
		p.vy += GRAVITY * 0.45 * delta
		p.x += p.vx * delta
		p.y += p.vy * delta
		if p.life <= 0.0:
			particles.remove_at(i)

func _move_body(body: Dictionary, delta: float) -> void:
	body.vy = min(MAX_FALL, body.vy + GRAVITY * delta)
	body.x += body.vx * delta
	if _rect_hits_world(body.x, body.y, body.w, body.h):
		var dir: float = sign(body.vx) if body.vx != 0 else 1.0
		while _rect_hits_world(body.x, body.y, body.w, body.h):
			body.x -= dir
		body.vx = 0
	body.y += body.vy * delta
	body.on_ground = false
	if _rect_hits_world(body.x, body.y, body.w, body.h):
		var dir: float = sign(body.vy) if body.vy != 0 else 1.0
		while _rect_hits_world(body.x, body.y, body.w, body.h):
			body.y -= dir
		if dir > 0:
			body.on_ground = true
		body.vy = 0

func _rect_hits_world(x: float, y: float, w: float, h: float) -> bool:
	for ty in range(int(floor(y / TILE)), int(floor((y + h - 1) / TILE)) + 1):
		for tx in range(int(floor(x / TILE)), int(floor((x + w - 1) / TILE)) + 1):
			if _is_solid(tx, ty):
				return true
	return false

func _rect_intersects_tile(rect: Dictionary, tx: int, ty: int) -> bool:
	return rect.x < (tx + 1) * TILE and rect.x + rect.w > tx * TILE and rect.y < (ty + 1) * TILE and rect.y + rect.h > ty * TILE

func _overlap(a: Dictionary, b: Dictionary) -> bool:
	return a.x < b.x + b.w and a.x + a.w > b.x and a.y < b.y + b.h and a.y + a.h > b.y

func _get_tile(tx: int, ty: int):
	if tx < 0 or ty < 0 or tx >= WORLD_W or ty >= WORLD_H:
		return "stone"
	return world[ty][tx]

func _set_tile(tx: int, ty: int, id) -> void:
	if tx < 0 or ty < 0 or tx >= WORLD_W or ty >= WORLD_H:
		return
	world[ty][tx] = id

func _is_solid(tx: int, ty: int) -> bool:
	var id = _get_tile(tx, ty)
	return id != null and bool(BLOCKS[id].solid)

func _selected_item():
	return inventory_slots[selected]

func _ensure_item_slotted(id: String) -> void:
	if inventory_slots.has(id):
		return
	var empty := inventory_slots.find(null)
	if empty >= 0:
		inventory_slots[empty] = id

func _clear_empty_stack(id: String) -> void:
	if int(inventory.get(id, 0)) > 0 or id in ["pickaxe", "sword", "axe"]:
		return
	for i in range(inventory_slots.size()):
		if inventory_slots[i] == id:
			inventory_slots[i] = null

func _add_drop(id, pos: Vector2, count: int) -> void:
	if id == null:
		return
	drops.append({"id": id, "count": count, "x": pos.x, "y": pos.y, "vx": (rng.randf() - 0.5) * 120, "vy": -180 - rng.randf() * 80, "r": 11.0})

func _add_particles(pos: Vector2, color: Color, count: int) -> void:
	for _i in range(count):
		particles.append({"x": pos.x, "y": pos.y, "vx": (rng.randf() - 0.5) * 260, "vy": -rng.randf() * 260, "r": 3 + rng.randf() * 4, "life": 0.5 + rng.randf() * 0.35, "color": color})

func _draw() -> void:
	var cam := _camera()
	draw_set_transform(-cam)
	_draw_world(cam)
	draw_set_transform(Vector2.ZERO)

func _camera() -> Vector2:
	return Vector2(clampf(player.x + player.w / 2 - 640, 0, WORLD_W * TILE - 1280), clampf(player.y + player.h / 2 - 360, 0, WORLD_H * TILE - 720))

func _draw_world(cam: Vector2) -> void:
	_draw_sky(cam)
	_draw_terrain(cam)
	for d in drops:
		_draw_circle(Vector2(d.x, d.y), d.r, _item_color(d.id), COLORS.outline, 2)
	for p in projectiles:
		_draw_arrow(Vector2(p.x, p.y), atan2(p.vy, p.vx))
	for e in enemies:
		_draw_enemy(e)
	_draw_player()
	for p in particles:
		var c: Color = p.color
		c.a = clampf(p.life * 1.6, 0, 1)
		draw_circle(Vector2(p.x, p.y), p.r, c)
	_draw_cursor()

func _draw_sky(cam: Vector2) -> void:
	var viewport := Rect2(cam, Vector2(1280, 720))
	var night := day_time > 0.72 or day_time < 0.22
	draw_rect(viewport, Color("#1b1550") if night else Color("#5aa7ff"))
	for i in range(7):
		var x := cam.x + fmod(i * 260 - cam.x * 0.06, 1500) - 100
		_draw_circle(Vector2(x, cam.y + 72 + (i % 3) * 44), 34, Color(1, 1, 1, 0.45), Color.TRANSPARENT, 0)
	for i in range(16):
		var x := cam.x + fmod(i * 98 - cam.x * 0.18, 1400) - 80
		var base := cam.y + 620
		draw_polygon(PackedVector2Array([Vector2(x - 24, base), Vector2(x, base - 74 - (i % 4) * 15), Vector2(x + 24, base)]), PackedColorArray([Color("#173f32")]))

func _draw_terrain(cam: Vector2) -> void:
	var start_x := maxi(0, int(floor(cam.x / TILE)) - 1)
	var end_x := mini(WORLD_W - 1, int(ceil((cam.x + 1280) / TILE)) + 1)
	var start_y := maxi(0, int(floor(cam.y / TILE)) - 1)
	var end_y := mini(WORLD_H - 1, int(ceil((cam.y + 720) / TILE)) + 1)
	for y in range(start_y, end_y + 1):
		for x in range(start_x, end_x + 1):
			var id = world[y][x]
			if id != null:
				_draw_block(id, Vector2(x * TILE, y * TILE))

func _draw_block(id: String, pos: Vector2) -> void:
	var rect := Rect2(pos + Vector2(1, 1), Vector2(TILE - 2, TILE - 2))
	var color := _block_color(id)
	if id == "grass":
		draw_rect(rect, COLORS.dirt)
		draw_rect(Rect2(pos, Vector2(TILE, 12)), COLORS.grass)
	elif id == "torch":
		_draw_circle(pos + Vector2(16, 8), 12, Color(1, 0.78, 0.3, 0.45), Color.TRANSPARENT, 0)
		draw_rect(Rect2(pos + Vector2(12, 8), Vector2(8, 22)), Color("#75452c"))
		_draw_circle(pos + Vector2(16, 8), 7, COLORS.torch, COLORS.outline, 2)
	else:
		draw_rect(rect, color)
		draw_rect(Rect2(pos + Vector2(5, 21), Vector2(TILE - 10, 7)), _shade_for(id))
		if id == "ore":
			for i in range(4):
				_draw_circle(pos + Vector2(8 + i * 6, 9 + (i % 2) * 9), 4, COLORS.ore_glow, COLORS.outline, 1)
	draw_rect(rect, COLORS.outline, false, 2)
	if mining != null and mining.tx == int(pos.x / TILE) and mining.ty == int(pos.y / TILE):
		var pct := clampf(mining.progress / float(BLOCKS[id].hardness), 0, 1)
		draw_arc(pos + Vector2(16, 16), 13, -PI / 2, -PI / 2 + TAU * pct, 18, Color(1, 1, 1, 0.75), 3)

func _draw_player() -> void:
	var base := Vector2(player.x + player.w / 2, player.y + player.h / 2)
	var dir: int = int(player.facing)
	var held = _selected_item()
	draw_rect(Rect2(base + Vector2(-12, -15), Vector2(24, 31)), Color("#b96642"))
	draw_rect(Rect2(base + Vector2(-9, -10), Vector2(18, 19)), Color("#2f9a58"))
	_draw_circle(base + Vector2(0, -29), 14, Color("#f2b98f"), COLORS.outline, 3)
	_draw_circle(base + Vector2(-5, -26), 2, Color("#142033"), Color.TRANSPARENT, 0)
	_draw_circle(base + Vector2(6, -26), 2, Color("#142033"), Color.TRANSPARENT, 0)
	_draw_held_item(base + Vector2(dir * 18, -2), dir, held)

func _draw_held_item(pos: Vector2, dir: int, item) -> void:
	if item == null:
		return
	if item == "sword":
		draw_rect(Rect2(pos, Vector2(dir * 52, 6)).abs(), Color("#f2a044"))
	elif item == "pickaxe" or item == "axe":
		draw_line(pos, pos + Vector2(dir * 42, -18), Color("#7d5638"), 6)
		_draw_circle(pos + Vector2(dir * 46, -20), 11, Color("#a8b6bd"), COLORS.outline, 2)
	elif item == "bow":
		draw_arc(pos + Vector2(dir * 22, 0), 22, -1.2, 1.2, 18, Color("#bd7741"), 5)
	elif item == "torch":
		draw_rect(Rect2(pos, Vector2(8, 26)), Color("#75452c"))
		_draw_circle(pos + Vector2(4, -3), 8, COLORS.torch, COLORS.outline, 2)
	elif placeable.has(item):
		draw_rect(Rect2(pos, Vector2(18, 18)), _item_color(item))

func _draw_enemy(e: Dictionary) -> void:
	var pos := Vector2(e.x + 15, e.y + 16)
	_draw_circle(pos, 17, COLORS.slime_purple if e.max_hp > 30 else COLORS.slime, COLORS.outline, 3)
	_draw_circle(pos + Vector2(-6, -4), 3, Color("#24172b"), Color.TRANSPARENT, 0)
	_draw_circle(pos + Vector2(7, -4), 3, Color("#24172b"), Color.TRANSPARENT, 0)
	draw_rect(Rect2(e.x - 6, e.y - 14, 42, 7), Color(0, 0, 0, 0.48))
	draw_rect(Rect2(e.x - 4, e.y - 12, 38 * max(0, float(e.hp) / float(e.max_hp)), 3), Color("#75f061"))

func _draw_arrow(pos: Vector2, angle: float) -> void:
	var tip := pos + Vector2(cos(angle), sin(angle)) * 18
	var tail := pos - Vector2(cos(angle), sin(angle)) * 14
	draw_line(tail, tip, Color("#d9c48a"), 4)
	_draw_circle(tip, 4, Color("#bfc8c7"), COLORS.outline, 1)

func _draw_cursor() -> void:
	var tx := int(floor(mouse_world.x / TILE))
	var ty := int(floor(mouse_world.y / TILE))
	draw_rect(Rect2(tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6), Color("#ffe77e"), false, 3)

func _draw_circle(pos: Vector2, r: float, fill: Color, stroke: Color, width: float) -> void:
	if fill.a > 0:
		draw_circle(pos, r, fill)
	if stroke.a > 0 and width > 0:
		draw_arc(pos, r, 0, TAU, 32, stroke, width)

func _shade_for(id: String) -> Color:
	if id == "dirt" or id == "grass":
		return COLORS.dirt_dark
	if id == "stone" or id == "ore":
		return COLORS.stone_dark
	if id == "wood":
		return Color("#7e4a2d")
	if id == "bench":
		return Color("#8d5634")
	return Color(0, 0, 0, 0.22)

func _block_color(id: String) -> Color:
	if id == "grass":
		return COLORS.grass
	if COLORS.has(id):
		return COLORS[id]
	return Color("#dfe8ef")

func _item_color(id: String) -> Color:
	if id == "gel":
		return COLORS.slime
	if id == "arrow":
		return Color("#d9c48a")
	return _block_color(id)

func _build_ui() -> void:
	ui = CanvasLayer.new()
	add_child(ui)
	hotbar_grid = GridContainer.new()
	hotbar_grid.columns = 10
	hotbar_grid.position = Vector2(14, 30)
	ui.add_child(hotbar_grid)
	var label := Label.new()
	label.text = "物品栏"
	label.position = Vector2(14, 10)
	ui.add_child(label)
	stats_label = Label.new()
	stats_label.position = Vector2(960, 18)
	stats_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	ui.add_child(stats_label)
	inventory_panel = PanelContainer.new()
	inventory_panel.position = Vector2(14, 96)
	inventory_panel.visible = false
	ui.add_child(inventory_panel)
	inventory_grid = GridContainer.new()
	inventory_grid.columns = 10
	inventory_panel.add_child(inventory_grid)
	craft_panel = PanelContainer.new()
	craft_panel.position = Vector2(760, 206)
	craft_panel.visible = false
	ui.add_child(craft_panel)
	craft_list = VBoxContainer.new()
	craft_panel.add_child(craft_list)
	menu_panel = PanelContainer.new()
	menu_panel.position = Vector2(1040, 520)
	var menu_text := Label.new()
	menu_text.text = "菜单\nWASD移动\n空格跳跃\n左键使用道具\n右键放置\nE背包 C合成\n点击两个格子交换"
	menu_panel.add_child(menu_text)
	ui.add_child(menu_panel)
	tooltip_panel = PanelContainer.new()
	tooltip_panel.visible = false
	ui.add_child(tooltip_panel)
	tooltip_label = RichTextLabel.new()
	tooltip_label.custom_minimum_size = Vector2(250, 112)
	tooltip_label.bbcode_enabled = true
	tooltip_panel.add_child(tooltip_label)
	toast_label = Label.new()
	toast_label.position = Vector2(440, 120)
	ui.add_child(toast_label)
	_update_ui()

func _update_ui() -> void:
	stats_label.text = "♥ %d/%d\n★ %d/%d\n时间 %02d:%02d · %s · 敌人 %d" % [player.hp, player.max_hp, player.mana, player.max_mana, int(day_time * 24), int(fmod(day_time * 24, 1) * 60), "雨天" if weather == "rain" else "晴天", enemies.size()]
	_build_hotbar()
	_build_inventory()
	_build_crafting()
	toast_label.text = toast

func _build_hotbar() -> void:
	_clear_children(hotbar_grid)
	for i in range(10):
		hotbar_grid.add_child(_slot_button(i, i == selected))

func _build_inventory() -> void:
	inventory_panel.visible = inventory_open
	if not inventory_open:
		return
	_clear_children(inventory_grid)
	for i in range(40):
		inventory_grid.add_child(_slot_button(i, i == pending_swap_slot))

func _build_crafting() -> void:
	craft_panel.visible = craft_open
	if not craft_open:
		return
	_clear_children(craft_list)
	for recipe in [
		{"id": "bench", "name": "工作台", "output": {"bench": 1}, "needs": {"wood": 10}},
		{"id": "torch", "name": "火把 x3", "output": {"torch": 3}, "needs": {"wood": 1, "gel": 1}},
		{"id": "bow", "name": "木弓", "output": {"bow": 1}, "needs": {"wood": 8}},
		{"id": "arrow", "name": "木箭 x15", "output": {"arrow": 15}, "needs": {"wood": 1, "stone": 1}},
	]:
		var btn := Button.new()
		btn.text = "%s\n%s" % [recipe.name, _needs_text(recipe.needs)]
		btn.disabled = not _can_craft(recipe)
		btn.pressed.connect(func(): _craft_recipe(recipe))
		craft_list.add_child(btn)

func _slot_button(slot: int, marked: bool) -> Button:
	var id = inventory_slots[slot]
	var btn := Button.new()
	btn.custom_minimum_size = Vector2(48, 48)
	btn.text = ("%s\n%s" % [_slot_key(slot), _short_name(id)]) if id != null else _slot_key(slot)
	if marked:
		btn.modulate = Color("#8ddcff")
	if id != null:
		btn.tooltip_text = _item_tip(id)
		btn.mouse_entered.connect(func(): _show_tooltip(id, btn.global_position + Vector2(40, 44)))
		btn.mouse_exited.connect(func(): tooltip_panel.visible = false)
	btn.pressed.connect(func(): _slot_pressed(slot))
	return btn

func _slot_pressed(slot: int) -> void:
	if slot < 10 and not inventory_open:
		selected = slot
		return
	if not inventory_open:
		return
	if pending_swap_slot == null:
		pending_swap_slot = slot
	else:
		_swap_slots(pending_swap_slot, slot)
		pending_swap_slot = null

func _swap_slots(from: int, to: int) -> void:
	if from == to or from < 0 or to < 0 or from >= inventory_slots.size() or to >= inventory_slots.size():
		return
	var tmp = inventory_slots[from]
	inventory_slots[from] = inventory_slots[to]
	inventory_slots[to] = tmp
	show_toast("物品位置已交换")

func _can_craft(recipe: Dictionary) -> bool:
	for id in recipe.needs.keys():
		if int(inventory.get(id, 0)) < int(recipe.needs[id]):
			return false
	return true

func _craft_recipe(recipe: Dictionary) -> void:
	if not _can_craft(recipe):
		show_toast("材料不足")
		return
	for id in recipe.needs.keys():
		inventory[id] -= recipe.needs[id]
	for id in recipe.output.keys():
		inventory[id] = int(inventory.get(id, 0)) + int(recipe.output[id])
		_ensure_item_slotted(id)
	show_toast("合成：%s" % recipe.name)

func _needs_text(needs: Dictionary) -> String:
	var parts: Array[String] = []
	for id in needs.keys():
		parts.append("%sx%d" % [ITEMS[id].name, needs[id]])
	return " ".join(parts)

func _show_tooltip(id: String, pos: Vector2) -> void:
	tooltip_label.text = _item_tip(id)
	tooltip_panel.position = pos
	tooltip_panel.visible = true

func _item_tip(id: String) -> String:
	var item = ITEMS[id]
	var lines := ["[color=#ffd36f]%s[/color]" % item.name, "[color=#8ddcff]%s · %s[/color]" % [item.get("rarity", "普通"), item.get("type", "物品")]]
	if item.has("damage"):
		lines.append("%d 伤害" % item.damage)
	if item.has("power"):
		lines.append("%d%% 工具力" % item.power)
	if item.has("knockback"):
		lines.append("击退：%s" % item.knockback)
	lines.append(item.get("use", ""))
	return "\n".join(lines)

func _slot_key(slot: int) -> String:
	return "0" if slot == 9 else str(slot + 1) if slot < 10 else ""

func _short_name(id) -> String:
	if id == null:
		return ""
	return ITEMS[id].name.left(2)

func _clear_children(node: Node) -> void:
	for child in node.get_children():
		child.queue_free()

func show_toast(text: String) -> void:
	toast = text
	toast_timer = 2.2
