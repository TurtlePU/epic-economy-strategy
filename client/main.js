const socket = io.connect();

const game = new Phaser.Game(innerWidth, innerHeight,
	Phaser.AUTO, 'gameDiv');

var gameProperties = {
	game_width: 4000,
	game_height: 4000,
	game_element: 'gameDiv',
	in_game: false
};

var main = function(game){};
main.prototype = {
	preload: function() {
		game.scale.scaleMode = Phaser.ScaleManager.RESIZE;
		game.world.setBounds(0, 0, 
			gameProperties.game_Width, gameProperties.game_Height, 
			false, false, false, false);
		game.physics.startSystem(Phaser.Physics.P2JS);
		game.physics.p2.setBoundsToWorld(false, false, false, false, false);
		game.physics.p2.gravity.y = 0;
		game.physics.p2.applyGravity = false;
	},
	
	create: function() {
		game.stage.backgroundColor = 0x000000;
		socket.on('connect', function() {
			createPlayer();
			gamePropeties.in_game = true;
			socket.emit('new_player', {
				//data of new player
				id: socket.id
			});
		});
	},
	
	update: function() {
		if (gameProperties.in_game) {
			//handling commands
		}
	}
};

function createPlayer() {
	
};

var gameBootstrapper = {
	init: function(gameContainerElementId) {
		game.state.add('main', main);
		game.state.start('main');
	}
};

gameBootstrapper.init("gameDiv");
