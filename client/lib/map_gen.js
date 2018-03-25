var PseudoRandom = function(a, b, c, mod, elem) {
	var prev = 0;
	this.getNext = function() {
		var t = (a * elem + b * prev + c) % mod;
		prev = elem;
		elem = t;
		return t;
	};
	this.getRanged = function(from, to) {
		return 1.0 * (to - from) * this.getNext() / mod + from;
	};
};

var MapGen = {
	pack: function(array, chunkWidth, chunkHeight) {
		let sx = array.length, sy = array[0].length;
		let w = Math.ceil(sx / chunkWidth), h = Math.ceil(sy / chunkHeight);

		var res = [];
		for (let i = 0; i < w; ++i) {
			res[i] = [];
			for (let j = 0; j < h; ++j) {
				res[i][j] = {
					x: i, y: j,
					res: [[]]
				};
			}
		}

		let floor = Math.floor;
		for (let i = 0; i < sx; ++i) {
			let chunk_i = floor(i / chunkWidth),
			    dep_i = i - chunk_i * chunkWidth;
			for (let j = 0; j < sx; ++j) {
				let chunk_j = floor(j / chunkHeight),
				    dep_j = j - chunk_j * chunkHeight;
				if (res[chunk_i][chunk_j].res[dep_i] === undefined)
					res[chunk_i][chunk_j].res[dep_i] = [];
				res[chunk_i][chunk_j].res[dep_i][dep_j] = array[i][j];
			}
		}

		return res;
	},
	buildChunked: function(data) { return this.pack(this.__distributed_resource_map(data), data.chunkWidth, data.chunkHeight); },
	chunkedDS: function(pack) { 
		return this.pack(
			this.diamondSquare(
				pack.a, pack.b, pack.c, pack.mod, pack.seed, 
				pack.logSize, pack.height
			), 
			pack.chunkWidth, 
			pack.chunkHeight
		); 
	},
	__distributed_resource_map: function(pack) {
		var map = this.__resource_map(pack);
		//maybe we can find better distibution
		var size = (1 << pack.logSize) + 1;
		var count = 1;
		for (let i = 0; i < size; ++i) {
			for (let j = 0; j < size; ++j) {
				if (map[i][j]) {
					map[i][j] = count;
					if (count == 3) 
						count = 1;
					else 
						++count;
				} else {
					map[i][j] = 0;
				}
			}
		}
		return map;
	},
	__resource_map: function(pack) {
		var map = this.diamondSquare(pack.a, pack.b, pack.c,
			pack.mod, pack.seed, pack.logSize, pack.height);
		var gen = new PseudoRandom(pack.prob_a, pack.prob_b, pack.prob_c, 
			pack.prob_mod, pack.prob_seed);

		function getProb(depth) {
			return Math.abs(depth) / pack.height;
		};

		var size = (1 << pack.logSize) + 1;
		for (let i = 0; i < size; ++i) {
			for (let j = 0; j < size; ++j) {
				map[i][j] = 
					(gen.getRanged(0, 1) * getProb(map[i][j]) > (1 - pack.richness)); 
			}
		}
		return map;
	},
	diamondSquare: function(a, b, c, mod, seed, log_size, height) {
		var gen = new PseudoRandom(a, b, c, mod, seed);

		var map = [];
		var size = (1 << log_size) + 1;
		for (let i = 0; i < size; ++i)
			map[i] = [];

		function getDep(dep) {
			return gen.getRanged(-height / dep, height / dep);
		};
		function getPeak() {
			return height / 2 + getDep(2);
		};

		map[0][0] = getPeak();
		map[0][size - 1] = getPeak();
		map[size - 1][0] = getPeak();
		map[size - 1][size - 1] = getPeak();
	
		function getMiddle(i1, j1, i2, j2, dep) {
			return (
				map[i1][j1] +
				map[i1][j2] +
				map[i2][j2] +
				map[i2][j1]
			) / 4 + getDep(dep);
		};
	
		function getSide(i1, j1, i2, j2, mi, mj, dep) {
			return (
				map[i1][j1] +
				map[i2][j2] +
				map[mi][mj]
			) / 3 + getDep(dep);
		};

		function square(dep, i1, j1, i2, j2) {
			let mi = Math.floor((i1 + i2) / 2),
				mj = Math.floor((j1 + j2) / 2);

			if (mi == i1 || mj == j1) return;

			map[mi][mj] = getMiddle(i1, j1, i2, j2, dep);

			map[mi][j1] = getSide(i1, j1, i2, j1, mi, mj, dep);
			map[mi][j2] = getSide(i1, j2, i2, j2, mi, mj, dep);

			map[i1][mj] = getSide(i1, j1, i1, j2, mi, mj, dep);
			map[i2][mj] = getSide(i2, j1, i2, j2, mi, mj, dep);

			square(dep + 1, i1, j1, mi, mj);
			square(dep + 1, i1, mj, mi, j2);
			square(dep + 1, mi, mj, i2, j2);
			square(dep + 1, mi, j1, i2, mj);
		};

		square(2, 0, 0, size - 1, size - 1);

		return map;
	}
};

module.exports = {
	MapGen: MapGen
};
