function FieldFactory(building_replica, ResourceSource, linkData, map_gen, coords, io) {
	const MAX_PLAYERS = 7, msPerTick = 250;

	function precedes(fat, son) {
		return linkData.some((elem) => elem.f == fat && elem.t == son);
	};

	return function(params, index) {
		let tmp = map_gen.buildChunked(params);
		var filled = false,
		    hasPlace = true,
		    map = [],
		    resources = 0,
		    maxResources = 0,
		    heightMap = map_gen.chunkedDS(params),
		    bui = [],
		    players = [],
		    CE = new coords(42, params.chunkWidth, params.chunkHeight),
		    n = tmp.length, m = tmp[0].length,
		    lastPlayerId = -1;
		for (let ci = 0; ci < n; ++ci) {
			bui[ci] = [];
			for (let cj = 0; cj < m; ++cj) {
				bui[ci][cj] = [];
				for (let i = 0; i < params.chunkWidth && tmp[ci][cj].res[i]; ++i) {
					bui[ci][cj][i] = [];
					for (let j = 0; j < params.chunkHeight; ++j) {
						if (tmp[ci][cj].res[i][j]) {
							bui[ci][cj][i][j] = {
								bui: new ResourceSource(
									tmp[ci][cj].res[i][j],
									this,
									{
										cx : ci,
										cy: cj,
										dx: i,
										dy: j
									}
								),
								val: -tmp[ci][cj].res[i][j],
								own: -1,
								clb: undefined
							};
							++resources;
							++maxResources;
							if (!map[ci])
								map[ci] = [];
							if (!map[ci][cj])
								map[ci][cj] = {
									x: ci, y: cj,
									arr: []
								};
							if (!map[ci][cj].arr[i])
								map[ci][cj].arr[i] = [];
							map[ci][cj].arr[i][j] = `${-tmp[ci][cj].res[i][j]}_-1`;
						}
					}
				}
			}
		}
		this.canTake = () => !filled && hasPlace && resources > 0.5 * maxResources;
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
			var res;
			if (!map[coords.cx])
				res = true;
			else if (!map[coords.cx][coords.cy])
				res = true;
			else if (!map[coords.cx][coords.cy].arr[coords.dx])
				res = true;
			else
				res = !map[coords.cx][coords.cy].arr[coords.dx][coords.dy];
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
			if (!map[data.cx])
				map[data.cx] = [];
			if (!map[data.cx][data.cy])
				map[data.cx][data.cy] = {
					x: data.cx,
					y: data.cy,
					arr: []
				};
			if (!map[data.cx][data.cy].arr[data.dx])
				map[data.cx][data.cy].arr[data.dx] = [];

			map[data.cx][data.cy].arr[data.dx][data.dy] = data.value + "_" + (data.owner % MAX_PLAYERS);

			var building = building_replica.makeBuilding(data.value, this.getPlayer(data.owner));

			var offset = new CE.Offset(data.cx * params.chunkWidth + data.dx, data.cy * params.chunkHeight + data.dy);
			for (let i = 0; i < 6; ++i) {
				var neigh = offset.getNeighbor(i),
				    nech = neigh.toChunk(),
				    tdx = neigh.getRow() % params.chunkWidth,
				    tdy = neigh.getCol() % params.chunkHeight,
				    other = bui[nech.getX()][nech.getY()][tdx][tdy];
				if (other === undefined || (other.own >= 0 && other.own != data.owner)) continue;
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
		this.getBuildCost = (value) => building_replica.getBuildCost(value);
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
			map[crd.cx][crd.cy].arr[crd.dx][crd.dy] = undefined;

			console.log("building removed");
			this.emit_chunk(crd.cx, crd.cy);
		};
		this.dec_resources = () => {
			--resources;
			console.log(`resource emptied. ${resources}/${maxResources} left`);
		}
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
				mapParams: params,
				heightMap: heightMap,
				buildings: map
			};
		};
	};
}

module.exports = FieldFactory;
