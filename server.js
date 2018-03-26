const map_gen = require('./client/lib/map_gen').MapGen,
	  coords = require('./client/lib/coords').CoordsEnvironment,
	  buildingFactory = require('./lib/build_gen').buildingFactory,
	  fs = require('fs'),
	  Papa = require('papaparse'),
	  sync = require('synchronize');

const express = require('express'),
	  app = express(),
	  server = require('http').Server(app),
	  io = require('socket.io')(server);

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

const table_names = ['map-table', 'player-table', 'buildings-table', 'link-table'];
var mapData,
	resData,
	buiData,
	linkData;

var parses = [];
table_names.forEach((elem) => parse(elem));

var building_replica;

var countLoads = 0;
const numberOfParses = 4;

var field_list = [],
	player_list = [];

io.sockets.on('connection', (socket) => {
	console.log(`socket ${socket.id} connected`);
	if (countLoads == numberOfParses) {
		if (!building_replica) {
			mapData = parses[table_names[0]];
			resData = parses[table_names[1]];
			buiData = parses[table_names[2]];
			linkData = parses[table_names[3]];
			building_replica = new buildingFactory(buiData);
		}
		var player, field, idOnField;
		socket.on('new_player', (data) => {
			console.log(`new player ${data.id}`);
			var spawn = next_player();
			player = new Player(
				data.id, spawn
				//another params
			);
			spawn.resources = player.getRes();
			player_list.push(player);
			idOnField = (field = field_list[spawn.i]).push_player(player);
			spawn.buiData = buiData;
			socket.emit('gameDataSend', spawn);
		});
		socket.on('build', (data) => {
			console.log('build request: ');
			console.log(data);
			if (!(
				(field.reaches(idOnField, data.build) || player.buildingsCoords.length == 0) && 
				field.empty(data.build) && 
				player.tryChangeRes(building_replica.getBuildCost(data.build.value), data.option)
				)) return;
			data.build.owner = idOnField;
			field.place_building(data.build);
			player.addBuilding(data.build);
		});
		socket.on('upgrade_building', (data) => {
			if(!(
				field.owns(idOnField, data.coords) &&
				player.tryChangeRes(field.getUpgradeCost(data.coords), data.option)
				)) return;
			field.upgrade(data.coords);
		});
		socket.on('remove_building', (coords) => {
			if(!(
				!field.empty(coords) &&
				field.owns(idOnField, coords)
				)) return;
			field.remove_building(coords);
			player.removeBuilding(coords);
		});
		socket.on('disconnect', () => {
			if (player === undefined) return;
			console.log(`player ${socket.id} disconnected`);
			field.remove_player(player);
			player_list.splice(player_list.indexOf(player), 1);
		});
	}
});

server.listen(process.env.PORT || 4000);

function parse(name) {
	fs.readFile(`./res/${name}.csv`, 'utf-8', (err, data) => {
		if (err) {
			console.log(`error while reading file ${name} occured`);
			throw err;
		}
		console.log(`${name} succesfully read`);
		Papa.parse(data, {
			header: true, 
			dynamicTyping: true,
			complete: (result) => {
				if (result.data[0].richness) result.data.forEach((elem) => elem.richness /= 100);
				parses[name] = result.data;
				++countLoads;
				console.log(`${name} succesfully parsed`);
			}
		});
	});
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
	var res = new Resources();
	var buildingsCoords = [];
	this.addBuilding = (coords) => {
		buildingsCoords.push(coords);
	};
	this.removeBuilding = (coords) => {
		var index = 0;
		buildingsCoords.some((elem, i, arr) => {
			if (elem.cx == coords.cx && elem.cy == coords.cy && elem.dx == coords.dx && elem.dy == coords.dy) {
				index = i;
				return true;
			}
		});
		buildingsCoords.splice(index, 1);
	};
	this.clearBuildings = (field) => {
		buildingsCoords.forEach((elem) => {
			field.remove_building(elem);
		});
	};
	this.getId = () => player_id;
	this.getSpawn = () => spawn_point;
	this.getRes = () => {
		var ret = res.toJSON();
		console.log('getRes:');
		console.log(ret);
		return ret;
	};
	this.tryChangeRes = (data, option) => {
		console.log(`trying to ${option === undefined ? "earn" : "pay"}: `);
		console.log(data);
		if (!(option === undefined))
			console.log(`(${option ? "money" : "resources"})`);
		
		if (res.tryChange(data, option)) {
			console.log('transaction succesful');
			io.to(player_id).emit('resources_updated', this.getRes());
			return true;
		} else {
			console.log('transaction failed');
			return false;
		}
	};
};

