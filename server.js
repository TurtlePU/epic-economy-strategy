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

const mapData = parse('map-table'), 
	  resData = parse('player-table'), 
	  buiData = parse('buildings-table');

var countLoads = 0;
const numberOfParses = 3;

var field_list = [],
	player_list = [];

io.sockets.on('connection', (socket) => {
	console.log(`socket ${socket.id} connected`);
	if (countLoads == numberOfParses) {
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
		socket.on('build', (data) => {
			if (!(
				field_list[indexOfMap].reaches(indexField, data.build) && 
				field_list[indexOfMap].empty(data.build) && 
				player_list[indexPlayer].tryChangeRes(getBuildCost(data.value))
				)) return;
			data.build.owner = indexField;
			field_list[indexOfMap].place_building(data.build);
		});
		socket.on('upgrade_building', (coords) => {
			if(!(
				field_list[indexOfMap].owns(indexField, coords) &&
				player_list[indexPlayer].tryChangeRes(getUpgradeCost(field_list[indexOfMap].getValue(coords)))
				)) return;
			field_list[indexOfMap].upgrade(data.coords);
		});
		socket.on('remove_building', (coords) => {
			if(!(
				!field_list[indexOfMap].empty(coords) &&
				field_list[indexOfMap].owns(indexField, coords)
				)) return;
			field_list[indexOfMap].remove_building(coords);
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

server.listen(process.env.PORT || 4000);

function parse(name) {
	var resData;
	fs.readFile(`./res/${name}.csv`, 'utf-8', (err, data) => {
		if (err) {
			console.log(`error while reading file ${name} occured`);
			throw err;
		}
		console.log("map data succesfully read");
		resData = Papa.parse(data, {
			header: true, 
			dynamicTyping: true,
			complete: (result) => {
				result.data.forEach((elem) => elem.richness /= 100);
				++countLoads;
				console.log("map data succesfully parsed");
			}
		}).data;
	});
	return resData;
}

function next_player() {
	var result = field_list.find((elem) => elem.canTake());
	console.log(`it will be on map ${result === undefined ? result : result.getIndex()}`);
	if (!result) {
		console.log('new map');
		field_list.push(result = new Field(next_map(), field_list.length));
	}
	return result.get_next();
};

//player_id stores socket.ids
function Player(player_id, spawn_point) {
	this.getId = () => player_id;
	this.getSpawn = () => spawn_point;
	var res = new Resources();
	this.tryChangeRes = sync((data) => res.tryChange(data));
};

function Resources() {
	var R = resData[0].start_r, G = resData[0].start_g, B = resData[0].start_b, M = resData[0].start_m;
	this.tryChange = (data) => {
		if (R < -data.r || G < -data.g || B < -data.b || M < -data.m) return false;
		R += data.r;
		G += data.g;
		B += data.b;
		M += data.m;
		return true;
	};
}

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

const MAX_PLAYERS = 2;
function Field(params, index) {
	var filled = false,
		hasPlace = true,
		map = map_gen.buildChunked(params),
		bui = [[]],
		players = [];
	this.canTake = () => !filled && hasPlace;
	this.getIndex = () => index;
	this.emit_chunk = (x, y) => {
		players.forEach((elem) => io.to(player_list[elem].getId()).emit('chunkUpdated', map[x][y]));
	};
	this.push_player = (pl_id) => {
		players.push(pl_id);
		if (players.length >= MAX_PLAYERS) {
			console.log(`map ${index} filled`);
			filled = true;
		}
		return players.length - 1;
	}; 
	this.empty = (coords) => {
		var chunk = map[coords.cx][coords.cy];
		return chunk.bui[coords.dx][coords.dy] == 0 && chunk.res[coords.dx][coords.dy] == 0;
	};
	this.reaches = (player, coords) => {
		//TODO: will be different
		return true;
	};
	this.place_building = (data) => {
		map[data.cx][data.cy].bui[data.dx][data.dy] = data.value + "_" + data.owner;
		var building = makeBuilding(data.value, data.owner);
		bui[data.cx][data.cy][data.dx][data.dy] = {bui: building, own: data.owner, val: data.value, clb: setInterval(building.call, tick)};
		emit_chunk(data.cx, data.cy);
	};
	this.owns = (player, coords) => bui[coords.cx][coords.cy][coords.dx][coords.dy].own == player;
	this.getValue = (coords) => bui[coords.cx][coords.cy][coords.dx][coords.dy].val;
	this.upgrade = (coords) => bui[coords.cx][coords.cy][coords.dx][coords.dy].bui.upgrade();
	this.remove_building = (crd) => {
		removeInterval(bui[crd.cx][crd.cy][crd.dx][crd.dy].clb);
		bui[crd.cx][crd.cy][crd.dx][crd.dy] = undefined;
		map[crd.cx][crd.cy].bui[crd.dx][crd.dy] = 0;
		emit_chunk(crd.cx, crd.cy);
	};
	this.remove_player = (pl_index) => {
		players.splice(pl_index, 1);
		if (players.length < MAX_PLAYERS) {
			console.log(`map ${index} can take in more players`);
			filled = false;
		}
	};
	this.get_next = () => {
		//TODO: will be different
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

//TODO: finish this
function makeBuilding(code, owner) {

};
function getBuildCost(id) {

};
function getUpgradeCost(id) {

};