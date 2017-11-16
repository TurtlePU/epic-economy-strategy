//socket.io
const socket = io.connect();

socket.on('connect', function() {
	console.log("connect");
});

//PIXI.js
const gl = PIXI.autoDetectRenderer(256, 256);
const stage = new PIXI.Container();
function texture(path) {
	return PIXI.loader.resources[path].texture;
};

const imagePathList = [
	"bmp/cell_color0.bmp", 
	"bmp/cell_color1.bmp", 
	"bmp/cell_color2.bmp", 
	"bmp/cell_color3.bmp"
];

var gameCycle = {
	start: start
};

function start() {
	sayHello();

	resizeRenderer();
	document.body.appendChild(gl.view);
	
	PIXI.loader
		.add(imagePathList)
		.on("progress", showProgress)
		.load(emitPlayer);

	gl.render(stage);
};
//start subordinates
function sayHello() {
	var type = "WebGL";
	if (!PIXI.utils.isWebGLSupported()) {
		type = canvas;
	}
	PIXI.utils.sayHello(type);
};

function resizeRenderer() {
	gl.view.style.position = "absolute";
	gl.view.style.display = "block";
	gl.autoResize = true;
	gl.resize(window.innerWidth, window.innerHeight);
};

function showProgress(loader, resource) {
	console.log("loading...");
	//TODO: Progress bar
	//loader.progress - progress in %
};

function emitPlayer() {
	socket.emit('new_player', {
		id: socket.id,
		//maybe smth else
	});
};

//TODO: set cellSideSize
var cellSideSizeInPixels;
//I don't know whether I need it
function fillRootContainer() {
	imagePathList.forEach(function(item, index, array) {
		let sprite = new PIXI.Sprite(texture(item));
		//put inside stage
		stage.addChild(sprite);
	});
};
//end of start subordinates

//TODO: map index should be stored at server
var mapOfChunks = [];
var chunkContainers = [];
var mapSizeInCells, mapWidthInChunks, mapHeightInChunks;

var chunkWidthInCells, chunkHeightInCells;
var homeCell;
var boundsOnMapInPixels;
//TODO: add socket.emit on server side
socket.on('gameDataSend', function(gameData) {
	console.log("game data send");
	fillVarFromData(gameData);
	fillSpriteArray();
	//Move camera to homeCell
	buildBounds();
});
//gameDataSend subordinates
function fillVarFromData(gameData) {
	mapSizeInCells = (1 << gameData.logSize) + 1;
	chunkWidthInCells = gameData.chunkWidth;
	chunkHeightInCells = gameData.chunkHeight;

	mapWidthInChunks = Math.ceil(mapSizeInCells / chunkWidthInCells);
	mapHeightInChunks = Math.ceil(mapSizeInCells / chunkHeightInCells);

	mapOfChunks = MapGen.buildChunked(gameData);
	homeCell = gameData.homeCell;
};

function fillSpriteArray() {
	for (let i = 0; i < mapWidthInChunks; ++i) {
		chunkContainers[i] = [];
		for (let j = 0; j < mapHeightInChunks; ++j) {
			fillSpriteContainer(i, j);
		}
	}
};

function fillSpriteContainer(i, j) {
	if (chunkContainers[i][j] != undefined)
		stage.removeChild(chunkContainers[i][j]);
	chunkContainers[i][j] = new PIXI.Container();
	for (let x = 0; x < chunkWidthInCells; ++x) {
		for (let y = 0; y < chunkHeightInCells; ++y) {
			//TODO: set coords of sprites
			var cellSprites = getSpritesOfCell(i, j, x, y);
			chunkContainers[i][j].addChild(cellSprites[0], cellSprites[1]);
		}
	}
	//TODO: set coords of chunk container
	stage.addChild(chunkContainers[i][j]);
};

function getSpritesOfCell(i, j, x, y) {
	var strs = getPathsOfCellImage(i, j, x, y);
	var arr = [];
	strs.forEach(function(item, index, array) {
		arr.add(new PIXI.Sprite(texture(item)));
	});
	return arr;
};

function getPathsOfCellImage(i, j, x, y) {
	return [
		"bmp/cell_color" + mapOfChunks[i][j].res[x][y] + ".bmp",
		"bmp/building" + mapOfChunks[i][j].bui[x][y] + ".bmp"
	];
};

function buildBounds() {
	//TODO: make camera coordinates right
};
//end of GameDataSend subordinates

socket.on('chunkUpdated', function(chunk) {
	console.log("chunk updated");
	mapOfChunks[chunk.x][chunk.y] = chunk;
	fillSpriteContainer(chunk.x, chunk.y);
});

//THIS IS AS FAR AS I GO

//phaser-dependent
function draw_chunk(
	//graphics, 
	chunk
) {
	let w = chunk_params.width,
		h = chunk_params.height,
		s = hex_size,
		init_i = chunk.x * w;
	for (let i = init_i; i < init_i + w; ++i) {
		if (chunk.res[i - init_i] == undefined)
			break;
		let init_j = chunk.y * h;
		for (let j = init_j; j < init_j + h; ++j) {
			if (chunk.res[i - init_i][j - init_j] == undefined)
				break;
			let game_center = offset_to_pixel(
				{row: i, col: j}, s, 
				new Point(0, 0)
			);

			//graphics.beginFill(getColor(chunk.res[i - init_i][j - init_j]));
			//function getColor(index) {
			//	switch(index) {
			//		case 0:
			//		return 0xffffff;
			//		case 1:
			//		return 0x960018;
			//		case 2:
			//		return 0x1cd3a2;
			//		case 3:
			//		return 0x9932cc;
			//	}
			//};

    		//graphics.lineStyle(1, 0x000000, 1);

			//let t = hex_corner(center, s, 5);
			//graphics.moveTo(t.px_x, t.px_y);
			//for (let k = 0; k < 6; ++k) {
			//	t = hex_corner(center, s, k);
			//	graphics.lineTo(t.px_x, t.px_y);
			//}

			//graphics.endFill();

			bmd.draw(getSprite(chunk.res[i - init_i][j - init_j]), game_center.px_x, game_center.px_y);
			function getSprite(index) {
				return empty_cell;
			};
			console.log(game_center.px_x + " " + game_center.px_y);

			//add smth with buildings
		}
	}
};

//phaser-dependent
var main = function(game){};
main.prototype = {
	init: function() {
		game.kineticScrolling = 
		game.plugins.add(Phaser.Plugin.KineticScrolling);
	},
	preload: preload,
	create: create,
	update: update,
};

//phaser-dependent
function preload() {
	game.kineticScrolling.configure({
		horizontalScroll: true,
		verticalScroll: true
	});
	game.world.setBounds(0, 0, 
		gameProperties.game_width, gameProperties.game_height);
	game.load.image('empty_cell', 'client/js/bmp/empty_cell.bmp');
};

//phaser-dependent
var bmd, empty_cell;
//phaser-dependent
function create() {
	game.stage.backgroundColor = 0x000000;
	game.kineticScrolling.start();

	bmd = game.add.bitmapData(game.width, game.height);
	bmd.addToWorld();

	empty_cell = game.make.sprite(0, 0, 'empty_cell');
};

//phaser-dependent
function update() {
	if (game.camera.x != focus.px_x || game.camera.y != focus.px_y) {
		focus.px_x = game.camera.x;
		focus.px_y = game.camera.y;
		corner = point_substract(focus, new Point(innerWidth / 2, innerHeight / 2));
		if (map_index != undefined)
			request_chunks();
	}
};

gameBootstrapper.init("gameDiv");