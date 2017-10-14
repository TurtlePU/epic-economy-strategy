const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

var player_list = [];
var Player = function(
	//new player data
	player_id,
	player_spawn
) {
	//set new data
	var id = player_id;
	var spawn = player_spawn;
};

var field = [];
io.sockets.on('connection', function(socket) {
	socket.on('new_player', function(data) {
		var new_player = new Player(data.id, data.spawn);
		player_list.push(new_player);
	});
	socket.on('chunks_requested', function(bounds) {
		var res_list = [];
		for (let i = bounds.topleft.y; 
			i <= bounds.bottomright.y; ++i)
			for (let j = bounds.topleft.x;
				j <= bouns.bottomright.x; ++j)
				res_list.push(field[i + '_' + j]);
		socket.emit('chunks_received', res_list);
	});
	socket.on('chunk_updated_send', function(chunk) {
		field[chunk.i + '_' + chunk.j] = chunk;
		io.emit('chunk_updated', chunk);
	});
	//another events
});

server.listen(3000);