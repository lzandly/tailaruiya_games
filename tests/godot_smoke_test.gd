extends SceneTree

func _initialize() -> void:
	var packed := load("res://scenes/Main.tscn")
	assert(packed != null, "Main scene should load")
	var main: Node = packed.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame

	assert(main.world.size() == main.WORLD_H, "World height should be initialized")
	assert(main.world[0].size() == main.WORLD_W, "World width should be initialized")
	assert(main.inventory_slots.size() == 40, "Inventory should have 40 slots")
	assert(main.inventory_slots[0] != null, "Hotbar slot 1 should be populated")
	assert(main.hotbar_grid.get_child_count() == 10, "Hotbar should render 10 slots")
	assert(main.stats_label.text.length() > 0, "Stats label should render")

	main.inventory_open = true
	main.pending_swap_slot = 0
	main._swap_slots(0, 1)
	assert(main.inventory_slots[0] == "sword", "Slot swap should move sword into slot 0")
	assert(main.inventory_slots[1] == "pickaxe", "Slot swap should move pickaxe into slot 1")

	var before_arrow_count: int = int(main.inventory.get("arrow", 0))
	main.inventory.wood = int(main.inventory.get("wood", 0)) + 1
	main.inventory.stone = int(main.inventory.get("stone", 0)) + 1
	main._craft_recipe({"id": "arrow", "name": "木箭 x15", "output": {"arrow": 15}, "needs": {"wood": 1, "stone": 1}})
	assert(int(main.inventory.get("arrow", 0)) == before_arrow_count + 15, "Crafting arrows should add arrow count")

	main.selected = 8
	var before_projectiles: int = main.projectiles.size()
	var before_arrow_after_craft: int = int(main.inventory.get("arrow", 0))
	main._attack()
	assert(main.projectiles.size() == before_projectiles + 1, "Bow attack should spawn a projectile")
	assert(int(main.inventory.get("arrow", 0)) == before_arrow_after_craft - 1, "Bow attack should consume one arrow")

	main.selected = 7
	main.mouse_world = Vector2(main.player.x + 48, main.player.y + main.player.h + main.TILE)
	var before_bench_count: int = int(main.inventory.get("bench", 0))
	main._place_block()
	assert(int(main.inventory.get("bench", 0)) <= before_bench_count, "Placing a workbench should not increase inventory")

	print("GODOT_SMOKE_TEST_OK")
	quit(0)
