const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

var player_list = [];
var Player = function(
	player_id,
	spawn_point
) {
	var id = player_id;
	var spawn = spawn_point;
};

var field = [];
io.sockets.on('connection', function(socket) {
	console.log("socket connected");
	socket.on('new_player', function(data) {
		console.log("new player");
		var start_new_map = !prepare_spawn();
		var spawn = next_player();
		var new_player = new Player(
			data.id, spawn//another params
		);
		player_list.push(new_player);
		socket.emit('spawn_send', spawn);
		socket.emit('map_send', next_map(start_new_map));
	});
	socket.on('chunks_requested', function(bounds) {
		console.log("chunks requested");
		var res_list = [];
		for (let i = bounds.topleft.x; 
			i <= bounds.bottomright.x; ++i)
			for (let j = bounds.topleft.y;
				j <= bouns.bottomright.y; ++j)
				res_list.push(field[i + '_' + j]);
		socket.emit('chunks_received', res_list);
	});
	socket.on('chunk_updated_send', function(chunk) {
		console.log("chunk updated send");
		field[chunk.i + '_' + chunk.j] = chunk;
		io.emit('chunk_updated', chunk);
	});
	
	//another events
});

function prepare_spawn() {
	return true;
}

function next_player() {
	//will be different
	return {x: 0, y: 0};
}

function next_map(new_map) {
	//will be different
	return {
		a: 120,
		b: 15,
		c: 16,
		mod: 228,
		seed: 0,
		log_size: 6,
		height: 100,
		prob_a: 15, 
		prob_b: 5,
		prob_c: -5,
		prob_mod: 100,
		prob_seed: 80
	};
};

server.listen(4000);