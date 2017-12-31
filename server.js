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
	if (err) {
		console.log("error while reading file occured");
		throw err;
	}
	console.log("map data succesfully read");
	mapData = Papa.parse(data, {
		header: true, 
		dynamicTyping: true,
		complete: (result) => {
			result.data.forEach((elem) => elem.richness /= 100);
			dataLoaded = true;
			console.log("map data succesfully parsed");
		}
	}).data;
});

//player_id stores socket.ids
var player_list = [];
function Player(player_id, spawn_point) {
	this.getId = () => player_id;
	this.getSpawn = () => spawn_point;
};

//field.players stores indexes in player_list
var field_list = [];

io.sockets.on('connection', (socket) => {
	console.log(`socket ${socket.id} connected`);
	if (dataLoaded) {
		var indexPlayer, indexField, indexOfMap;
		socket.on('new_player', (data) => {
			console.log(`new player ${data.id}`);
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
			console.log(`chunk updated on map ${indexOfMap}: ${chunk}`);
			field_list[indexOfMap].emit_chunk(chunk);
		});
		socket.on('disconnect', () => {
			if (indexPlayer === undefined) return;
			console.log(`player ${socket.id} (map ${indexOfMap}, position ${indexField}) disconnected`);
			field_list[indexOfMap].remove_player(indexField);
			player_list.splice(indexPlayer, 1);
		});
	}
});

const MAX_PLAYERS = 2;

function Field(params, index) {
	var filled = false,
		hasPlace = true,
		map = map_gen.buildChunked(params),
		bui = [[]],
		players = [];
	this.canTake = () => !filled && hasPlace;
	this.getIndex = () => index;
	this.emit_chunk = (chunk) => {
		map[chunk.x][chunk.y] = chunk;
		bui[chunk.x][chunk.y] = chunk.bui;
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
		//will be different
		return { 
			homeCell: { 
				row: 16, 
				col: 16 
			}, 
			i: index, 
			mapParams: params,
			buildings: bui
		};
	};
};

function next_player() {
	var result = field_list.find((elem) => elem.canTake());
	console.log(`it will be on map ${result === undefined ? result : result.getIndex()}`);
	if (!result) {
		console.log('new map');
		field_list.push(result = new Field(next_map(), field_list.length));
	}
	return result.get_next();
};

var counter = 0;
function next_map() {
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