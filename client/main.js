/*
TODO:
1. Events:
	emit - build(data)
	* data:
		option: resources(0) / money(1)
		build:
			cx: chunk x
			cy: chunk y
			dx: rel.offset row
			dy: rel.offset col
			value: index of building
	
	emit - upgrade_building(data)
	* data:
		option: resources(0) / money(1)
		coords:
			cx, cy, dx, dy
	
	emit - remove_building(data)
	* data:
		cx, cy, dx, dy

	on - resources_updated(JSON)
	* JSON:
		r, g, b, m - total of resources
		cap - capacity
2. Graphics:
	shown below
3. Gameplay:
	add mousedown for overlay which emits events form (1)
*/

const socket = io.connect();
socket.on('connect', function() {
	console.log("connect");
});

const gl = PIXI.autoDetectRenderer(256, 256),
	  imagePathList = buildImgPathList();

const gameCycle = {start: start};
function start() {
	sayHello();
	resizeRenderer();
	document.body.appendChild(gl.view);
	PIXI.loader
		.add(imagePathList)
		.on("progress", showProgress)
		.load(designOverlayAndEmitPlayer);
};

const content = new PIXI.Container(), 
	  stage = new PIXI.Container(), 
	  overlay = new PIXI.Container();

var zeroPoint;
var tick = false;

socket.on('gameDataSend', function(gameData) {
	console.log("game data send");
	
	getBounds(gameData.mapParams, gameData.homeCell);
	fillMap(gameData.mapParams, gameData.buildings);
	
	addResizeListener();
	addKeyboardMovement();
	addMouseListener();
	
	fillSpriteArray();
	content.addChild(stage);
	gl.render(content);
	
	updRenderingBounds(zeroPoint);
	tick = true;
});

setInterval(velocityTick, 2);

socket.on('chunkUpdated', function(chunk) {
	console.log("chunk updated");
	mapOfChunks[chunk.x][chunk.y] = chunk;
	fillSpriteContainer(chunk.x, chunk.y);
	updRenderingBounds(zeroPoint);
});

//--------------------------

function texture(path) {
	return PIXI.loader.resources[path].texture;
};

function img(name) {
	return `./client/img/${name}.png`;
}

function buildImgPathList() {
	var res = [];
	for (let i = 0; i < 4; ++i)
		res.push(img(`cell_color${i}`));
	for (let i = 1; i < 12; ++i)
		for (let j = 0; j < 7; ++j)
			res.push(img(`building${i}_${j}`));
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
	if (!progressText)
		progressText = new PIXI.Text('', {fontFamily : 'Arial', fontSize: 24, fill : 0x000000, align : 'center'});
	progressText.text = `Progress: ${loader.progress}%`;
};

var cellSideSizeInPixels;
function designOverlayAndEmitPlayer() {
	//TODO: overlay design
	content.addChild(overlay);
	
	cellSideSizeInPixels = new PIXI.Sprite(texture(img("cell_color0"))).height / 2;
	
	socket.emit('new_player', {
		id: socket.id,
		//maybe smth else
	});
};

function keyboard(keyCode) {
	var key = {
		code: keyCode,
		isDown: false,
		isUp: true,
		press: function() {},
		release: function() {},
		downHandler: function(event) {
			if (event.keyCode === key.code) {
				if (key.isUp && key.press) {
					key.press();
				}
				key.isDown = true;
				key.isUp = false;
			}
			event.preventDefault();
		},
		upHandler: function(event) {
			if (event.keyCode === key.code) {
				if (key.isDown && key.release) {
					key.release();
				}
				key.isDown = false;
				key.isUp = true;
			}
			event.preventDefault();
		}
	};

	window.addEventListener("keydown", key.downHandler.bind(key), false);
	window.addEventListener("keyup", key.upHandler.bind(key), false);

	return key;
}

var mapSizeInCells, mapWidthInChunks, mapHeightInChunks;
var chunkWidthInCells, chunkHeightInCells;
var lastBounds;

var CE;
var homeCell;
var boundsOnMapInPixels, d;
var focus, focusVelocity;

function getBounds(mapParams, homeCell) {
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

var mapOfChunks = [[]];
function fillMap(mapParams, buildings) {
	mapOfChunks = MapGen.buildChunked(mapParams);
	if (buildings.length) {
		for (let i = 0; i < mapWidthInChunks; ++i) {
			if (buildings[i] === undefined) continue;
			for (let j = 0; j < mapHeightInChunks; ++j) {
				if (buildings[i][j] === undefined) continue;
				mapOfChunks[i][j].bui = buildings[i][j];
			}
		}
	}
}

function addResizeListener() {
	window.addEventListener("resize", (event) => {
		d = new CE.Point(window.innerWidth / 2, window.innerHeight / 2);
		focus = boundsOnMapInPixels.topLeft.add(d);
		stage.x = -focus.getX() + d.getX();
		stage.y = -focus.getY() + d.getY();
	}, false);
}

const keyLeft = keyboard(65), 
	  keyRight = keyboard(68), 
	  keyUp = keyboard(87), 
	  keyDown = keyboard(83);

function addKeyboardMovement() {
	var step = 3;
	keyLeft.press = keyRight.release = moveScreenByPoint(new CE.Point(-step, 0));
	keyRight.press = keyLeft.release = moveScreenByPoint(new CE.Point(step, 0));
	keyUp.press = keyDown.release = moveScreenByPoint(new CE.Point(0, -step));
	keyDown.press = keyUp.release = moveScreenByPoint(new CE.Point(0, step));	
}

function moveScreenByPoint(point) {
	return () => {
		focusVelocity = focusVelocity.add(point);
	}
};

function addMouseListener() {
	stage.interactive = true;
	stage.on('mousedown', (event) => {
		var relativePoint = event.data.getLocalPosition(stage);
		var newFocus = new CE.Point(relativePoint.x, relativePoint.y)
						.toOffset()
						.toPoint();
		updRenderingBounds(newFocus.sub(focus));
		focus = newFocus;
		//TODO: show choice menu
	}, {passive: true});	
}

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

function velocityTick() {
	if (tick) {
		focus = focus.add(focusVelocity);
		boundsOnMapInPixels.pushFocus();
		updRenderingBounds(focusVelocity);
	}
	resizeRenderer();
}

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

gameCycle.start();