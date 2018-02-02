function GameEnvironment(PIXI, Papa, EE) {
	const gl = new PIXI.autoDetectRenderer(256, 256),
		  imagePathList = buildImgPathList(),
		  GE = this;
	
	this.start = () => {
		sayHello();
		resizeRenderer();
		document.body.appendChild(gl.view);
		PIXI.loader
			.add(imagePathList)
			.on("progress", showProgress)
			.load(EE.emitPlayer);
	};

	const content = new PIXI.Container(), 
		  stage = new PIXI.Container(), 
		  overlay = new PIXI.Container();

	var zeroPoint;
	var state = 0;

	var buildInfo;

	this.build = (gameData) => {
		buildInfo = gameData.buiData;

		getBounds(gameData.mapParams, gameData.homeCell);
		fillMap(gameData.mapParams, gameData.buildings);

		fillSpriteArray();
		content.addChild(stage);

		drawOverlay(gameData.resources);
		content.addChild(overlay);

		gl.render(content);

		updRenderingBounds(zeroPoint);
		++state;
	};

	var mapOfChunks = [[]];
	this.updateChunk = (chunk) => {
		console.log("chunk updated");
		mapOfChunks[chunk.x][chunk.y] = chunk;
		fillSpriteContainer(chunk.x, chunk.y);
		updRenderingBounds(zeroPoint);
	};

	var resText = new PIXI.Text('', {fontFamily : 'Arial', fontSize: 24, fill : 'black', align : 'center'});
	this.updateResources = (data) => {
		resText.text = `R: ${data.r} G: ${data.g} B: ${data.b} M: ${data.m} Cap: ${data.cap}`;
	};

	setInterval(velocityTick, 2);

	function texture(path) {
		return PIXI.loader.resources[path].texture;
	};
	function img(name) {
		return `./client/img/${name}.png`;
	};
	function buildImgPathList() {
		var res = [];
		for (let i = 0; i < 4; ++i)
			res.push(img(`cell_color${i}`));
		for (let i = 1; i < 12; ++i)
			for (let j = 0; j < 7; ++j)
				res.push(img(`building${i}_${j}`));
		for (let i = 0; i < 2; ++i)
			res.push(img(`menu_0_${i}`));
		for (let i = 0; i < 3; ++i)
			res.push(img(`menu_4_${i}`));
		res.push(img(`menu_3_0`));
		for (let i = 1; i < 3; ++i)
			for (let j = 0; j < 5; ++j)
				res.push(img(`menu_${i}_${j}`));
		res.push(img(`menu_5`));
		res.push(img(`menu_6`));
		return res;
	}

	function resizeRenderer() {
		gl.autoResize = true;
		gl.resize(window.innerWidth, window.innerHeight);
	};

	function sayHello() {
		var type = "WebGL";
		if (!PIXI.utils.isWebGLSupported()) {
			type = "canvas";
		}
		PIXI.utils.sayHello(type);
	};

	var progressText;
	function showProgress(loader, resource) {
		console.log("loading...");
		//TODO: Normal progress bar
		if (!progressText) {
			progressText = new PIXI.Text('', {fontFamily : 'Arial', fontSize: 24, fill : 'white', align : 'center'});
			let tmp = new PIXI.Container();
			tmp.addChild(progressText);
			gl.render(tmp);
		}
		progressText.text = `Progress: ${loader.progress}%`;
	};

	var cellSideSizeInPixels;
	var mapSizeInCells, mapWidthInChunks, mapHeightInChunks;
	var chunkWidthInCells, chunkHeightInCells;
	var lastBounds;

	var CE;
	var homeCell;
	var boundsOnMapInPixels, d;
	var focus, focusVelocity;

	var upperHalf, bottomHalf;

	function getBounds(mapParams, homeCell) {
		let spr = new PIXI.Sprite(texture(img("cell_color0"))),
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

	function fillMap(mapParams, buildings) {
		mapOfChunks = MapGen.buildChunked(mapParams);
		console.log(buildings);
		if (buildings.length) {
			for (let i = 0; i < mapWidthInChunks; ++i) {
				if (!buildings[i]) continue;
				for (let j = 0; j < mapHeightInChunks; ++j) {
					if (!buildings[i][j]) continue;
					mapOfChunks[i][j].bui = buildings[i][j];
				}
			}
		}
	};

	this.resize = (window) => (event) => {
		d = new CE.Point(window.innerWidth / 2, window.innerHeight / 2);
		updateOverlayCoords();
		focus = boundsOnMapInPixels.topLeft.add(d);
		stage.x = -focus.getX() + d.getX();
		stage.y = -focus.getY() + d.getY();
	};

	this.moveScreenByPoint = (x, y) => {
		var move = new CE.Point(x, y);
		return () => {
			focusVelocity = focusVelocity.add(move);
		}
	};

	const menu = [];

	this.addMouseListener = () => {
		var data;

		stage.interactive = true;
		stage.on('mousedown', (event) => {
			if (state < 2) return;
			
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

			menu['main_types'].hide();
			menu['upgrade'].hide();
			
			if (!mapOfChunks[tmp.cx][tmp.cy].res[tmp.dx][tmp.dy]) {
				if (empty(tmp.cx, tmp.cy, tmp.dx, tmp.dy)) {
					data = {build: tmp};
					menu['main_types'].visible = true;
				} else {
					data = {coords: tmp};
					menu['upgrade'].visible = true;
				}
			}
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
					if (state < 2) return;
					menu[elem.prev].visible = false;
					menu[elem.next].visible = true;
					if (data.build)
						data.build.value = elem.value;
				});
			},
			complete: function(result) {
				++state;
				console.log('parse finished');
			}
		});
		menu['option0'].interactive = true;
		menu['store_1'].hitArea = menu['option0'].hitArea = upperHalf;
		menu['option0'].on('mousedown', (event) => {
			if (state < 2) return;
			data.option = false;
			menu['option'].visible = false;
			tryEmit(data);
		});
		menu['option1'].interactive = true;
		menu['store_0'].hitArea = menu['option1'].hitArea = bottomHalf;
		menu['option1'].on('mousedown', (event) => {
			if (state < 2) return;
			data.option = true;
			menu['option'].visible = false;
			tryEmit(data);
		});
		menu['remove'].interactive = true;
		menu['remove'].on('mousedown', (event) => {
			if (state < 2) return;
			menu['upgrade'].visible = false;
			EE.emitRemoveBuilding(data.coords);
		});
	};

	function empty(cx, cy, dx, dy) {
		return mapOfChunks[cx][cy].bui == undefined ||
			   mapOfChunks[cx][cy].bui[dx] == undefined ||
			   mapOfChunks[cx][cy].bui[dx][dy] == undefined; 
	};

	function tryEmit(data) {
		if (data.build)
			EE.emitBuild(data);
		else
			EE.emitUpgradeBuilding(data);
	};

	var chunkContainers = [[]];
	function fillSpriteArray() {
		for (let i = 0; i < mapWidthInChunks; ++i) {
			chunkContainers[i] = [];
			for (let j = 0; j < mapHeightInChunks; ++j) {
				fillSpriteContainer(i, j);
			}
		}
		console.log("sprite array filled");
	};

	function fillSpriteContainer(i, j) {
		if (chunkContainers[i][j] != undefined)
			stage.removeChild(chunkContainers[i][j]);
		chunkContainers[i][j] = new PIXI.Container();
		
		var pixelCoord = new CE.Chunk(i, j).upperLeftPixel();
		chunkContainers[i][j].x = pixelCoord.getX();
		chunkContainers[i][j].y = pixelCoord.getY();

		for (let x = 0; x < chunkWidthInCells; ++x) {
			if (!mapOfChunks[i][j].res[x]) break;
			for (let y = 0; y < chunkHeightInCells; ++y) {
				var cellSprite = getSpriteOfCell(i, j, x, y),
					pc = new CE.Offset(x, y).toPoint();
				cellSprite.x = pc.getX();
				cellSprite.y = pc.getY();
				chunkContainers[i][j].addChild(cellSprite);
			}
		}
		stage.addChild(chunkContainers[i][j]);
	};

	function getPathOfCellImage(i, j, x, y) {
		if (!mapOfChunks[i][j].res[x][y]) mapOfChunks[i][j].res[x][y] = 0;
		if (mapOfChunks[i][j].res[x][y])
			return img(`cell_color${mapOfChunks[i][j].res[x][y]}`);
		if (mapOfChunks[i][j].bui && mapOfChunks[i][j].bui[x] && mapOfChunks[i][j].bui[x][y])
			return img(`building${mapOfChunks[i][j].bui[x][y]}`);
		return img('cell_color0');
	};

	function getSpriteOfCell(i, j, x, y) {
		return new PIXI.Sprite(texture(getPathOfCellImage(i, j, x, y)));
	};

	function sprite(name) {
		return new PIXI.Sprite(texture(img(name)));
	}

	function drawOverlay(resources) {
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

		menu['main_types'].position = 
		menu['mine_types'].position = 
		menu['prod_types'].position = 
		menu['store_types'].position = 
		menu['upgrade'].position = 
		menu['option'].position = new PIXI.Point(upLeft.getX(), upLeft.getY());

		menu['option'].addChild(
			menu['option0'] = sprite('menu_0_0'),
			menu['option1'] = sprite('menu_0_1')
		);

		menu['upgrade'].addChild(
			menu['upgrade_0'] = sprite('menu_5'),
			menu['remove'] = sprite('menu_6')
		);
		menu['upgrade'].hide = () => {
			menu['upgrade'].visible = false;
			menu['option'].visible = false;
		};

		menu['upgrade_0'].position = new PIXI.Point(neighbours[1].getX(), neighbours[1].getY());
		menu['remove'].position = new PIXI.Point(neighbours[5].getX(), neighbours[5].getY());
		
		menu['main_types'].addChild(
			menu['mine'] = sprite('menu_1_0'),
			menu['prod'] = sprite('menu_2_0'),
			menu['sell'] = sprite('menu_3_0'),
			menu['store'] = sprite('menu_4_0')
		);
		menu['main_types'].hide = () => {
			menu['main_types'].visible = false;
			menu['mine_types'].visible = false;
			menu['prod_types'].visible = false;
			menu['store_types'].visible = false;
			menu['option'].visible = false;
		};

		menu['mine_types'].x = menu['mine_types'].x + (menu['mine'].x = neighbours[3].getX());
		menu['mine_types'].y = menu['mine_types'].y + (menu['mine'].y = neighbours[3].getY());

		menu['prod_types'].x = menu['prod_types'].x + (menu['prod'].x = neighbours[2].getX());
		menu['prod_types'].y = menu['prod_types'].y + (menu['prod'].y = neighbours[2].getY());
		
		menu['sell'].x = neighbours[1].getX();
		menu['sell'].y = neighbours[1].getY();

		menu['store_types'].x = menu['store_types'].x + (menu['store'].x = neighbours[0].getX());
		menu['store_types'].y = menu['store_types'].y + (menu['store'].y = neighbours[0].getY());
		
		menu['mine_types'].addChild(
			menu['mine_r'] = sprite('menu_1_1'),
			menu['mine_g'] = sprite('menu_1_2'),
			menu['mine_b'] = sprite('menu_1_3'),
			menu['mine_u'] = sprite('menu_1_4')
		);

		menu['mine_r'].x = neighbours[5].getX();
		menu['mine_r'].y = neighbours[5].getY();
		
		menu['mine_g'].x = neighbours[3].getX();
		menu['mine_g'].y = neighbours[3].getY();
		
		menu['mine_b'].x = neighbours[1].getX();
		menu['mine_b'].y = neighbours[1].getY();
		
		menu['prod_types'].addChild(
			menu['prod_r'] = sprite('menu_2_1'),
			menu['prod_g'] = sprite('menu_2_2'),
			menu['prod_b'] = sprite('menu_2_3'),
			menu['prod_u'] = sprite('menu_2_4')
		);

		menu['prod_r'].x = neighbours[4].getX();
		menu['prod_r'].y = neighbours[4].getY();
		
		menu['prod_g'].x = neighbours[2].getX();
		menu['prod_g'].y = neighbours[2].getY();
		
		menu['prod_b'].x = neighbours[0].getX();
		menu['prod_b'].y = neighbours[0].getY();
		
		menu['store_types'].addChild(
			menu['store_0'] = sprite('menu_4_2'),
			menu['store_1'] = sprite('menu_4_1')
		);

		menu['main_types'].hide();
		menu['upgrade'].hide();

		updateOverlayCoords();

		GE.updateResources(resources);
		overlay.addChild(resText);
	};
	function updateOverlayCoords() {
		menu['0'].x = d.getX();
		menu['0'].y = d.getY();
	};

	function velocityTick() {
		if (state == 2) {
			focus = focus.add(focusVelocity);
			boundsOnMapInPixels.pushFocus();
			updRenderingBounds(focusVelocity);
		}
		resizeRenderer();
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