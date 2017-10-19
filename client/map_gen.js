function distributed_resource_map(pack) {
	var map = resource_map(pack);
	//maybe we can find better distibution
	var res = [];
	var size = (1 << pack.log_size) + 1;
	var count = 1;
	for (let i = 0; i < size; ++i)
		for (let j = 0; j < size; ++j)
			if (map[i + '_' + j]) {
				res[i + '_' + j] = count;
				if (count == 3) count = 1;
				else ++count;
			} else res[i + '_' + j] = 0;
	return res;
};

function resource_map(pack) {
	var map = diamond_square(pack.a, pack.b, pack.c,
		pack.mod, pack.seed, pack.log_size, pack.height);

	var res = [];
	var gen = new PseudoRandom(pack.prob_a, pack.prob_b, pack.prob_c, 
		pack.prob_mod, pack.prob_seed);

	function getProb(depth) {
		let ratio = depth / pack.height;
		if (ratio <= -0.8)
			return 0.21;
		if (ratio <= -0.6)
			return 0.14;
		if (ratio <= -0.2)
			return 0.07;
		if (ratio <= 0)
			return 0.21;
		if (ratio <= 0.2)
			return 0.42;
		if (ratio <= 0.4)
			return 0.63;
		return 0.84;
	};

	var size = (1 << log_size) + 1;
	for (let i = 0; i < size; ++i)
		for (let j = 0; j < size; ++j)
			res[i + '_' + j] = 
				(gen.getNext() < getProb(map[i + '_' + j]));
	return res;
};

var PseudoRandom = function(a, b, c, mod, seed) {
	var elem = seed;
	var prev = 0;
	this.getNext = function() {
		var t = (a * elem + b * prev + c) % mod;
		prev = elem;
		elem = t;
		return t / mod;
	};
	this.getRanged = function(from, to) {
		return (to - from + 1) * this.getNext() + from;
	};
};

function diamond_square(a, b, c, mod, seed, log_size, height) {
	var gen = new PseudoRandom(a, b, c, mod, seed);

	var map = [];
	var size = (1 << log_size) + 1;

	function getDep(dep) {
		return gen.getRanged(-height / dep, height / dep);
	};
	function getPeak() {
		return height / 2 + getDep(2);
	};

	map['0_0'] = getPeak();
	map['0_' + (size - 1)] = getPeak();
	map[(size - 1) + '_0'] = getPeak();
	map[(size - 1) + '_' + (size - 1)] = getPeak();
	
	function getMiddle(i1, j1, i2, j2, dep) {
		return (
			map[i1 + '_' + j1] +
			map[i1 + '_' + j2] +
			map[i2 + '_' + j2] +
			map[i2 + '_' + j1]
			) / 4 + getDep(dep);
	};
	
	function getSide(i1, j1, i2, j2, mi, mj, dep) {
		return (
			map[i1 + '_' + j1] +
			map[i2 + '_' + j2] +
			map[mi + '_' + mj]
			) / 3 + getDep(dep);
	};

	function square(dep, i1, j1, i2, j2) {
		let mi = Math.floor((i1 + i2) / 2),
			mj = Math.floor((j1 + j2) / 2);

		if (mi == i1 || mj == j1) return;

		map[mi + '_' + mj] = getMiddle(i1, j1, i2, j2, dep);

		map[mi + '_' + j1] = getSide(i1, j1, i2, j1, mi, mj, dep);
		map[mi + '_' + j2] = getSide(i1, j2, i2, j2, mi, mj, dep);

		map[i1 + '_' + mj] = getSide(i1, j1, i1, j2, mi, mj, dep);
		map[i2 + '_' + mj] = getSide(i2, j1, i2, j2, mi, mj, dep);

		square(dep + 1, i1, j1, mi, mj);
		square(dep + 1, i1, mj, mi, j2);
		square(dep + 1, mi, mj, i2, j2);
		square(dep + 1, mi, j1, i2, mj);
	};

	square(2, 0, 0, size - 1, size - 1);

	return map;
};
