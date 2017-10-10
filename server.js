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
	player_id
	
) {
	//set new data
	var id = player_id;
};

io.sockets.on('connection', function(socket) {
	socket.on('new_player', function(new_player_data) {
		var new_player = new Player(new_player_data);
		player_list.push(new_player);
	});
	//another events
});

server.listen(3000);