const socket = io.connect();

const innerWidth = Math.floor(window.innerWidth / 1920 * 1000);
	  innerHeight = Math.floor(window.innerHeight / 1080 * 1000);
const game = new Phaser.Game(innerWidth, innerHeight,
	Phaser.AUTO, 'gameDiv');
var camera;

var gameProperties = {
	game_width: 4000,
	game_height: 4000,
	hex_size: 40,
	chunk_params: new ChunkParams(3, 3),
	game_element: 'gameDiv',
	in_game: false
};

var main = function(game){};
main.prototype = {
	preload: preload,
	create: create,
	update: update,
	//render: render
};

function preload() {
	game.scale.scaleMode = Phaser.ScaleManager.RESIZE;
	game.world.setBounds(0, 0, 
		gameProperties.game_Width, gameProperties.game_Height, 
		false, false, false, false);
	game.kineticScrolling = game.plugins.add(Phaser.Plugin.KineticScrolling);
	game.kineticScrolling.configure({
		horizontalScroll: true,
		verticalScroll: true
	});
};

var map_index;

function create() {
	game.stage.backgroundColor = 0x000000;
	game.kineticScrolling.start();
	socket.on('connect', function() {
		console.log("connect");
		createPlayer();
		gameProperties.in_game = true;
	});
	socket.on('player_send', function(spawn) {
		console.log("player send " + spawn);
		map_index = spawn.i;
		focus = offset_to_pixel(spawn, 
			gameProperties.hex_size, new Point(0, 0));
		var shift = new Point(innerWidth / 2, innerHeight / 2);
		corner = point_substract(focus, shift);
		request_chunks();
		game.camera.x = focus.px_x;
		game.camera.y = focus.px_y;
	});
};

var corner, focus;

function request_chunks() {
	let topleft = pixel_to_chunk(
			{px_x: 0, px_y: 0}, 
			gameProperties.hex_size, corner, 
			gameProperties.chunk_params),
		bottomright = pixel_to_chunk(
			{px_x: innerWidth, px_y: innerHeight},
			gameProperties.hex_size, corner,
			gameProperties.chunk_params);
	console.log(topleft.x + "-" + bottomright.x + "/" + topleft.y + "-" + bottomright.y);
	socket.emit('chunks_requested', {
		left: topleft.x,
		right: bottomright.x,
		top: topleft.y,
		bottom: bottomright.y
	}, map_index);
};

function update() {
	if (game.camera.x != focus.px_x || game.camera.y != focus.px_y) {
		focus.px_x = game.camera.x;
		focus.px_y = game.camera.y;
		corner = point_substract(focus, new Point(innerWidth / 2, innerHeight / 2));
		request_chunks();
	}
};

function render() {
	//var size = chunks_list.length;
	//for (let i = 0; i < size; ++i)
	//	draw(chunks_list[i]);
	//chunks_list.slice(size);
};

function draw_chunk(graphics, chunk) {
	let w = gameProperties.chunk_params.width,
		h = gameProperties.chunk_params.height,
		s = gameProperties.hex_size;
	for (let i = chunk.x * w; i < (chunk.x + 1) * w; ++i)
		for (let j = chunk.y * h; j < (chunk.y + 1) * h; ++j) {
			let center = offset_to_pixel(
				{row: i, col: j}, s, 
				corner
			);

			graphics.beginFill(getColor(chunk.res[i - chunk.x * w][j - chunk.y * h]));
			function getColor(index) {
				switch(index) {
					case 0:
					return 0xffffff;
					case 1:
					return 0x960018;
					case 2:
					return 0x1cd3a2;
					case 3:
					return 0x9932cc;
				}
			};

    		graphics.lineStyle(1, 0x000000, 1);

    		console.log(center.px_x + " " + center.px_y + " " + chunk.res[i - chunk.x * w][j - chunk.y * h]);

			let t = hex_corner(center, s, 5);
			graphics.moveTo(t.px_x, t.px_y);
			for (let k = 0; k < 6; ++k) {
				t = hex_corner(center, s, k);
				graphics.lineTo(t.px_x, t.px_y);
			}

			graphics.endFill();

			//add smth with buildings
		}
};

socket.on('chunks_received', draw_chunks);
function draw_chunks(chunk_table) {
	console.log("chunks received");
	var graphics = game.add.graphics(0, 0);
	chunk_table.forEach(function(item, index, array) {
		console.log(index + ": ");
		console.log(JSON.stringify(item));
		console.log(item.res);
		draw_chunk(graphics, item);
	});
	window.graphics = graphics;
};

socket.on('chunk_updated', append_chunk_if_needed);
function append_chunk_if_needed(chunk) {
	console.log("chunk updated");
	if (chunk_inside(
		chunk, 
		pixel_to_chunk(
			new Point(0, 0),
			gameProperties.hex_size, corner, 
			gameProperties.chunk_params),
		pixel_to_chunk(
			new Point(innerWidth, innerHeight),
			gameProperties.hex_size, corner, 
			gameProperties.chunk_params))
		) 
	{
		var graphics = game.add.graphics(0, 0);
		draw_chunk(graphics, chunk);
		window.graphics = graphics;
	}
};

function createPlayer() {
	
};

var gameBootstrapper = {
	init: function(gameContainerElementId) {
		game.state.add('main', main);
		game.state.start('main');
		socket.emit('new_player', {
			id: socket.id,
			//maybe smth else
		});
	}
};

gameBootstrapper.init("gameDiv");