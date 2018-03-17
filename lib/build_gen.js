function buildingFactory(buiData) {
	let s = buiData.length;
	const building_replica = [];
	for (let i = 0; i < s && buiData[i].func.length > 0; ++i)
		building_replica[i] = build_replica(buiData[i], i);

	this.makeBuilding = (id, owner) => {
		console.log(`making ${id} of`);
		console.log(owner);
		return new building_replica[id - 1].create(owner);
	};
	this.getBuildCost = (id) => {
		return building_replica[id - 1].getCost();
	};

	function Vessel(maxCapacity) {
		this.r = 0;
		this.g = 0;
		this.b = 0;
		this.tryChange = (delta, div) => {
			let dr, dg, db;
			with(Math) {
				dr = min(floor(delta.r / div), maxCapacity - this.r - this.g - this.b);
				this.r += dr;
				dg = min(floor(delta.g / div), maxCapacity - this.r - this.g - this.b);
				this.g += dg;
				db = min(floor(delta.b / div), maxCapacity - this.r - this.g - this.b);
				this.b += db;
			}
			return {r: dr, g: dg, b: db};
		}
	}

	function build_replica(info, type) {
		var res = {},
			cost = {
				r: info.cost_r,
				g: info.cost_g,
				b: info.cost_b,
				m: info.cost_gold
			};
		res.getCost = () => cost;

		var in_u = getFunc(info.in_u),
			time_u = getFunc(info.time_u),
			cap_u = getFunc(info.cap_u),
			out_u = getFunc(info.out_u),
			cost_u = getFunc(info.cost_u);

		res.create = function(owner) {
			var time = info.time, cap = info.cap,
				my_cost = upgrade_cost(cost);
			this.type = type;
			this.inp = info.in;
			this.out = info.out;
			this.neighbours = [];
			this.outputs = [];
			this.product = new Vessel(cap);
			console.log(this.product);
			if (info.func.includes("store")) {
				this.call = () => {
					let dr = 0, dg = 0, db = 0, tves = this.product;
					this.neighbours.every((elem) => {
						if (tves.r + tves.g + tves.b  == cap)
							return false;
						let d = tves.tryChange(elem.product, elem.outputs.length);
						dr += d.r;
						dg += d.g;
						db += d.b;
						elem.product.r -= d.r;
						elem.product.g -= d.g;
						elem.product.b -= d.b;
						return true;
					});
					console.log(this.product);
					owner.tryChangeRes({r: dr, g: dg, b: db});
				};
			} else if (info.func.includes("sell")) {
				this.call = () => {
					let mass = 0, max_mass = this.inp;
					this.neighbours.every((elem, i, arr) => {
						if (mass == max_mass) return false;
						with(Math) {
							let 
							a = min(min(max_mass - mass, floor(max_mass / arr.length)), floor(elem.product.r / elem.outputs.length));
							elem.product.r -= a;
							mass += a;
							
							a = min(min(max_mass - mass, floor(max_mass / arr.length)), floor(elem.product.g / elem.outputs.length));
							elem.product.g -= a;
							mass += a;
							
							a = min(min(max_mass - mass, floor(max_mass / arr.length)), floor(elem.product.b / elem.outputs.length));
							elem.product.b -= a;
							mass += a;
						}
						return true;
					});
					owner.tryChangeRes({m: Math.floor(mass / max_mass * this.out)});
				};
			} else {
				this.call = () => {
					let mass = {r: 0, g: 0, b: 0}, max_mass = this.inp;
					this.neighbours.every((elem, i, arr) => {
						if (mass.r + mass.g + mass.b == max_mass) return false;
						with(Math) {
							if (info.func.includes("_r") || info.func.includes("_u")) {
								let dr = min(min(max_mass - (mass.r + mass.g + mass.b), floor(max_mass / arr.length)), floor(elem.product.r / elem.outputs.length));
								elem.product.r -= dr;
								mass.r += dr;
							}
							if (info.func.includes("_g") || info.func.includes("_u")) {
								let dg = min(min(max_mass - (mass.r + mass.g + mass.b), floor(max_mass / arr.length)), floor(elem.product.g / elem.outputs.length));
								elem.product.g -= dg;
								mass.g += dg;
							}
							if (info.func.includes("_b") || info.func.includes("_u")) {
								let db = min(min(max_mass - (mass.r + mass.g + mass.b), floor(max_mass / arr.length)), floor(elem.product.b / elem.outputs.length));
								elem.product.b -= db;
								mass.b += db;
							}
						}
						return true;
					});
					this.product.r += Math.floor(mass.r / this.inp * this.out);
					this.product.g += Math.floor(mass.g / this.inp * this.out);
					this.product.b += Math.floor(mass.b / this.inp * this.out);
					console.log(this.product);
				};
			}
			this.upgrade = () => {
				this.inp = in_u(this.inp);
				this.out = out_u(this.out);
				time = time_u(time);
				cap = cap_u(cap);
				my_cost = upgrade_cost(my_cost);
			};
			this.getUpgradeCost = () => my_cost;
			this.getTime = () => time;
			this.getCapacity = () => cap;
		};

		function upgrade_cost(cost) {
			return {
				r: cost_u(cost.r),
				g: cost_u(cost.g),
				b: cost_u(cost.b),
				m: cost_u(cost.m)
			};
		};

		return res;
	};

	function getFunc(comm) {
		var seq = comm.split(" ");
		if (seq[0] == "add") return (x) => {return x == -1 ? -1 : (x + Number(seq[1]));};
		if (seq[0] == "multiply") return (x) => {return x == -1 ? -1 : (x * Number(seq[1]));};
	};
}

module.exports = { buildingFactory : buildingFactory }