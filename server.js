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
	var id = player_id;
	var spawn = spawn_point;
};

var field_list = [];
io.sockets.on('connection', function(socket) {
	console.log("socket connected");
	socket.on('new_player', function(data) {
		console.log("new player");
		var spawn = next_player();
		var new_player = new Player(
			data.id, spawn//another params
		);
		player_list.push(new_player);
		socket.emit('player_send', spawn);
	});
	socket.on('chunks_requested', function(bounds, index) {
		console.log("chunks requested");
		var res_list = [];
		for (let i = bounds.left; i <= bounds.right; ++i) {
			for (let j = bounds.top; j <= bounds.bottom; ++j) {
				if (field_list[index].map[i + '_' + j] != undefined) {
					res_list.push(field_list[index].map[i + '_' + j]);
				}
			}
		}
		socket.emit('chunks_received', res_list);
	});
	socket.on('chunk_updated_send', function(chunk, index) {
		console.log("chunk updated send");
		field_list[index].map[chunk.i + '_' + chunk.j] = chunk;
		io.emit('chunk_updated', chunk);
	});
	
	//another events
});

function compress(map, length) {
	var chunks = [];
	let w = 3, h = 3;
	let arr_w = Math.ceil(length / w), arr_h = Math.ceil(length / h)
	for (let i = 0; i < arr_w; ++i)
		for (let j = 0; j < arr_h; ++j)
			chunks[i + '_' + j] = {
				x: i, y: j,
				res: [[]],
				//smth with buildings
			};

	with(Math) {
		for (let i = 0; i < length; ++i) {
			let chunk_i = floor(i / w);
			let dep_i = i - chunk_i * w;
			for (let j = 0; j < length; ++j) {
				let chunk_j = floor(j / h);
				let dep_j = j - chunk_j * h;
				if (chunks[chunk_i + '_' + chunk_j].res[dep_i] == undefined) {
					chunks[chunk_i + '_' + chunk_j].res[dep_i] = [];
				}
				chunks[chunk_i + '_' + chunk_j].res[dep_i][dep_j] = map[i + '_' + j];
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
		field_list.push({
			filled: false,
			map: [],
			get_next: function() {return {row: 16, col: 16, i: i};}
		});
		var params = next_map();
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
		log_size: 10,
		height: 100,
		prob_a: 15, 
		prob_b: 5,
		prob_c: 869,
		prob_mod: 100,
		prob_seed: 80
	};
};

server.listen(4000);