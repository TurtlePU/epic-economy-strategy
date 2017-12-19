//socket.io
const socket = io.connect();

socket.on('connect', function() {
	console.log("connect");
});

//PIXI.js
const gl = PIXI.autoDetectRenderer(256, 256);
const content = new PIXI.Container(), stage = new PIXI.Container();
function texture(path) {
	return PIXI.loader.resources[path].texture;
};

const imagePathList = [
	"client/bmp/cell_color0.png", 
	"client/bmp/cell_color1.png", 
	"client/bmp/cell_color2.png", 
	"client/bmp/cell_color3.png"
];

var gameCycle = {
	start: start
};

var cellSideSizeInPixels;

function resizeRenderer() {
	gl.autoResize = true;
	gl.resize(window.innerWidth, window.innerHeight);
};

function start() {
	function sayHello() {
		var type = "WebGL";
		if (!PIXI.utils.isWebGLSupported()) {
			type = canvas;
		}
		PIXI.utils.sayHello(type);
	};
	sayHello();
	
	resizeRenderer();
	document.body.appendChild(gl.view);
	
	function showProgress(loader, resource) {
		console.log("loading...");
		//TODO: Progress bar
		//loader.progress - progress in %
	};
	function emitPlayer() {
		cellSideSizeInPixels = new PIXI.Sprite(texture("client/bmp/cell_color0.png")).height / 2;
		socket.emit('new_player', {
			id: socket.id,
			//maybe smth else
		});
	};

	PIXI.loader
		.add(imagePathList)
		.on("progress", showProgress)
		.load(emitPlayer);
};

var mapOfChunks = [[]];
var chunkContainers = [[]];
var mapSizeInCells, mapWidthInChunks, mapHeightInChunks;

var CE;
var zeroPoint;

var chunkWidthInCells, chunkHeightInCells;
var homeCell;
var boundsOnMapInPixels;
var focus, focusVelocity;

const 
keyLeft = keyboard(65), 
keyRight = keyboard(68), 
keyUp = keyboard(87), 
keyDown = keyboard(83);

var lastBounds;

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

var tick = false;

socket.on('gameDataSend', function(gameData) {
	console.log("game data send");

	function fillVarFromData() {
		mapSizeInCells = (1 << gameData.mapParams.logSize) + 1;
		chunkWidthInCells = gameData.mapParams.chunkWidth;
		chunkHeightInCells = gameData.mapParams.chunkHeight;

		mapWidthInChunks = Math.ceil(mapSizeInCells / chunkWidthInCells);
		mapHeightInChunks = Math.ceil(mapSizeInCells / chunkHeightInCells);

		lastBounds = {x1: 0, y1: 0, x2: mapWidthInChunks - 1, y2: mapHeightInChunks - 1};

		CE = new CoordsEnvironment(cellSideSizeInPixels, chunkWidthInCells, chunkHeightInCells);
		zeroPoint = new CE.Point(0, 0);

		mapOfChunks = MapGen.buildChunked(gameData.mapParams);
		homeCell = new CE.Offset(gameData.homeCell.row, gameData.homeCell.col);

		//TODO: fix rescale

		focus = homeCell.toPoint();
		focusVelocity = zeroPoint;
		let d = new CE.Point(window.innerWidth / 2, window.innerHeight / 2), 
		padding = new CE.Point(cellSideSizeInPixels * chunkWidthInCells, cellSideSizeInPixels * chunkHeightInCells);
		boundsOnMapInPixels = {
			topLeft: focus.sub(d).sub(padding),
			botRigt: focus.add(d).add(padding),
			pushFocus: function() {
				this.topLeft = focus.sub(d).sub(padding);
				this.botRigt = focus.add(d).add(padding);
			}
		};

		stage.x = -focus.getX() + d.getX();
		stage.y = -focus.getY() + d.getY();

		var step = 3;
		keyLeft.press = keyRight.release = moveScreenByPoint(new CE.Point(-step, 0));
		keyRight.press = keyLeft.release = moveScreenByPoint(new CE.Point(step, 0));
		keyUp.press = keyDown.release = moveScreenByPoint(new CE.Point(0, -step));
		keyDown.press = keyUp.release = moveScreenByPoint(new CE.Point(0, step));

		stage.interactive = true;
		stage.on('mousedown', (event) => {
			var relativePoint = event.data.getLocalPosition(stage);
			var newFocus = new CE.Point(relativePoint.x, relativePoint.y)
					.toOffset().toPoint();
			updRenderingBounds(newFocus.sub(focus));
			focus = newFocus;
			//TODO: show choice menu
		}, {passive: true});

		function moveScreenByPoint(point) {
			return () => {
				focusVelocity = focusVelocity.add(point);
			}
		};
	};
	fillVarFromData();

	content.addChild(stage);
	gl.render(content);

	function fillSpriteArray() {
		for (let i = 0; i < mapWidthInChunks; ++i) {
			chunkContainers[i] = [];
			for (let j = 0; j < mapHeightInChunks; ++j) {
				fillSpriteContainer(i, j);
			}
		}
	};
	fillSpriteArray();
	console.log("sprite array filled");
	tick = true;
	updRenderingBounds(zeroPoint);
	//TODO: show resources overlay
});

