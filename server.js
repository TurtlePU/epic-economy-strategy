const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const map_gen = require('./lib/map_gen');

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

var player_list = [];
var Player = function(
	player_id,
	spawn_point
) {
	this.getId = function() {return player_id;};
	this.getSpawn = function() {return spawn_point;};
};

var field_list = [];
io.sockets.on('connection', function(socket) {
	console.log("socket connected");
	socket.on('new_player', function(data) {
		console.log("new player");
		var spawn = next_player();
		field_list[spawn.i].push_player(data.id);
		var new_player = new Player(
			data.id, spawn
			//another params
		);
		player_list.push(new_player);
		socket.emit('gameDataSend', spawn);
	});
	socket.on('chunkSend', function(chunk) {
		console.log("chunk updated send");
		var mapID = player_list[player_list.find(function(elem, index, arr) {return elem.getId() == socket.id})].spawn.mapID;
		field_list[mapID].map[chunk.i][chunk.j] = chunk;
		field_list[mapID].players.forEach(function(elem, index, arr) {
			io.to(elem.getId()).emit('chunkUpdated', chunk);
		});
	});
	
	//another events
});

function compress(map, length) {
	var chunks = [];
	let w = 3, h = 3;
	let arr_w = Math.ceil(length / w), arr_h = Math.ceil(length / h)
	for (let i = 0; i < arr_w; ++i) {
		chunks[i] = [];
		for (let j = 0; j < arr_h; ++j)
			chunks[i][j] = {
				x: i, y: j,
				res: [[]],
				bui: [[]]
			};
	}

	with(Math) {
		for (let i = 0; i < length; ++i) {
			let chunk_i = floor(i / w);
			let dep_i = i - chunk_i * w;
			for (let j = 0; j < length; ++j) {
				let chunk_j = floor(j / h);
				let dep_j = j - chunk_j * h;
				if (chunks[chunk_i][chunk_j].res[dep_i] == undefined) {
					chunks[chunk_i][chunk_j].res[dep_i] = [];
				}
				chunks[chunk_i][chunk_j].res[dep_i][dep_j] = map[i][j];
			}
		}
	}
	return chunks;
}

function next_player() {
	//will be different
	let result;
	let found = field_list.some(function(item, index, array){
		result = index;
		return item.filled;
	});
	if (!found) {
		console.log('new map');
		let i = field_list.length;
		var params = next_map();
		field_list.push({
			filled: false,
			map: [],
			players: [],
			push_player: function(index) { 
				players.push(index); 
			},
			get_next: function() {
				return { 
					homeCell: { 
						row: 16, 
						col: 16 
					}, 
					i: i, 
					mapParams: params 
				}; 
			}
		});
		field_list[i].map = compress(map_gen.distributed_resource_map(params), (1 << params.log_size) + 1);
		result = i;
	}
	return field_list[result].get_next();
}

function next_map() {
	//will be different
	return {
		a: 120,
		b: 15,
		c: 16,
		mod: 228,
		seed: 0,
		logSize: 10,
		height: 100,
		prob_a: 15, 
		prob_b: 5,
		prob_c: 869,
		prob_mod: 100,
		prob_seed: 80,
		chunkWidth: 3,
		chunkHeight: 3
	};
};

server.listen(4000);