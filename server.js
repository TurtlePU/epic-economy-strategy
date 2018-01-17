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

const mapData = parse('map-table'), 
	  resData = parse('player-table'), 
	  buiData = parse('buildings-table'),
	  linkData = parse('link-table');
const building_replica = [];

var countLoads = 0;
const numberOfParses = 3;

var field_list = [],
	player_list = [];

io.sockets.on('connection', (socket) => {
	console.log(`socket ${socket.id} connected`);
	if (countLoads == numberOfParses) {
		if (!building_replica.length) build_replicas();
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
			spawn.table = buiData;
			socket.emit('gameDataSend', spawn);
		});
		socket.on('build', (data) => {
			if (!(
				(field_list[indexOfMap].reaches(indexField, data.build) || player_list[indexPlayer].buildings == 0) && 
				field_list[indexOfMap].empty(data.build) && 
				player_list[indexPlayer].tryChangeRes(getBuildCost(data.build.value), data.option)
				)) return;
			data.build.owner = indexField;
			field_list[indexOfMap].place_building(data.build);
			++player_list[indexPlayer].buildings;
		});
		socket.on('upgrade_building', (data) => {
			if(!(
				field_list[indexOfMap].owns(indexField, data.coords) &&
				player_list[indexPlayer].tryChangeRes(field_list[indexOfMap].getUpgradeCost(data.coords), data.option)
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
				++countLoads;
				console.log(`${name} succesfully parsed`);
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
		if (ans) {
			io.to(player_id).emit('resources_updated', res.toJSON());
			//TODO: substract from storages
		}
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
	this.toJSON = () => {return {r: R, g: G, b: B, m: M};}
	this.sum = () => R + G + B;
}
function Resources(maxCapacity) {
	var R = 0, G = 0, B = 0;
	this.tryChange = (delta) => {
		let dr = Math.min(delta.r, maxCapacity - R - G - B);
		R += dr;
		let dg = Math.min(delta.g, maxCapacity - R - G - B);
		G += dg;
		let db = Math.min(delta.b, maxCapacity - R - G - B);
		B += db;
		return {r: dr, g: dg, b: db};
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
	for (let ci = 0; map[ci] !== undefined; ++ci) {
		for (let cj = 0; map[ci][cj] !== undefined; ++cj) {
			for (let i = 0; i < params.chunkWidth; ++i) {
				for (let j = 0; j < params.chunkHeight; ++j) {
					//TODO: fill bui with resources
				}
			}
		}
	}
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
	this.getPlayer = (index) => players[index]; 
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
		
		var building = makeBuilding(data.value, data.owner, index);
		
		var offset = new CE.Offset(data.cx * params.chunkWidth + data.dx, data.cy * params.chunkHeight + data.dy);
		for (let i = 0; i < 6; ++i) {
			var neigh = offset.getNeighbour(i),
				nech = neigh.toChunk(),
				tdx = neigh.getRow() % params.chunkWidth,
				tdy = neigh.getCol() % params.chunkHeight,
				other = bui[nech.getX()][nech.getY()][tdx][tdy];
			if (other === undefined || (other.own >= 0 && other.own != data.owner)) continue;
			//TODO: add resources to link table
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
		
		this.emit_chunk(data.cx, data.cy);
	});
	this.owns = (player, coords) => bui[coords.cx][coords.cy][coords.dx][coords.dy] && bui[coords.cx][coords.cy][coords.dx][coords.dy].own == player;
	this.getValue = (coords) => bui[coords.cx][coords.cy][coords.dx][coords.dy].val;
	this.getUpgradeCost = (coords) => bui[coords.cx][coords.cy][coords.dx][coords.dy].bui.getUpgradeCost();
	this.upgrade = (coords) => {
		var cell = bui[coords.cx][coords.cy][coords.dx][coords.dy];
		removeInterval(cell.clb);
		cell.bui.upgrade();
		cell.clb = setInterval(cell.bui.call, cell.bui.getTime() * msPerTick);
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
		
		this.emit_chunk(crd.cx, crd.cy);
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

	res.create = (map, owner) => {
		var time = info.time, cap = info.cap,
			my_cost = upgrade_cost(cost);
		this.type = type;
		this.inp = info.in;
		this.out = info.out;
		this.neighbours = [];
		this.outputs = [];
		this.product = new Resources(cap);
		if (info.func.includes("store")) {
			this.call = () => {
				let dr = 0, dg = 0, db = 0, tves = this.product;
				this.neighbours.every((elem) => {
					if (tves.sum() == cap)
						return false;
					let d = tves.tryChange(elem.product);
					dr += d.r;
					dg += d.g;
					db += d.b;
					elem.product.r -= d.r;
					elem.product.g -= d.g;
					elem.product.b -= d.b;
					return true;
				});
				player_list[field_list[map].getPlayer(owner)].tryChangeRes({r: dr, g: dg, b: db});
			};
		} else if (info.func.includes("sell")) {
			this.call = () => {
				let mass = 0, max_mass = this.inp;
				this.neighbours.every((elem) => {
					if (mass == max_mass) return false;
					let d = 0;
					d += Math.min(max_mass - mass - d, Math.floor(elem.product.r / elem.outputs.length));
					d += Math.min(max_mass - mass - d, Math.floor(elem.product.g / elem.outputs.length));
					d += Math.min(max_mass - mass - d, Math.floor(elem.product.b / elem.outputs.length));
					mass += d;
					return true;
				});
				player_list[field_list[map].getPlayer(owner)].tryChangeRes({m: Math.floor(mass / max_mass * this.out)});
			};
		} else {
			this.call = () => {
				let mass = {r: 0, g: 0, b: 0, sum: () => r + g + b}, max_mass = this.inp;
				neighbours.every((elem) => {
					if (mass.sum() == max_mass) return false;
					if (info.func.includes("_r") || info.func.includes("_u")) {
						let dr = Math.min(max_mass - mass.sum(), Math.floor(elem.product.r / elem.outputs.length));
						elem.product.r -= dr;
						mass.r += dr;
					}
					if (info.func.includes("_g") || info.func.includes("_u")) {
						let dg = Math.min(max_mass - mass.sum(), Math.floor(elem.product.g / elem.outputs.length));
						elem.product.g -= dg;
						mass.g += dg;
					}
					if (info.func.includes("_b") || info.func.includes("_u")) {
						let db = Math.min(max_mass - mass.sum(), Math.floor(elem.product.b / elem.outputs.length));
						elem.product.b -= db;
						mass.b += db;
					}
					return true;
				});
				this.product.r += Math.floor(mass.r / this.inp * this.out);
				this.product.g += Math.floor(mass.g / this.inp * this.out);
				this.product.b += Math.floor(mass.b / this.inp * this.out);
			};
		}
		this.upgrade = () => {
			this.inp = in_u(this.inp);
			this.out = out_u(this.out);
			time = time_u(time);
			cap = cap_u(cap);
			my_cost = upgrade_cost(my_cost);
		};
		this.getUpgradeCost = () => my_cost;
		this.getTime = () => time;
		this.getCapacity = () => cap;
	};

	function upgrade_cost(cost) {
		return {
			r: cost_u(cost.r),
			g: cost_u(cost.g),
			b: cost_u(cost.b),
			m: cost_u(cost.m)
		};
	};

	return res;
};

function buildFunc(comm) {
	var seq = comm.split(" ");
	if (seq[0] == "add") return add(seq[1]);
	if (seg[0] == "multiply") return mul(seq[1]);
};
var add = (num) => (x) => {return x == -1 ? -1 : (x + Number(num));},
	mul = (num) => (x) => {return x == -1 ? -1 : (x * Number(num));};

function makeBuilding(id, owner, map) {
	return new building_replica[id - 1].create(map, owner);
};
function getBuildCost(id) {
	return building_replica[id - 1].getCost();
};