function buildingFactory(buiData) {
	let s = buiData.length;
	const building_replica = [];
	for (let i = 0; i < s && buiData[i].func.length > 0; ++i)
		building_replica[i] = build_replica(buiData[i]);

	this.makeBuilding = (id, owner) => {
		console.log(`making ${id} of`);
		console.log(owner);
		return new building_replica[id - 1].create(owner);
	};
	this.getBuildCost = (id) => {
		return building_replica[id - 1].getCost();
	};

	function Vault() {
		this.r = 0;
		this.g = 0;
		this.b = 0;
		this.min = () => Math.min(this.r, Math.min(this.g, this.b));
		this.sum = () => this.r + this.g + this.b;
		this.add = (delta) => {
			this.r += delta.r;
			this.g += delta.g;
			this.b += delta.b;
		};
		this.mul = (k) => {
			with(Math) {
				this.r = floor(this.r * k);
				this.g = floor(this.g * k);
				this.b = floor(this.b * k);
			}
		}
	}

	function build_replica(info) {
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
		    out_u = getFunc(info.out_u),
		    cost_u = getFunc(info.cost_u);

		res.create = function(owner) {
			var time = info.time;
			this.getTime = () => time;

			var inp = info.in,
			    out = info.out;
			
			var neighbours = [];
			this.push_neighbour = (elem) => {
				neighbours.push(elem);
				//neighbours.sort((a, b) => a.outputs.length - b.outputs.length);
			};
			this.remove_neighbour = (elem) => {
				neighbours.splice(neighbours.indexOf(elem), 1);
			};

			var outputs = [];
			this.push_output = (elem) => {
				outputs.push(elem);
			};
			this.remove_output = (elem) => {
				outputs.splice(outputs.indexOf(elem), 1);
			};
			this.clients = () => outputs.length;

			this.untie = () => {
				neighbours.forEach((elem) => elem.remove_output(this));
				outputs.forEach((elem) => elem.remove_neighbour(this));
			};

			var can_r = fits(info.func, '_r'),
			    can_g = fits(info.func, '_g'),
			    can_b = fits(info.func, '_b'),

			    store = info.func.includes("store"),
			    sell = info.func.includes("sell");

			this.product = new Vault();
			this.call = () => {
				let d = new Vault(), mx = inp;
				neighbours.every((elem) => {
					if (elem.clients() > 1) return true;
					if (d.min() < mx) {
						let prod = elem.product, a = 0;
						if (can_r) {
							a = Math.min(mx - d.r, prod.r);
							prod.r -= a;
							d.r += a;
						}
						if (can_g) {
							a = Math.min(mx - d.g, prod.g);
							prod.g -= a;
							d.g += a;
						}
						if (can_b) {
							a = Math.min(mx - d.b, prod.b);
							prod.b -= a;
							d.b += a;
						}
						return true;
					} else return false;
				});
				neighbours.every((elem) => {
					if (d.min() < mx) {
						let prod = elem.product, a = 0;
						if (can_r) {
							a = Math.min(mx - d.r, prod.r);
							prod.r -= a;
							d.r += a;
						}
						if (can_g) {
							a = Math.min(mx - d.g, prod.g);
							prod.g -= a;
							d.g += a;
						}
						if (can_b) {
							a = Math.min(mx - d.b, prod.b);
							prod.b -= a;
							d.b += a;
						}
						return true;
					} else return false;
				});
				d.mul(out / inp);
				if (store) {
					console.log("Stored:");
					console.log(d);
					
					owner.tryChangeRes(d);
				}
				if (sell) {
					console.log("Sold:");
					console.log(d);
					
					let m = d.sum();
					console.log("Earned: " + m);
					
					owner.tryChangeRes({ m : m });
				}
				if (!store && !sell) {
					console.log(info.func);
					
					this.product.add(d);
					console.log(this.product);
				}
			};

			var my_cost = upgrade_cost(cost);
			this.getUpgradeCost = () => my_cost;
			
			this.upgrade = () => {
				inp = in_u(inp);
				out = out_u(out);
				time = time_u(time);
				my_cost = upgrade_cost(my_cost);
			};
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

	function fits(name, req) {
		return name.includes("store") || name.includes("sell") || name.includes("_u") || name.includes(req);
	}
}

module.exports = { buildingFactory : buildingFactory }
