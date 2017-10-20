const socket = io.connect();

var coords = require('coords');
var map_gen = require('map_gen');

const game = new Phaser.Game(innerWidth, innerHeight,
	Phaser.AUTO, 'gameDiv');
var camera;

var gameProperties = {
	game_width: 4000,
	game_height: 4000,
	hex_size: 40,
	chunk_params: coords.ChunkParams(3, 3),
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
	game.physics.startSystem(Phaser.Physics.P2JS);
	game.physics.p2.setBoundsToWorld(false, false, false, false, false);
	game.physics.p2.gravity.y = 0;
	game.physics.p2.applyGravity = false;
};

function create() {
	game.stage.backgroundColor = 0x000000;
	socket.on('connect', function() {
		createPlayer();
		gameProperties.in_game = true;
	});
	socket.on('player_send', function(spawn) {
		spawn_point = spawn;
		focus = coords.offset_to_pixel(spawn, 
			gameProperties.hex_size, coords.Point(0, 0));
		var shift = coords.Point(innerWidth / 2, innerHeight / 2);
		corner = coords.point_substract(focus, shift);
		game.camera.x = focus.px_x;
		game.camera.y = focus.px_y;
	});
	socket.on('map_send', function(pack) {
		var map = map_gen.distributed_resource_map(pack);
		var graphics = game.add.graphics(0, 0);
		//draw map - only hexes and resources
		var size = (1 << pack.log_size) + 1;
		for (let i = 0; i < size; ++i)
			for (let j = 0; j < size; ++j) {
				let center = coords.offset_to_pixel(
					{row: i, col: j}, 
					gameProperties.hex_size, 
					{px_x: 0, px_y: 0}
				);

				graphics.beginFill(getColor(map[i + '_' + j]));
				function getColor(index) {
					switch(index) {
						case 0:
						return 0x000000;
						case 1:
						return 0x960018;
						case 2:
						return 0x1cd3a2;
						case 3:
						return 0x9932cc;
					}
				};

    			graphics.lineStyle(1, 0x000000, 1);

				let t = coords.hex_corner(center, gameProperties.hex_size, 5);
				graphics.moveTo(t.px_x, t.px_y);
				for (let k = 0; k < 6; ++k) {
					t = coords.hex_corner(center, gameProperties.hex_size, k);
					graphics.lineTo(t.px_x, t.px_y);
				}

				graphics.endFill();
			}

		window.graphics = graphics;
	});
};

var spawn_point, corner, focus;

function request_chunks() {
	socket.emit('chunks_requested', {
		topleft: coords.pixel_to_chunk(
			{px_x: 0, px_y: 0}, gameProperties.hex_size, corner),
		bottomright: coords.pixel_to_chunk(
			{px_x: innerWidth, px_y: innerHeight},
			gameProperties.hex_size, corner)
	});
};

function update() {
	if (game.input.activePointer.isDown) {	
		if (game.origDragPoint) {		
			var old_chunk = coords.pixel_to_chunk(
				coords.Point(0, 0),
				gameProperties.hex_size, corner, 
				gameProperties.chunk_params);

			game.camera.x += game.origDragPoint.x - game.input.activePointer.position.x;		
			game.camera.y += game.origDragPoint.y - game.input.activePointer.position.y;
			
			corner.px_x += game.origDragPoint.x - game.input.activePointer.position.x;
			corner.px_y += game.origDragPoint.y - game.input.activePointer.position.y;

			var new_chunk = coords.pixel_to_chunk(
				coords.Point(0, 0),
				gameProperties.hex_size, corner, 
				gameProperties.chunk_params);

			if (old_chunk != new_chunk)
				socket.emit('chunks_requested', {
					topleft: new_chunk,
					bottomright: coords.pixel_to_chunk(
						coords.Point(innerWidth, innerHeight),
						gameProperties.hex_size, corner, 
						gameProperties.chunk_params)
				});
		}	
		game.origDragPoint = game.input.activePointer.position.clone();
	}
	else {	
		game.origDragPoint = null;
	}
};

var chunks_list = [];
function render() {
	var size = chunks_list.length;
	for (let i = 0; i < size; ++i)
		draw(chunks_list[i]);
	chunks_list.slice(size);
};
function draw(chunk) {
//TODO: draws only buildings with owner's color
};

socket.on('chunks_received', append_chunks);
function append_chunks(chunk_table) {
	chunk_table.forEach(function(item, index, array) {
		if (!chunks_list.includes(item))
			chunks_list.push(item);
	});
};

socket.on('chunk_updated', append_chunk_if_needed);
function append_chunk_if_needed(chunk) {
	if (coords.chunk_inside(
		chunk, 
		coords.pixel_to_chunk(
			coords.Point(0, 0),
			gameProperties.hex_size, corner, 
			gameProperties.chunk_params),
		coords.pixel_to_chunk(
			coords.Point(innerWidth, innerHeight),
			gameProperties.hex_size, corner, 
			gameProperties.chunk_params))
		)
		chunks_list.push(chunk);
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