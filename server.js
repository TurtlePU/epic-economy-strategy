const build_gen = require('./lib/build_gen'),
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

const table_names = ['map-table', 'player-table', 'buildings-table', 'link-table'];
var mapData, buiData;

var parses = [];
table_names.forEach((elem) => parse(elem));

var countLoads = 0;
const numberOfParses = 4;

var Field, Player;

var field_list = [],
    player_list = [];

io.sockets.on('connection', (socket) => {
	console.log(`socket ${socket.id} connected`);
	if (countLoads == numberOfParses) {
		if (!Field) {
			mapData = parses[table_names[0]];
			buiData = parses[table_names[2]];
			Player = require('./lib/player')(parses[table_names[1]], io);
			Field = require('./lib/field')(
				new build_gen.buildingFactory(parses[table_names[2]]), 
				build_gen.resourceSourceBuilder(parses[table_names[1]]), 
				parses[table_names[3]],
				require('./lib/map_gen'),
				require('./client/lib/coords'),
				io
			);
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
				player.tryChangeRes(field.getBuildCost(data.build.value), data.option)
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
