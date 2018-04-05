function PlayerFactory(resData, io) {
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
	};

	//player_id stores socket.ids
	return function(player_id, spawn_point) {
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
};

module.exports = PlayerFactory;
