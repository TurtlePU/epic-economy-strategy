const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const map_gen = require('./client/lib/map_gen').MapGen;
const Papa = require('papaparse');
const fs = require('fs');

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

var dataLoaded = false;
var mapData;
fs.readFile('./res/map-table.csv', 'utf-8', function(err, data) {
	if (err) throw err;
	mapData = Papa.parse(data, {
		header: true, 
		dynamicTyping: true,
		complete: function(result) {
			dataLoaded = true;
		}
	}).data;
	mapData.forEach(function(elem, index, array) {
		if (!elem) return;
		elem.richness /= 100;
	});
});

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
	if (dataLoaded) {
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
	}
	//another events
});

function next_player() {
	//will be different
	let result;
	let found = field_list.some(function(item, index, array){
		result = index;
		return !item.filled;
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

var counter = 0;
function next_map() {
	//will be different
	if (counter == mapData.length)
		counter = 0;

	while (!mapData[counter].a) {
		++counter;
		if (counter == mapData.length)
			counter = 0;
	}

	console.log(mapData[counter]);
	return mapData[counter++];
};

server.listen(4000);