function EventsEnvironment(window, socket, PIXI, Papa) {
	const EE = this,
	      GE = new GameEnvironment(PIXI, Papa, EE);
	
	this.start = () => { GE.start(); };

	socket.on('connect', function() {
		console.log("connect");
	});

	this.emitPlayer = () => {
		socket.emit('new_player', {
			id: socket.id,
			//maybe smth else
		});
	};

	socket.on('gameDataSend', function(gameData) {
		console.log("game data send");
		GE.build(gameData);
		//addResizeListener();
		addKeyboardMovement();
		GE.addMouseListener();
	});

	this.emitBuild = (data) => { socket.emit('build', data); };
	this.emitUpgradeBuilding = (data) => { socket.emit('upgrade_building', data); };
	this.emitRemoveBuilding = (data) => { socket.emit('remove_building', data); };

	socket.on('chunkUpdated', GE.updateChunk);
	socket.on('resources_updated', GE.updateResources);

	function keyboard(keyCode) {
		var key = {
			code: keyCode,
			isDown: false,
			isUp: true,
			press: function() {},
			release: function() {},
			downHandler: function(event) {
				if (event.keyCode === key.code) {
					if (key.isUp && key.press) {
						key.press();
					}
					key.isDown = true;
					key.isUp = false;
				}
				//event.preventDefault();
			},
			upHandler: function(event) {
				if (event.keyCode === key.code) {
					if (key.isDown && key.release) {
						key.release();
					}
					key.isDown = false;
					key.isUp = true;
				}
				//event.preventDefault();
			}
		};

		window.addEventListener("keydown", key.downHandler.bind(key), false);
		window.addEventListener("keyup", key.upHandler.bind(key), false);

		return key;
	}

	function addResizeListener() {
		window.addEventListener("resize", GE.resize(window), false);
	}

	const keyLeft = keyboard(65), 
	      keyRight = keyboard(68), 
	      keyUp = keyboard(87), 
	      keyDown = keyboard(83),
	      keyTrain = keyboard(84);

	function addKeyboardMovement() {
		var step = 1;
		keyLeft.press = keyRight.release = GE.moveScreenByPoint(-step, 0);
		keyRight.press = keyLeft.release = GE.moveScreenByPoint(step, 0);
		keyUp.press = keyDown.release = GE.moveScreenByPoint(0, -step);
		keyDown.press = keyUp.release = GE.moveScreenByPoint(0, step);
		keyTrain.press = GE.showTrainText;
	}
}
