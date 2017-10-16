var PseudoRandom = function(a, b, c, mod, seed) {
	var elem = seed;
	var prev = 0;
	this.getNext = function() {
		var t = (a * elem + b * prev + c) % mod;
		prev = elem;
		elem = t;
		return t / mod;
	};
};

function getRanged(rand, from, to) {
	return (to - from + 1) * rand + from;
};

function middle(a, b, c, d) {
	if (a == undefined) a = 0;
	if (b == undefined) b = 0;
	if (c == undefined) c = 0;
	if (d == undefined) d = 0;
	return (a + b + c + d) / 4;
};

function diamond_square(a, b, c, mod, seed, log_size, height) {
	var gen = new PseudoRandom(a, b, c, mod, seed);

	var map = [];
	var size = (1 << log_size) + 1;

	var getInHeight = function() {
		return getRanged(gen.getNext(), 0, height);
	};

	map['0_0'] = getInHeight();
	map['0_' + (size - 1)] = getInHeight();
	map[(size - 1) + '_0'] = getInHeight();
	map[(size - 1) + '_' + (size - 1)] = getInHeight();

	function square(dep, i1, j1, i2, j2) {
		let mi = Math.floor((i1 + i2) / 2),
			mj = Math.floor((j1 + j2) / 2);

		if (mi < 0 || mj < 0 ||
			mi >= size || mj >= size || 
			mi == i1 || mj == j1) return;

		map[mi + '_' + mj] = middle(
			map[i1 + '_' + j1],
			map[i1 + '_' + j2],
			map[i2 + '_' + j2],
			map[i2 + '_' + j1]
		) + getRanged(gen.getNext(), -height / dep, height / dep);

		diamond(dep + 1, mi, j1, i2 + (i2 - mi), j2);
		diamond(dep + 1, i1, mj, i2, j2 + (j2 - mj));
		diamond(dep + 1, i1 - (mi - i1), j1, mi, j2);
		diamond(dep + 1, i1, j1 - (mj - j1), i2, mj);
	};
	function diamond(dep, i1, j1, i2, j2) {
		let mi = Math.floor((i1 + i2) / 2),
			mj = Math.floor((j1 + j2) / 2);

		if (mi < 0 || mj < 0 ||
			mi >= size || mj >= size || 
			mi == i1 || mj == j1) return;

		map[mi + '_' + mj] = middle(
			map[i1 + '_' + mj],
			map[i2 + '_' + mj],
			map[mi + '_' + j1],
			map[mi + '_' + j2]
		) + getRanged(gen.getNext(), -height / dep, height / dep);

		square(dep + 1, i1, j1, mi, mj);
		square(dep + 1, i1, mj, mi, j2);
		square(dep + 1, mi, j1, i2, mj);
		square(dep + 1, mi, mj, i2, j2);
	};

	square(2, 0, 0, size - 1, size - 1);
	return map;
};
