function GameEnvironment(EE) {
	const gl = new PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight),
	      GE = this;

	//Section 1: Initializing processes

	this.start = () => {
		sayHello();
		document.body.appendChild(gl.view);
		PIXI.loader
		    .add(buildPathList('json'))
		    .on("progress", showProgress('json'))
		    .load(EE.emitPlayer);
	};

	function sayHello() {
		var type = "WebGL";
		if (!PIXI.utils.isWebGLSupported()) {
			type = "canvas";
		}
		PIXI.utils.sayHello(type);
	};

	function buildPathList(ext) {
		var res = [];
		atlases_names.forEach( (e) => res.push(path(e, ext)) );
		return res;
	};

	const atlases_names = [
		'buildings',
		'cell_colors',
		'menu',
		'player_colors',
		'resources'
	];

	function path(atlas, ext) { return `client/img/${atlas}.${ext}`; };

	function showProgress(ext){
		return (loader, resource) => {
			console.log(`loading ${ext}. Progress: ${loader.progress}`);
			//TODO: Normal progress bar
		};
	};

	//Section 2: Build process

	const content = new PIXI.Container(),
	      stage = new PIXI.Container(),
	      overlay = new PIXI.Container();

	var state = 0;
	const STATE_PLAY = 2;

	var mapOfChunks;

	this.build = (gameData) => {
		getBounds(gameData.mapParams, gameData.homeCell);

		mapOfChunks = gameData.buildings;
		
		fillSpriteArray(gameData.heightMap);
		content.addChild(stage);

		drawOverlay(gameData.resources, gameData.buiData);
		content.addChild(overlay);

		updRenderingBounds(zeroPoint);

		resizeRenderer();

		++state;

		if (state == STATE_PLAY && lastTime == undefined) {
			lastTime = new Date();
			velocityTick(new Date());
		}
		console.log("GE.build finished");
	};

	//Section 3: Events-related stuff

	this.moveScreenByPoint = (x, y) => {
		if (initialWidth == undefined)
			initialWidth = window.innerWidth;
		var move = new CE.Point(x, y);
		return () => {
			infoText.hide(infoText.lastType);
			trainText.hide();
			menu['0'].hide();
			focusVelocity = focusVelocity.add(move.mul(window.innerWidth / initialWidth));
		}
	};

	this.addMouseListener = () => {
		var data;

		stage.interactive = true;
		stage.on('mousedown', (event) => {
			if (state < STATE_PLAY) return;

			trainText.hide();

			var relativePoint = event.data.getLocalPosition(stage);
			var newFocus = new CE.Point(relativePoint.x, relativePoint.y)
			                   .toOffset()
			                   .toPoint();
			updRenderingBounds(newFocus.sub(focus));
			focus = newFocus;

			var chunk = focus.toOffset().toChunk(),
			    offset = focus.toOffset().sub(chunk.toOffset());
			var tmp = {
				cx: chunk.getX(),
				cy: chunk.getY(),
				dx: offset.getRow(),
				dy: offset.getCol()
			};
			console.log(tmp);

			menu['0'].hide();
			menu['0'].visible = true;
			if (empty(tmp.cx, tmp.cy, tmp.dx, tmp.dy)) {
				data = {build: tmp};
				menu['main_types'].show();
			} else if (!resource(tmp.cx, tmp.cy, tmp.dx, tmp.dy)) {
				data = {coords: tmp};
				menu['upgrade'].show();
			}

			boundsOnMapInPixels.pushFocus();
			updRenderingBounds(zeroPoint);
		}, {passive: true});

		Papa.parse('./client/res/build-menu-links-table.csv', {
			download: true,
			header: true,
			dynamicTyping: true,
			step: function(row) {
				var elem = row.data[0];
				if (!elem.name.length) return;
				menu[elem.name].interactive = true;
				menu[elem.name].on('mousedown', (event) => {
					if (state < STATE_PLAY) return;
					//menu[elem.prev].visible = false;
					menu[elem.next].visible = true;
					if (data.build)
						data.build.value = elem.value;
					gl.render(content);
				});
				menu[elem.name].on('mouseover', (event) => {
					infoText.push(elem.name);
					gl.render(content);
				});
				menu[elem.name].on('mouseout', (event) => {
					infoText.hide(elem.name);
					gl.render(content);
				});
			},
			complete: function(result) {
				++state;
				if (state == STATE_PLAY && lastTime == undefined) {
					lastTime = new Date();
					velocityTick(new Date());
				}
				console.log('parse finished');
			}
		});
		menu['option0'].interactive = true;
		menu['store_1'].hitArea = menu['option0'].hitArea = upperHalf;
		menu['option0'].on('mousedown', (event) => {
			if (state < STATE_PLAY) return;
			data.option = false;
			menu['0'].hide();
			tryEmit(data);
			gl.render(content);
		});
		menu['option1'].interactive = true;
		menu['store_0'].hitArea = menu['option1'].hitArea = bottomHalf;
		menu['option1'].on('mousedown', (event) => {
			if (state < STATE_PLAY) return;
			data.option = true;
			menu['0'].hide();
			tryEmit(data);
			gl.render(content);
		});
		menu['remove'].interactive = true;
		menu['remove'].on('mousedown', (event) => {
			if (state < STATE_PLAY) return;
			menu['0'].hide();
			EE.emitRemoveBuilding(data.coords);
			gl.render(content);
		});
	};

	function empty(cx, cy, dx, dy) { return get(cx, cy, dx, dy) == undefined; };

	function resource(cx, cy, dx, dy) {
		let str = get(cx, cy, dx, dy);
		if (str == undefined) return false;
		return str.split("_")[1] == "-1";
	};

	function get(cx, cy, dx, dy) {
		let a = mapOfChunks;
		if (!(a[cx] && a[cx][cy] && a[cx][cy].arr && a[cx][cy].arr[dx]))
			return undefined;
		return a[cx][cy].arr[dx][dy];
	};

	function tryEmit(data) {
		if (data.build)
			EE.emitBuild(data);
		else
			EE.emitUpgradeBuilding(data);
	};

	this.showTrainText = () => {
		trainText.show();
		gl.render(content);
	};

	this.updateChunk = (chunk) => {
		console.log("chunk updated");
		mapOfChunks[chunk.x][chunk.y] = chunk;
		fillBuildingSpriteContainer(chunk.x, chunk.y);
		updRenderingBounds(zeroPoint);
	};

	//Section 4: Calculations

	var cellSideSizeInPixels;
	var mapSizeInCells, mapWidthInChunks, mapHeightInChunks;
	var chunkWidthInCells, chunkHeightInCells;
	var lastBounds;

	var CE, CE_overlay;
	var homeCell;
	var boundsOnMapInPixels, d;
	var focus, focusVelocity;

	var zeroPoint;

	var upperHalf, bottomHalf;

	function getBounds(mapParams, homeCell) {
		let spr = cellSprite(1),
		    w = spr.width, h = spr.height;

		cellSideSizeInPixels = h / 2;

		upperHalf = new PIXI.Polygon(
			0, h / 4,
			w / 2, 0,
			w, h / 4,
			0, 3 * h / 4
		);
		bottomHalf = new PIXI.Polygon(
			0, 3 * h / 4,
			w, h / 4,
			w, 3 * h / 4,
			w / 2, h
		);

		mapSizeInCells = (1 << mapParams.logSize) + 1;
		chunkWidthInCells = mapParams.chunkWidth;
		chunkHeightInCells = mapParams.chunkHeight;

		mapWidthInChunks = Math.ceil(mapSizeInCells / chunkWidthInCells);
		mapHeightInChunks = Math.ceil(mapSizeInCells / chunkHeightInCells);

		lastBounds = {x1: 0, y1: 0, x2: mapWidthInChunks - 1, y2: mapHeightInChunks - 1};

		CE = new CoordsEnvironment(cellSideSizeInPixels, chunkWidthInCells, chunkHeightInCells);
		CE_overlay = new CoordsEnvironment(1.5 * cellSideSizeInPixels, chunkWidthInCells, chunkHeightInCells);
		zeroPoint = new CE.Point(0, 0);

		homeCell = new CE.Offset(homeCell.row, homeCell.col);
		focus = homeCell.toPoint();

		focusVelocity = zeroPoint;

		d = new CE.Point(window.innerWidth / 2, window.innerHeight / 2);

		stage.x = -focus.getX() + d.getX();
		stage.y = -focus.getY() + d.getY();

		boundsOnMapInPixels = {
			topLeft: focus.sub(d),
			botRigt: focus.add(d),
			pushFocus: function() {
				this.topLeft = focus.sub(d);
				this.botRigt = focus.add(d);
			}
		};
	};

	//Section 5.1: Graphics, field

	function sprite(atlas, name) {
		return new PIXI.Sprite(
			PIXI.loader
			.resources[path(atlas, 'json')]
			.textures[`${name}.png`]
		); 
	};

	function menuSprite(number) { return sprite('menu', `menu_${number}`); };
	function buildSprite(number) { return sprite('buildings', `building_${number}`); };
	function cellSprite(number) { return sprite('cell_colors', `cell_color_${number}`); };
	function playerSprite(number) { return sprite('player_colors', `player_color_${number}`); };
	function resourceSprite(cell, number) { return sprite('resources', `res_${cell ? 'color' : 'overlay'}_${number}`); };

	var chunkContainers = [];
	function fillSpriteArray(heightMap) {
		for (let i = 0; i < mapWidthInChunks; ++i) {
			chunkContainers[i] = [];
			for (let j = 0; j < mapHeightInChunks; ++j) {
				fillSpriteContainer(i, j, heightMap[i][j]);
			}
		}
		console.log("sprite array filled");
	};

	function fillSpriteContainer(i, j, heightChunk) {
		let cont = chunkContainers[i][j] = new PIXI.Container();
		
		var pixelCoord = new CE.Chunk(i, j).upperLeftPixel();
		cont.x = pixelCoord.getX();
		cont.y = pixelCoord.getY();

		cont.terr = new PIXI.Container();
		
		for (let x = 0; x < chunkWidthInCells; ++x) {
			if (!heightChunk.res[x]) break;
			for (let y = 0; y < chunkHeightInCells; ++y) {
				var cellSprite = getHeightCell(heightChunk.res[x][y]);
				if (cellSprite) {
					let pc = new CE.Offset(x, y).toPoint();
					cellSprite.x = pc.getX();
					cellSprite.y = pc.getY();
					cont.terr.addChild(cellSprite);
				}
			}
		}

		cont.addChild(cont.terr);
		fillBuildingSpriteContainer(i, j);

		stage.addChild(cont);
	};

	function fillBuildingSpriteContainer(i, j) {
		let cont = chunkContainers[i][j], bui;
		if (cont.bui)
			cont.removeChild(cont.bui);
		cont.addChild(bui = cont.bui = new PIXI.Container());

		for (let x = 0; x < chunkWidthInCells; ++x) {
			for (let y = 0; y < chunkHeightInCells; ++y) {
				var cellSprite = getBuildingCell(get(i, j, x, y)),
				    pc = new CE.Offset(x, y).toPoint();
				cellSprite.forEach((elem) => {
					elem.x = pc.getX();
					elem.y = pc.getY();
					bui.addChild(elem);
				});
			}
		}
	};

	function getHeightIndex(val) {
		with(Math) {
			var ret = min(10, max(5 - floor(val * 4), 1));
			return ret;
		}
	};
	function getHeightCell(height) {
		if (height !== undefined) return cellSprite(getHeightIndex(height));
	};

	function getBuildingCell(building) {
		if (building == undefined)
			return [];
		var split = building.split("_");
		if (split[1] == '-1' && Number(split[0]) < 0)
			return [resourceSprite(true, -Number(split[0]))];
		else
			return [playerSprite(split[1]), buildSprite(split[0])];
	};

	//Section 5.2: Graphics, overlay

	const menu = [],
	      trainText = new PIXI.Container(),
	      infoText = new PIXI.Container(),
	      resourceRect = new PIXI.Container();

	var R_text, G_text, B_text, M_text;
	this.updateResources = (data) => {
		R_text.text = `${shortText(data.r)}`;
		G_text.text = `${shortText(data.g)}`;
		B_text.text = `${shortText(data.b)}`;
		M_text.text = `${shortText(data.m)}`;
		gl.render(content);
	};

	function shortText(x) {
		let flr = Math.floor;
		if (x < 1e4)
			return `${x}`;
		if (x < 1e7)
			return `${flr(x / 1e3)}k`;
		if (x < 1e10)
			return `${flr(x / 1e6)}m`;
		if (x < 1e13)
			return `${flr(x / 1e9)}b`;
		return "MANY";
	};

	function getInformationText(name) {
		if (name == 'mine')
			return 'I-type digs resources';
		if (name == 'prod')
			return 'II-type takes ore from I';
		if (name == 'store')
			return 'Cargo sends to you product of II';
		if (name == 'upgrade_0')
			return 'Upgrade building';
	};

	function drawOverlay(resources, buildInfo) {
		overlay.addChild(menu['0'] = new PIXI.Container());

		let zeroOffset = new CE.Offset(0, 0), upLeft = zeroOffset.upperLeftPixel();

		let neighbours = [];
		for (let i = 0; i < 6; ++i)
			neighbours[i] = zeroOffset.getNeighbor(i).toPoint();

		menu['0'].addChild(
			menu['main_types'] = new PIXI.Container(),
			menu['mine_types'] = new PIXI.Container(),
			menu['prod_types'] = new PIXI.Container(),
			menu['store_types'] = new PIXI.Container(),
			menu['upgrade'] = new PIXI.Container(),
			menu['option'] = new PIXI.Container()
		);
		menu['0'].hide = () => {
			menu['main_types'].hide();
			menu['upgrade'].hide();
			menu['0'].visible = false;
		};

		menu['main_types'].position =
		menu['mine_types'].position =
		menu['prod_types'].position =
		menu['store_types'].position =
		menu['upgrade'].position =
		menu['option'].position = new PIXI.Point(upLeft.getX(), upLeft.getY());

		menu['option'].addChild(
			menu['option0'] = menuSprite('0_0'),
			menu['option1'] = menuSprite('0_1')
		);

		menu['upgrade'].addChild(
			menu['upgrade_0'] = menuSprite(5),
			menu['remove'] = menuSprite(6)
		);
		menu['upgrade'].hide = () => {
			menu['upgrade'].visible = false;
			menu['option'].visible = false;
		};
		menu['upgrade'].show = () => {
			menu['upgrade'].visible = true;
			menu['upgrade_0'].visible = true;
			menu['remove'].visible = true;
		};

		menu['main_types'].addChild(
			menu['mine'] = menuSprite('1_0'),
			menu['prod'] = menuSprite('2_0'),
			menu['sell'] = menuSprite(3),
			menu['store'] = menuSprite('4_0')
		);
		menu['main_types'].hide = () => {
			menu['main_types'].visible = false;
			menu['mine_types'].visible = false;
			menu['prod_types'].visible = false;
			menu['store_types'].visible = false;
			menu['option'].visible = false;
		};
		menu['main_types'].show = () => {
			menu['main_types'].visible = true;
			menu['mine'].visible = true;
			menu['prod'].visible = true;
			menu['sell'].visible = true;
			menu['store'].visible = true;
		};

		let shift_zeroOffset = new CE_overlay.Offset(0, 0), shift_neighbours = [];
		for (let i = 0; i < 6; ++i)
			shift_neighbours[i] = shift_zeroOffset.getNeighbor(i).toPoint();

		menu['upgrade_0'].position = new PIXI.Point(shift_neighbours[1].getX(), shift_neighbours[1].getY());
		menu['remove'].position = new PIXI.Point(shift_neighbours[5].getX(), shift_neighbours[5].getY());

		menu['mine_types'].x = menu['mine_types'].x + (menu['mine'].x = shift_neighbours[3].getX());
		menu['mine_types'].y = menu['mine_types'].y + (menu['mine'].y = shift_neighbours[3].getY());

		menu['prod_types'].x = menu['prod_types'].x + (menu['prod'].x = shift_neighbours[2].getX());
		menu['prod_types'].y = menu['prod_types'].y + (menu['prod'].y = shift_neighbours[2].getY());

		menu['sell'].x = shift_neighbours[1].getX();
		menu['sell'].y = shift_neighbours[1].getY();

		menu['store_types'].x = menu['store_types'].x + (menu['store'].x = shift_neighbours[0].getX());
		menu['store_types'].y = menu['store_types'].y + (menu['store'].y = shift_neighbours[0].getY());

		menu['mine_types'].addChild(
			menu['mine_r'] = menuSprite('1_1'),
			menu['mine_g'] = menuSprite('1_2'),
			menu['mine_b'] = menuSprite('1_3'),
			menu['mine_u'] = menuSprite('1_4')
		);

		menu['mine_r'].x = neighbours[5].getX();
		menu['mine_r'].y = neighbours[5].getY();

		menu['mine_g'].x = neighbours[3].getX();
		menu['mine_g'].y = neighbours[3].getY();

		menu['mine_b'].x = neighbours[1].getX();
		menu['mine_b'].y = neighbours[1].getY();

		menu['prod_types'].addChild(
			menu['prod_r'] = menuSprite('2_1'),
			menu['prod_g'] = menuSprite('2_2'),
			menu['prod_b'] = menuSprite('2_3'),
			menu['prod_u'] = menuSprite('2_4')
		);

		menu['prod_r'].x = neighbours[4].getX();
		menu['prod_r'].y = neighbours[4].getY();

		menu['prod_g'].x = neighbours[2].getX();
		menu['prod_g'].y = neighbours[2].getY();

		menu['prod_b'].x = neighbours[0].getX();
		menu['prod_b'].y = neighbours[0].getY();

		menu['store_types'].addChild(
			menu['store_0'] = menuSprite('4_2'),
			menu['store_1'] = menuSprite('4_1')
		);

		menu['0'].hide();

		//overlay.addChild(resText);
		let R_pict = resourceSprite(false, 1),
		    G_pict = resourceSprite(false, 2),
		    B_pict = resourceSprite(false, 3),
		    M_pict = resourceSprite(false, 4);

		let h = R_pict.height, pad = 0;

		var Font = { font : `${h}px Arial`, fill : 0x00FF00 };

		R_text = new PIXI.Text('', Font);
		G_text = new PIXI.Text('', Font);
		B_text = new PIXI.Text('', Font);
		M_text = new PIXI.Text('', Font);

		R_text.resolution =
		G_text.resolution =
		B_text.resolution =
		M_text.resolution = 2;

		R_text.updateText();
		G_text.updateText();
		B_text.updateText();
		M_text.updateText();

		GE.updateResources(resources);

		let w = new PIXI.Text("9999m", Font).width;
		let width = (w + h + pad * 2) * 4 + pad, height = h + 2 * pad;
		let margin = 0;

		R_pict.x = pad + margin;
		R_text.x = R_pict.x + h + pad;

		G_pict.x = R_text.x + w + pad;
		G_text.x = G_pict.x + h + pad;

		B_pict.x = G_text.x + w + pad;
		B_text.x = B_pict.x + h + pad;

		M_pict.x = B_text.x + w + pad;
		M_text.x = M_pict.x + h + pad;

		let delta = (h - R_text.height) / 2;

		R_text.y = G_text.y = B_text.y = M_text.y = (R_pict.y = G_pict.y = B_pict.y = M_pict.y = pad + margin) + delta;

		let graphics = new PIXI.Graphics();

		graphics.beginFill(0x000000, 0.5);
		graphics.lineStyle(margin * 2, 0x00FF00, 1);

		graphics.moveTo(0 + margin, 0 + margin);
		graphics.lineTo(width + margin, 0 + margin);
		graphics.lineTo(width + margin, height + margin);
		graphics.lineTo(0 + margin, height + margin);
		graphics.lineTo(0 + margin, 0 + margin);
		graphics.endFill();

		resourceRect.x = 0;
		resourceRect.y = 0;
		resourceRect.addChild(
			graphics,
			R_pict, G_pict, B_pict, M_pict,
			R_text, G_text, B_text, M_text);
		resourceRect.mywidth = width;

		overlay.addChild(resourceRect);

		var newFont = { font : `${h / 2}px Arial`, fill : 0x00FF00 };

		var infoTextsList = [];
		infoText.show = (mode) => {
			infoText.concrete_bg.visible = infoText.concrete.visible = mode;
			infoText.abstract_bg.visible = infoText.abstract.visible = !mode;
			infoText.visible = true;
		}
		infoText.lastType = '';
		infoText.push = (name) => {
			infoText.lastType = name;
			var check = buildInfo.some((elem) => {
				if (elem.func != name)
					return false;
				
				infoTextsList['in'].text = `inputs ${elem.in} packs per process, ${elem.in_u} after each upgrade`;
				infoTextsList['time'].text = `takes ${elem.time} ticks to process, ${elem.time_u} after each upgrade`;
				infoTextsList['out'].text = `outputs ${elem.out} ${name == 'sell' ? '$' : 'packs'} per process, ${elem.out_u} after each upgrade`;

				let r = elem.cost_r == -1 ? '?' : elem.cost_r,
				    g = elem.cost_g == -1 ? '?' : elem.cost_g,
				    b = elem.cost_b == -1 ? '?' : elem.cost_b,
				    m = elem.cost_gold == -1 ? '?' : elem.cost_gold;
				
				infoTextsList['cost'].text = `${r}r + ${g}g + ${b}b or ${m}$, ${elem.cost_u} for each upgrade`;
				infoText.show(1);

				return true;
			});
			if (!check) {
				infoTextsList['info'].text = getInformationText(name);
				infoText.show(0);
			}
		}
		infoText.hide = (name) => {
			if (infoText.lastType != name) return;
			infoText.visible = false;
			infoText.concrete_bg.visible = false;
			infoText.concrete.visible = false;
			infoText.abstract_bg.visible = false;
			infoText.abstract.visible = false;
		}

		infoText.concrete = new PIXI.Container();
		infoText.concrete.addChild(
			infoTextsList['in'] = new PIXI.Text('', newFont),
			infoTextsList['time'] = new PIXI.Text('', newFont),
			infoTextsList['out'] = new PIXI.Text('', newFont),
			infoTextsList['cost'] = new PIXI.Text('', newFont)
		);

		infoText.abstract = new PIXI.Container();
		infoText.abstract.addChild(
			infoTextsList['info'] = new PIXI.Text('', newFont)
		);

		infoTextsList['in'].x = infoTextsList['info'].x =
		infoTextsList['time'].x =
		infoTextsList['out'].x =
		infoTextsList['cost'].x =
		pad = h / 5;

		infoTextsList['in'].y = infoTextsList['info'].y = pad;
		infoTextsList['time'].y = infoTextsList['in'].y + h / 2 + pad;
		infoTextsList['out'].y = infoTextsList['time'].y + h / 2 + pad;
		infoTextsList['cost'].y = infoTextsList['out'].y + h / 2 + pad;

		infoText.mywidth = width = new PIXI.Text(
			`9999r + 9999g + 9999b or 9999$, multiply 2 for each upgrade`,
			newFont).width + 2 * pad;
		height = (h / 2 + pad) * 4 + pad, height_1 = h / 2 + 2 * pad;

		infoText.concrete_bg = new PIXI.Graphics();

		infoText.concrete_bg.beginFill(0x000000, 0.5);
		infoText.concrete_bg.lineStyle(margin * 2, 0x00FF00, 1);

		infoText.concrete_bg.moveTo(0 + margin, 0 + margin);
		infoText.concrete_bg.lineTo(width + margin, 0 + margin);
		infoText.concrete_bg.lineTo(width + margin, height + margin);
		infoText.concrete_bg.lineTo(0 + margin, height + margin);
		infoText.concrete_bg.lineTo(0 + margin, 0 + margin);
		infoText.concrete_bg.endFill();

		infoText.abstract_bg = new PIXI.Graphics();

		infoText.abstract_bg.beginFill(0x000000, 0.5);
		infoText.abstract_bg.lineStyle(margin * 2, 0x00FF00, 1);

		infoText.abstract_bg.moveTo(0 + margin, 0 + margin);
		infoText.abstract_bg.lineTo(width + margin, 0 + margin);
		infoText.abstract_bg.lineTo(width + margin, height_1 + margin);
		infoText.abstract_bg.lineTo(0 + margin, height_1 + margin);
		infoText.abstract_bg.lineTo(0 + margin, 0 + margin);
		infoText.abstract_bg.endFill();

		infoText.addChild(
			infoText.concrete_bg, infoText.concrete,
			infoText.abstract_bg, infoText.abstract
		);
		infoText.visible = false;

		overlay.addChild(infoText);

		var txt = new PIXI.Text('WASD to move\nLMB to select cell\nT to show this message', newFont);
		graphics = new PIXI.Graphics();

		graphics.beginFill(0x000000, 0.5);
		graphics.lineStyle(margin * 2, 0x00FF00, 1);

		graphics.moveTo(0 + margin - pad, 0 + margin - pad);
		graphics.lineTo(txt.width + margin + pad, 0 + margin - pad);
		graphics.lineTo(txt.width + margin + pad, txt.height + margin + pad);
		graphics.lineTo(0 + margin - pad, txt.height + margin + pad);
		graphics.lineTo(0 + margin - pad, 0 + margin - pad);
		graphics.endFill();

		trainText.addChild(graphics, txt);
		trainText.mywidth = txt.width;
		trainText.myheigh = txt.height;

		trainText.show = () => trainText.visible = true;
		trainText.hide = () => trainText.visible = false;

		overlay.addChild(trainText);

		updateOverlayCoords(1);
	};

	//Section 6: Render

	function updateOverlayCoords(scale) {
		menu['0'].x = d.getX()
		menu['0'].y = d.getY();
		menu['0'].scale.x = menu['0'].scale.y = scale;
		
		resourceRect.x = d.getX() - resourceRect.mywidth * scale / 2;
		resourceRect.scale.x = resourceRect.scale.y = scale;

		infoText.x = d.getX() - infoText.mywidth * scale / 2;
		infoText.y = d.getY() + CE_overlay.getHexHeight() * scale;
		infoText.scale.x = infoText.scale.y = scale;

		trainText.x = d.getX() - trainText.mywidth * scale / 2;
		trainText.y = d.getY() - trainText.myheigh * scale / 2;
		trainText.scale.x = trainText.scale.y = scale;
	};

	var initialWidth = undefined;
	function resize() {
		focusVelocity = focusVelocity.mul(window.innerWidth / 2 / d.getX());
		d = new CE.Point(window.innerWidth / 2, window.innerHeight / 2);
		if (initialWidth == undefined)
			initialWidth = window.innerWidth;
		updateOverlayCoords(window.innerWidth / initialWidth);
		stage.x = -focus.getX() + d.getX();
		stage.y = -focus.getY() + d.getY();
		resizeRenderer();
	};

	function resizeRenderer() { 
		gl.autoResize = true;
		gl.resize(window.innerWidth, window.innerHeight);
		gl.render(content);
	};

	var lastTime;
	function velocityTick(time) {
		var dt = time - lastTime;
		lastTime = time;
		if (state == STATE_PLAY && !focusVelocity.equals(zeroPoint)) {
			focus = focus.add(focusVelocity.mul(dt));
			boundsOnMapInPixels.pushFocus();
			updRenderingBounds(focusVelocity.mul(dt));
		}
		if (window.innerWidth / 2 != d.getX()) {
			resize();
			if (focusVelocity.equals(zeroPoint)) {
				boundsOnMapInPixels.pushFocus();
				updRenderingBounds(zeroPoint);
			}
		}
		requestAnimationFrame(velocityTick);
	};

	function updRenderingBounds(delta) {

		function getRenderingBounds() {
			let tl = boundsOnMapInPixels.topLeft.toChunk(),
			    br = boundsOnMapInPixels.botRigt.toChunk();
			return {x1: tl.getX(), x2: br.getX(), y1: tl.getY(), y2: br.getY()};
		};
		let bounds = getRenderingBounds();

		let x1 = lastBounds.x1 - 1,
		    x2 = lastBounds.x2 + 1,
		    y1 = lastBounds.y1 - 1,
		    y2 = lastBounds.y2 + 1,

		    tx1 = bounds.x1 - 1,
		    tx2 = bounds.x2 + 1,
		    ty1 = bounds.y1 - 1,
		    ty2 = bounds.y2 + 1;

		function setChunksVisible(x1, x2, y1, y2, value) {
			if (x1 > x2 || y1 > y2) return;
			for (let x = x1; x <= x2; ++x) {
				if (!chunkContainers[x]) continue;
				for (let y = y1; y <= y2; ++y) {
					if (!chunkContainers[x][y]) continue;
					chunkContainers[x][y].visible = value;
				}
			}
		};

		setChunksVisible(x1, x2, y1, y2, false);
		setChunksVisible(tx1, tx2, ty1, ty2, true);

		stage.x -= delta.getX();
		stage.y -= delta.getY();
		lastBounds = bounds;

		gl.render(content);
	};
}
