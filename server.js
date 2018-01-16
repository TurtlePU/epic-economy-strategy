const map_gen = require('./client/lib/map_gen').MapGen,
	  coords = require('./client/lib/coords').CoordsEnvironment,
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
//TODO: make link table
const mapData = parse('map-table'), 
	  resData = parse('player-table'), 
	  buiData = parse('buildings-table'),
	  linkData = parse('link-table');

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
				(field_list[indexOfMap].reaches(indexField, data.build) || player_list[indexPlayer].buildings == 0) && 
				field_list[indexOfMap].empty(data.build) && 
				player_list[indexPlayer].tryChangeRes(getBuildCost(data.value), data.option)
				)) return;
			data.build.owner = indexField;
			field_list[indexOfMap].place_building(data.build);
			++player_list[indexPlayer].buildings;
		});
		socket.on('upgrade_building', (coords) => {
			if(!(
				field_list[indexOfMap].owns(indexField, coords) &&
				player_list[indexPlayer].tryChangeRes(field_list[indexOfMap].getUpgradeCost(coords), option)
				)) return;
			field_list[indexOfMap].upgrade(data.coords);
		});
		socket.on('remove_building', (coords) => {
			if(!(
				!field_list[indexOfMap].empty(coords) &&
				field_list[indexOfMap].owns(indexField, coords)
				)) return;
			field_list[indexOfMap].remove_building(coords);
			--player_list[indexPlayer].buildings;
		});
		socket.on('chunk_send', (chunk) => {
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
		console.log(`${name} succesfully read`);
		resData = Papa.parse(data, {
			header: true, 
			dynamicTyping: true,
			complete: (result) => {
				if (result.data[0].richness) result.data.forEach((elem) => elem.richness /= 100);
				if (result.data[0].func) build_replicas();
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
	this.tryChangeRes = (data, option) => {
		var ans = res.tryChange(data, option);
		if (ans) io.to(player_id).emit('resources_updated', res.toJSON());
		return ans;
	};
	this.buildings = 0;
	var capacity = res.sum();
	this.changeCapacity = (delta) => capacity += delta;
};

function Resources() {
	var R = resData[0].start_r, G = resData[0].start_g, B = resData[0].start_b, M = resData[0].start_m;
	this.tryChange = (data, option) => {
		if (option === undefined) {
			R += data.r;
			G += data.g;
			B += data.b;
			M += data.m;
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
	this.toJSON = () => {r: R, g: G, b: B, m: M};
	this.sum = () => R + G + B;
}
function Resources(maxCapacity) {
	var R = 0, G = 0, B = 0;
	this.tryChange = (amount, type) => {
		let d = Math.min(amount, maxCapacity - R - G - B);
		if (type == 0) R += d;
		if (type == 1) G += d;
		if (type == 2) B += d;
		return d;
	}
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

const MAX_PLAYERS = 2, msPerTick = 1000;
function Field(params, index) {
	var filled = false,
		hasPlace = true,
		map = map_gen.buildChunked(params),
		bui = [[]],
		bui_to_send = [[]],
		players = [],
		CE = new coords(42, params.chunkWidth, params.chunkHeight);
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
	this.place_building = sync((data) => {
		map[data.cx][data.cy].bui[data.dx][data.dy] = bui_to_send[data.cx][data.cy][data.dx][data.dy] = data.value + "_" + data.owner;
		
		var building = makeBuilding(data.value, data.owner);
		if (building.getCapacity() != 0) {
			building.vessel = new Resources(0, 0, 0, 0, building.getCapacity());
			building.call = () => {
				let dr = 0, dg = 0, db = 0;
				neighbours.forEach((elem) => {
					//TODO: make map type of building ->> type of resource
					let type = resType[elem.type], d = 0;
					d = vessel.tryChange(elem.product, type);
					if (type == 0) dr += d;
					if (type == 1) dg += d;
					if (type == 2) db += d;
					elem.product -= d;
				});
				player_list[players[data.owner]].tryChangeRes({r: dr, g: dg, b: db});
			};
		}
		//TODO: same about sellers

		var offset = new CE.Offset(data.cx * params.chunkWidth + data.dx, data.cy * params.chunkHeight + data.dy);
		for (let i = 0; i < 6; ++i) {
			var neigh = offset.getNeighbour(i),
				nech = neigh.toChunk(),
				tdx = neigh.getRow() % params.chunkWidth,
				tdy = neigh.getCol() % params.chunkHeight,
				other = bui[nech.getX()][nech.getY()][tdx][tdy];
			if (other === undefined) continue;
			if (precedes(data.value, other.val)) {
				building.outputs.push(other.bui);
				other.bui.neighbours.push(building);
			}
			if (precedes(other.val, data.value)) {
				building.neighbours.push(other.bui);
				other.bui.outputs.push(building);
			}
		}

		bui[data.cx][data.cy][data.dx][data.dy] = {
			bui: building, 
			own: data.owner, 
			val: data.value, 
			clb: setInterval(building.call, building.getTime() * msPerTick)
		};
		
		emit_chunk(data.cx, data.cy);
	});
	this.owns = (player, coords) => bui[coords.cx][coords.cy][coords.dx][coords.dy].own == player;
	this.getValue = (coords) => bui[coords.cx][coords.cy][coords.dx][coords.dy].val;
	this.getUpgradeCost = (coords) => bui[coords.cx][coords.cy][coords.dx][coords.dy].bui.getUpgradeCost();
	this.upgrade = (coords) => {
		var cell = bui[coords.cx][coords.cy][coords.dx][coords.dy];
		removeInterval(cell.clb);
		cell.bui.upgrade();
		cell.clb = setInterval(building.call, building.getTime() * msPerTick);
	};
	this.remove_building = (crd) => {
		var cell = bui[crd.cx][crd.cy][crd.dx][crd.dy];
		
		removeInterval(cell.clb);
		
		cell.bui.neighbours.forEach((elem) => {
			elem.outputs = elem.outputs.splice(elem.outputs.findIndex(cell.bui), 1);
		});
		cell.bui.outputs.forEach((elem) => {
			elem.neighbours = elem.neighbours.splice(elem.neighbours.findIndex(cell.bui), 1);
		});
		
		bui[crd.cx][crd.cy][crd.dx][crd.dy] = undefined;
		map[crd.cx][crd.cy].bui[crd.dx][crd.dy] = bui_to_send[crd.cx][crd.cy][crd.dx][crd.dy] = 0;
		
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
			buildings: bui_to_send
		};
	};
};

const building_replica = [];
function build_replicas() {
	let s = buiData.length;
	for (let i = 0; i < s; ++i)
		building_replica.push(build_replica(buiData[i], i));
};
function build_replica(info, type) {
	var res = {},
		cost = {
			r: info.cost_r,
			g: info.cost_g,
			b: info.cost_b,
			m: info.cost_m
		};
	res.getCost = () => cost;

	var in_u = getFunc(info.in_u),
		time_u = getFunc(info.time_u),
		cap_u = getFunc(info.cap_u),
		out_u = getFunc(info.out_u),
		cost_u = getFunc(info.cost_u);

	res.create = (owner) => {
		var time = info.time, cap = info.cap,
			my_cost = upgrade_cost(cost);
		this.type = type;
		this.inp = info.in;
		this.out = info.out;
		this.neighbours = [];
		this.outputs = [];
		this.product = 0;
		this.call = () => {
			let mass = 0, max_mass = this.inp;
			neighbours.every((elem) => {
				if (mass == max_mass) return false;
				let d = Math.min(max_mass - mass, Math.floor(elem.product / elem.outputs.length));
				elem.product -= d;
				mass += d;
				return true;
			});
			this.product += Math.floor(mass / this.inp * this.out);
		};
		this.upgrade = () => {
			this.inp = in_u(this.inp);
			this.out = out_u(this.out);
			time = time_u(time);
			cap = cap_u(cap);
			my_cost = upgrade_cost(my_cost);
		}
		this.getUpgradeCost = () => my_cost;
		this.getTime = () => time;
		this.getCapacity = () => cap;
	};

	return res;
};
function upgrade_cost(cost) {
	return {
		r: cost_u(cost.r),
		g: cost_u(cost.g),
		b: cost_u(cost.b),
		m: cost_u(cost.m)
	};
};
function buildFunc(comm) {
	var seq = comm.split(" ");
	if (seq[0] == "add") return add(seq[1]);
	if (seg[0] == "multiply") return mul(seq[1]);
};
var add = (num) => (x) => {return x == -1 ? -1 : (x + Number(num));},
	mul = (num) => (x) => {return x == -1 ? -1 : (x * Number(num));};

function makeBuilding(id, owner) {
	return new building_replica[id - 1].create(owner);
};
function getBuildCost(id) {
	return building_replica[id - 1].getCost();
};