function Resources() {
	var R = resData[0].start_r, G = resData[0].start_g, B = resData[0].start_b, M = resData[0].start_m;
	this.tryChange = (data, option) => {
		if (option === undefined) {
			R += data.r ? data.r : 0;
			G += data.g ? data.g : 0;
			B += data.b ? data.b : 0;
			M += data.m ? data.m : 0;
			return true;
		}
		if (option) {
			if (M < data.m || data.m == -1) return false;
			M -= data.m;
			return true;
		}
		if (R < data.r || data.r == -1 || 
			G < data.g || data.g == -1 ||
			B < data.b || data.b == -1
			) 
			return false;
		R -= data.r;
		G -= data.g;
		B -= data.b;
		return true;
	};
	this.toJSON = () => {return {r: R, g: G, b: B, m: M};}
	this.sum = () => R + G + B;
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

function precedes(fat, son) {
	return linkData.some((elem) => elem.f == fat && elem.t == son);
};

const MAX_PLAYERS = 7, msPerTick = 250;

function Field(params, index) {
	var filled = false,
		hasPlace = true,
		map = map_gen.buildChunked(params),
		heightMap = map_gen.chunkedDS(params),
		bui = [[]],
		bui_to_send = [[]],
		players = [],
		CE = new coords(42, params.chunkWidth, params.chunkHeight),
		n = map.length, m = map[0].length,
		lastPlayerId = -1;
	for (let ci = 0; ci < n; ++ci) {
		bui[ci] = [];
		for (let cj = 0; cj < m; ++cj) {
			bui[ci][cj] = [];
			map[ci][cj].bui = [];
			for (let i = 0; i < params.chunkWidth && map[ci][cj].res[i]; ++i) {
				bui[ci][cj][i] = [];
				map[ci][cj].bui[i] = [];
				for (let j = 0; j < params.chunkHeight; ++j) {
					if (map[ci][cj].res[i][j]) {
						bui[ci][cj][i][j] = {
							bui: new ResourceSource(map[ci][cj].res[i][j]),
							val: -map[ci][cj].res[i][j],
							own: -1
						};
						map[ci][cj].bui[i][j] = `${-map[ci][cj].res[i][j]}_-1`;
					}
				}
			}
		}
	}
	this.canTake = () => !filled && hasPlace;
	this.getIndex = () => index;
	this.emit_chunk = (x, y) => {
		players.forEach((elem) => io.to(elem.getId()).emit('chunkUpdated', map[x][y]));
	};
	this.push_player = (player) => {
		player.idOnField = ++lastPlayerId;
		players.push(player);
		if (players.length >= MAX_PLAYERS) {
			console.log(`map ${index} filled`);
			filled = true;
		}
		return lastPlayerId;
	};
	this.getPlayer = (id) => players.find((elem) => elem.idOnField == id); 
	this.empty = (coords) => {
		var chunk = map[coords.cx][coords.cy],
			res = !chunk.bui[coords.dx][coords.dy] && chunk.res[coords.dx][coords.dy] == 0;
		console.log(`empty? ${res}`);
		return res;
	};
	this.reaches = (player, coords) => {
		//TODO: will be different
		var res = true;
		console.log(`reaches? ${res}`);
		return res;
	};
	this.place_building = (data) => {
		if (!bui_to_send[data.cx])
			bui_to_send[data.cx] = [];
		if (!bui_to_send[data.cx][data.cy])
			bui_to_send[data.cx][data.cy] = [];
		if (!bui_to_send[data.cx][data.cy][data.dx])
			bui_to_send[data.cx][data.cy][data.dx] = [];

		map[data.cx][data.cy].bui[data.dx][data.dy] = bui_to_send[data.cx][data.cy][data.dx][data.dy] = data.value + "_" + (data.owner % MAX_PLAYERS);
		
		var building = building_replica.makeBuilding(data.value, this.getPlayer(data.owner));
		
		var offset = new CE.Offset(data.cx * params.chunkWidth + data.dx, data.cy * params.chunkHeight + data.dy);
		for (let i = 0; i < 6; ++i) {
			var neigh = offset.getNeighbor(i),
				nech = neigh.toChunk(),
				tdx = neigh.getRow() % params.chunkWidth,
				tdy = neigh.getCol() % params.chunkHeight,
				other = bui[nech.getX()][nech.getY()][tdx][tdy];
			if (other === undefined || (other.own >= 0 && other.own != data.owner)) continue;
			//TODO: add resources to link table
			if (precedes(data.value, other.val)) {
				building.push_output(other.bui);
				other.bui.push_neighbour(building);
			}
			if (precedes(other.val, data.value)) {
				building.push_neighbour(other.bui);
				other.bui.push_output(building);
			}
		}

		bui[data.cx][data.cy][data.dx][data.dy] = {
			bui: building, 
			own: data.owner, 
			val: data.value, 
			clb: setInterval(building.call, building.getTime() * msPerTick)
		};

		console.log(`succesfully built ${data.value} on ${data.cx} ${data.cy} ${data.dx} ${data.dy}`);
		
		this.emit_chunk(data.cx, data.cy);
	};
	this.owns = (player, coords) => bui[coords.cx][coords.cy][coords.dx][coords.dy] && bui[coords.cx][coords.cy][coords.dx][coords.dy].own == player;
	this.getValue = (coords) => bui[coords.cx][coords.cy][coords.dx][coords.dy].val;
	this.getUpgradeCost = (coords) => bui[coords.cx][coords.cy][coords.dx][coords.dy].bui.getUpgradeCost();
	this.upgrade = (coords) => {
		var cell = bui[coords.cx][coords.cy][coords.dx][coords.dy];
		clearInterval(cell.clb);
		cell.bui.upgrade();
		cell.clb = setInterval(cell.bui.call, cell.bui.getTime() * msPerTick);
	};
	this.remove_building = (crd) => {
		var cell = bui[crd.cx][crd.cy][crd.dx][crd.dy];
		
		clearInterval(cell.clb);

		cell.bui.untie();
		
		bui[crd.cx][crd.cy][crd.dx][crd.dy] = undefined;
		map[crd.cx][crd.cy].bui[crd.dx][crd.dy] = bui_to_send[crd.cx][crd.cy][crd.dx][crd.dy] = undefined;
		
		this.emit_chunk(crd.cx, crd.cy);
	};
	this.remove_player = (player) => {
		player.clearBuildings(this);
		players.splice(players.indexOf(player), 1);
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
			mapParams: {
				compressed: params,
				height: params.height,
				resourceMap: map,
				heightMap: heightMap
			},
			buildings: bui_to_send
		};
	};
};

function ResourceSource(type) {
	this.own = -1;
	this.type = -type;
	this.product = {
		r: type == 1 ? resData[0].start_res : 0, 
		g: type == 2 ? resData[0].start_res : 0,
		b: type == 3 ? resData[0].start_res : 0
	};
	var outputs = [];
	this.push_output = (elem) => outputs.push(elem);
	this.remove_output = (elem) => outputs.splice(outputs.indexOf(elem), 1);
	this.clients = () => outputs.length;
};
