const socket = io.connect();
const coords = require('./coords.js');

const game = new Phaser.Game(innerWidth, innerHeight,
	Phaser.AUTO, 'gameDiv');

var gameProperties = {
	game_width: 4000,
	game_height: 4000,
	game_element: 'gameDiv',
	in_game: false
};

var main = function(game){};
main.prototype = {
	preload: preload,
	create: create,
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

	var field_group = game.add.group();
	var bounds = game.world.getBounds()
	var field = field_group.create(bounds.x, bounds.y, 'field');
		
	field.inputEnabled = true;
	field.input.enableDrag();
	field.events.onDragStart.add(onFieldDragStart, this);
	field.events.onDragStop.add(onFieldDragStop, this);
	field.events.onInputDown.add(onFieldDown, this);
};

var camera;
var corner, focus;
function onFieldDragStart(sprite, pointer, x, y) {
	//start dragging
};
function onFieldDragStop(sprite, pointer) {
	//release drag
};
function onFieldDown(sprite, pointer) {

};

function request_chunks() {
	socket.emit('chunks_requested', {
		topleft: coords.pixel_to_chunk(
			{px_x: 0, px_y: 0}, hex_size, corner),
		bottomright: coords.pixel_to_chunk(
			{px_x: innerWidth, px_y: innerHeight},
			hex_size, corner)
	});

};

var chunks_list = [];
function render() {
	//render
};

socket.on('chunks_received', append_chunks);
function append_chunks(chunk_table) {
	chunk_table.forEach(function(item, index, array) {
		chunks_list.push(item);
	});
};

socket.on('chunk_updated', append_chunk_if_needed);
function append_chunk_if_needed(chunk) {
	if (coords.chunk_inside(
		chunk, 
		coords.pixel_to_chunk(
			coords.Point(0, 0),
			hex_size, corner, chunk_params),
		coords.pixel_to_chunk(
			coords.Point(innerWidth, innerHeight),
			hex_size, corner, chunk_params))
		)
		chunks_list.push(chunk);
};

function createPlayer() {
	
};

var gameBootstrapper = {
	init: function(gameContainerElementId) {
		game.state.add('main', main);
		game.state.start('main');
		var spawn_point = rand_free_space();
		camera = new Phaser.Camera(game, 0, 
			spawn_point.x,
			spawn_point.y,
			innerWidth,
			innerHeight
		);

		focus = spawn_point;
		var shift = coords.Point(innerWidth / 2, innerHeight / 2);
		corner = coords.point_substract(focus, shift);

		socket.emit('new_player', {
			socket.id,
			coords.pixel_to_offset(shift, hex_size, corner) 
		});
		//maybe unfinished camera
	}
};

gameBootstrapper.init("gameDiv");