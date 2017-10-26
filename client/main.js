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
	render: render
};

function preload() {
	game.scale.scaleMode = Phaser.ScaleManager.RESIZE;
	game.world.setBounds(0, 0, 
		gameProperties.game_Width, gameProperties.game_Height, 
		false, false, false, false);
};

var map_index;

function create() {
	game.stage.backgroundColor = 0x000000;
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
	socket.emit('chunks_requested', {
		left: topleft.x,
		right: bottomright.x,
		top: topleft.y,
		bottom: bottomright.y
	}, map_index);
};

function update() {
	if (game.input.activePointer.isDown) {	
		if (game.origDragPoint) {		
			var old_chunk = pixel_to_chunk(
				new Point(0, 0),
				gameProperties.hex_size, corner, 
				gameProperties.chunk_params);

			game.camera.x += game.origDragPoint.x - game.input.activePointer.position.x;		
			game.camera.y += game.origDragPoint.y - game.input.activePointer.position.y;
			
			corner.px_x += game.origDragPoint.x - game.input.activePointer.position.x;
			corner.px_y += game.origDragPoint.y - game.input.activePointer.position.y;

			var new_chunk = pixel_to_chunk(
				new Point(0, 0),
				gameProperties.hex_size, corner, 
				gameProperties.chunk_params);

			if (old_chunk != new_chunk)
				request_chunks();
		}	
		game.origDragPoint = game.input.activePointer.position.clone();
	}
	else {	
		game.origDragPoint = null;
	}
};

function render() {
	//var size = chunks_list.length;
	//for (let i = 0; i < size; ++i)
	//	draw(chunks_list[i]);
	//chunks_list.slice(size);
};

function draw_chunk(graphics, chunk) {
		for (let i = chunk.x; i < chunk.x + gameProperties.chunk_params.width; ++i)
			for (let j = chunk.y; j <= chunk.y + gameProperties.chunk_params.height; ++j) {
				let center = offset_to_pixel(
					{row: i, col: j}, 
					gameProperties.hex_size, 
					{px_x: 0, px_y: 0}
				);

				graphics.beginFill(getColor(chunk.res[i + '_' + j]));
				function getColor(index) {
					switch(index) {
						case 0:
						return 0xFFFFFF;
						case 1:
						return 0x960018;
						case 2:
						return 0x1cd3a2;
						case 3:
						return 0x9932cc;
					}
				};

    			graphics.lineStyle(1, 0x000000, 1);

				let t = hex_corner(center, gameProperties.hex_size, 5);
				graphics.moveTo(t.px_x, t.px_y);
				for (let k = 0; k < 6; ++k) {
					t = hex_corner(center, gameProperties.hex_size, k);
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