const map_gen = require('./client/lib/map_gen').MapGen,
	  fs = require('fs'),
	  Papa = require('papaparse');

const express = require('express'),
	  app = express(),
	  server = require('http').Server(app),
	  io = require('socket.io')(server);

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

var dataLoaded = false;
var mapData;
fs.readFile('./res/map-table.csv', 'utf-8', (err, data) => {
	if (err) throw err;
	mapData = Papa.parse(data, {
		header: true, 
		dynamicTyping: true,
		complete: (result) => {
			result.data.forEach((elem) => elem.richness /= 100);
			dataLoaded = true;
		}
	}).data;
});

//player_id stores socket.ids
var player_list = [];
var Player = function(
	player_id,
	spawn_point
) {
	this.getId = function() {return player_id;};
	this.getSpawn = function() {return spawn_point;};
};

//field.players stores indexes in player_list
var field_list = [];

io.sockets.on('connection', (socket) => {
	console.log("socket connected");
	if (dataLoaded) {
		var indexPlayer, indexField, indexOfMap;
		socket.on('new_player', (data) => {
			console.log("new player " + data.id);
			var spawn = next_player();
			var new_player = new Player(
				data.id, spawn
				//another params
			);
			player_list.push(new_player);
			indexField = field_list[indexOfMap = spawn.i].push_player(indexPlayer = player_list.length - 1);
			socket.emit('gameDataSend', spawn);
		});
		socket.on('chunkSend', (chunk) => {
			console.log(`chunk ${chunk} updated, sent by ${socket.id}`);
			field_list[indexOfMap].emit_chunk(chunk);
		});
		socket.on('disconnect', () => {
			console.log(`player ${socket.id} disconnected`);
			field_list[indexOfMap].remove_player(indexField);
			player_list.splice(indexPlayer, 1);
		});
	}
	//another events
});

const MAX_PLAYERS = 2;

function Field(params, index) {
	var filled = false,
		map = map_gen.buildChunked(params),
		players = [];
	this.getFilled = () => filled;
	this.emit_chunk = (chunk) => {
		map[chunk.x][chunk.y] = chunk;
		players.forEach((elem) => io.to(player_list[elem].getId()).emit('chunkUpdated', chunk));
	};
	this.push_player = (pl_id) => {
		players.push(pl_id);
		if (players.length >= MAX_PLAYERS) {
			console.log(`map ${index} filled`);
			filled = true;
		}
		return players.length - 1;
	}; 
	this.remove_player = (pl_index) => {
		players.splice(pl_index, 1);
		if (players.length < MAX_PLAYERS) {
			console.log(`map ${index} can take in more players`);
			filled = false;
		}
	};
	this.get_next = () => {
		return { 
			homeCell: { 
				row: 16, 
				col: 16 
			}, 
			i: index, 
			mapParams: params 
		};
	};
};

function next_player() {
	var result = field_list.find((elem) => !elem.getFilled());
	console.log(`it will be on map ${JSON.stringify(result)}`);
	if (!result) {
		console.log('new map');
		field_list.push(result = new Field(next_map(), field_list.length));
	}
	return result.get_next();
};

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