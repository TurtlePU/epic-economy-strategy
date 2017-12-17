const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const map_gen = require('./client/lib/map_gen').MapGen;

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
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
				this.players.push(index); 
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
		field_list[i].map = map_gen.buildChunked(params);
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
		height: 1,
		prob_a: 69069, 
		prob_b: 0,
		prob_c: 15,
		prob_mod: 1 << 30,
		prob_seed: 179,
		richness: 0.67,
		chunkWidth: 3,
		chunkHeight: 3
	};
};

server.listen(4000);