socket.on('chunkUpdated', function(chunk) {
	console.log("chunk updated");
	mapOfChunks[chunk.x][chunk.y] = chunk;
	fillSpriteContainer(chunk.x, chunk.y);
	updRenderingBounds(zeroPoint);
});

function fillSpriteContainer(i, j) {
	if (chunkContainers[i][j] != undefined)
		stage.removeChild(chunkContainers[i][j]);
	chunkContainers[i][j] = new PIXI.Container();
	
	var pixelCoord = new CE.Chunk(i, j).upperLeftPixel();
	chunkContainers[i][j].x = pixelCoord.getX();
	chunkContainers[i][j].y = pixelCoord.getY();

	function getPathsOfCellImage(x, y) {
		if (!mapOfChunks[i][j].res[x][y]) mapOfChunks[i][j].res[x][y] = 0;
		return [
			"client/bmp/cell_color" + mapOfChunks[i][j].res[x][y] + ".png"//,
			//"client/bmp/building" + mapOfChunks[i][j].bui[x][y] + ".png"
		];
	};

	function getSpritesOfCell(x, y) {
		var strs = getPathsOfCellImage(x, y);
		var arr = [];
		strs.forEach(function(item, index, array) {
			arr.push(new PIXI.Sprite(texture(item)));
		});
		return arr;
	};

	for (let x = 0; x < chunkWidthInCells; ++x) {
		if (!mapOfChunks[i][j].res[x]) break;
		for (let y = 0; y < chunkHeightInCells; ++y) {
			var cellSprites = getSpritesOfCell(x, y);
			chunkContainers[i][j].addChild(
				cellSprites[0]//, 
				//cellSprites[1]
			);
			var pc = new CE.Offset(x, y).toPoint();
			cellSprites[0].x = 
				//cellSprites[1].x = 
					pc.getX();
			cellSprites[0].y = 
				//cellSprites[1].y = 
					pc.getY();
		}
	}
	stage.addChild(chunkContainers[i][j]);
};

//TODO: Event handling
//4th - building choice

//TODO: Fix map scaling

function velocityTick() {
	if (tick) {
		focus = focus.add(focusVelocity);
		boundsOnMapInPixels.pushFocus();
		updRenderingBounds(focusVelocity);
	}
	resizeRenderer();
}
setInterval(velocityTick, 2);

function updRenderingBounds(delta) {

	function getRenderingBounds() {
		let tl = boundsOnMapInPixels.topLeft.toChunk(),
			br = boundsOnMapInPixels.botRigt.toChunk();
		return {x1: tl.getX(), x2: br.getX(), y1: tl.getY(), y2: br.getY()};
	};
	let bounds = getRenderingBounds();
	
	let x1 = lastBounds.x1,
		x2 = lastBounds.x2,
		y1 = lastBounds.y1,
		y2 = lastBounds.y2,

		tx1 = bounds.x1,
		tx2 = bounds.x2,
		ty1 = bounds.y1,
		ty2 = bounds.y2;

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

	with(Math) {
		setChunksVisible(x1, min(x2, tx1 - 1), y1, min(y2, ty1 - 1), false);
		setChunksVisible(max(x1, tx1), min(x2, tx2), y1, min(y2, ty1 - 1), false);
		setChunksVisible(max(x1, tx2 + 1), x2, y1, min(y2, ty1 - 1), false);
		setChunksVisible(x1, min(x2, tx1 - 1), max(y1, ty1), min(y2, ty2), false);
		setChunksVisible(max(x1, tx2 + 1), x2, max(y1, ty1), min(y2, ty2), false);
		setChunksVisible(x1, min(x2, tx1 - 1), max(y1, ty2 + 1), y2, false);
		setChunksVisible(max(x1, tx1), min(x2, tx2), max(y1, ty2 + 1), y2, false);
		setChunksVisible(max(x1, tx2 + 1), x2, max(y1, ty2 + 1), y2, false);

		setChunksVisible(tx1, min(tx2, x1 - 1), ty1, min(ty2, y1 - 1), true);
		setChunksVisible(max(tx1, x1), min(tx2, x2), ty1, min(ty2, y1 - 1), true);
		setChunksVisible(max(tx1, x2 + 1), tx2, ty1, min(ty2, y1 - 1), true);
		setChunksVisible(tx1, min(tx2, x1 - 1), max(ty1, y1), min(ty2, y2), true);
		setChunksVisible(max(tx1, x2 + 1), tx2, max(ty1, y1), min(ty2, y2), true);
		setChunksVisible(tx1, min(tx2, x1 - 1), max(ty1, y2 + 1), ty2, true);
		setChunksVisible(max(tx1, x1), min(tx2, x2), max(ty1, y2 + 1), ty2, true);
		setChunksVisible(max(tx1, x2 + 1), tx2, max(ty1, y2 + 1), ty2, true);

		setChunksVisible(max(x1, tx1), min(x2, tx2), max(y1, ty1), min(y2, ty2), true);
	}

	stage.x -= delta.getX();
	stage.y -= delta.getY();
	lastBounds = bounds;

	gl.render(content);
};

gameCycle.start();