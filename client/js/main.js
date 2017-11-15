const socket = io.connect();

//phaser-dependent
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

const innerWidth = 0.9 * window.innerWidth,
	  innerHeight = 0.9 * window.innerHeight;
//0.95 * Math.max(Math.floor(window.innerHeight / 1080 * 1000), document.documentElement.clientHeight);
const game = new Phaser.Game(innerWidth, innerHeight,
	Phaser.AUTO, 'gameDiv');
var map_index, corner, focus;
var hex_size, chunk_params = new ChunkParams(3, 3);

var gameProperties = {
	game_width: 4000,
	game_height: 4000
};

socket.on('connect', function() {
	console.log("connect");
});

socket.on('player_send', function(spawn) {
	console.log("player send " + spawn);
	
	map_index = spawn.i;
	
	//camera
	focus = offset_to_pixel(spawn, hex_size, new Point(0, 0));
	var shift = new Point(innerWidth / 2, innerHeight / 2);
	corner = point_substract(focus, shift);
	request_chunks();

	//phaser-dependent
	game.camera.x = focus.px_x;
	game.camera.y = focus.px_y;
});

function request_chunks() {
	let topleft = pixel_to_chunk(
			{px_x: 0, px_y: 0}, 
			hex_size, corner, chunk_params),
		bottomright = pixel_to_chunk(
			{px_x: innerWidth, px_y: innerHeight},
			hex_size, corner, chunk_params);
	console.log(topleft.x + "-" + bottomright.x + "/" + topleft.y + "-" + bottomright.y + " at map_index " + map_index);
	socket.emit('chunks_requested', {
		left: topleft.x,
		right: bottomright.x,
		top: topleft.y,
		bottom: bottomright.y
	}, map_index);
};


socket.on('chunks_received', draw_chunks);
function draw_chunks(chunk_table) {
	console.log("chunks received");
	chunk_table.forEach(function(item, index, array) {
		draw_chunk(item);
	});
};

socket.on('chunk_updated', append_chunk_if_needed);
function append_chunk_if_needed(chunk) {
	console.log("chunk updated");
	if (chunk_inside(
		chunk, 
		pixel_to_chunk(
			new Point(0, 0),
			hex_size, corner, chunk_params),
		pixel_to_chunk(
			new Point(innerWidth, innerHeight),
			hex_size, corner, chunk_params)
		)
	) {
		//phaser-dependent
		var graphics = game.add.graphics(0, 0);
		draw_chunk(graphics, chunk);
		window.graphics = graphics;
	}
};

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