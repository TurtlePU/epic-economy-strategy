function Offset(row, col) {
    this.toCube = function() {
        let x = col - (row >> 1),
            z = row;
        return new Cube(x, z, - x - z);
    };
    const sqrt3 = Math.sqrt(3);
    this.toPoint = function(size) {
        var x = size * sqrt3 * (col + 0.5 * (row & 1)),
            y = size * 3 / 2 * row;
        return new Point(x, y);
    };

    this.getNeighbor = function(direction) {
        return this.toCube().getNeighbor(direction).toOffset();
    };
    this.getDiagonalNeighbor = function(direction) {
        return this.toCube().getDiagonalNeighbor(direction).toOffset();
    };

    this.dist = function(offset) {
        return this.toCube().dist(offset.toCube());
    }
    this.reaches = function(radius) {
        var result = [], t = this.toCube.reaches(radius);
        t.forEach(function(item, index, array) {
            result.push(t.toOffset());
        });
        return result;
    }
};

function Cube(x, y, z) {
    this.getX = function() {return x;};
    this.getY = function() {return y;};
    this.getZ = function() {return z;};

    this.toOffset = function() {
        return new Offset(z, x + (z >> 1));    
    };

    this.round = function() {
        with (Math) {
            var rx = round(x),
                ry = round(y),
                rz = round(z),

                dx = abs(rx - x),
                dy = abs(ry - y),
                dz = abs(rz - z);
        }
        
        if (dx >= dy && dx >= dz) 
            rx = -ry - rz;
        else if (dy >= dz) 
            ry = -rx - rz;
        else 
            rz = -rx - ry;
        
        return new Cube(rx, ry, rz);
    };

    function add(cube) {
        return new Cube(x + cube.getX(), y + cube.getY(), z + cube.getZ());
    }.bind(this);

    this.dist = function(cube) {
        with (Math) {
            return (abs(x - cube.getX()) + abs(y - cube.getY()) + abs(z - cube.getZ())) / 2;
        }
    };

    var directions = [
        new Cube(+1, -1, 0), new Cube(+1, 0, -1), new Cube(0, +1, -1),
        new Cube(-1, +1, 0), new Cube(-1, 0, +1), new Cube(0, -1, +1)
    ];
    this.getNeighbor = function(direction) {
        return add(directions[direction]);
    };

    var diagonals = [
        new Cube(+2, -1, -1), new Cube(+1, +1, -2), new Cube(-1, +2, -1), 
        new Cube(-2, +1, +1), new Cube(-1, -1, +2), new Cube(+1, -2, +1)
    ];
    this.getDiagonalNeighbor = function(direction) {
        return add(diagonals[direction]);
    };

    this.reaches = function(radius) {
        var result = [];
        for (let tx = x - r; tx <= x + r; ++tx)
            for (let ty = y - r; ty <= y + r; ++ty)
                result.push(new Cube(tx, ty, -tx - ty));
        return result;
    };
};

function Point(x, y, hexSize) {
    this.getX = function() {return x;};
    this.getY = function() {return y;};

    const sqrt3 = Math.sqrt(3);
    function toUnRoundCube() {
        let tx = (x * sqrt3 - y) / (3 * hexSize),
            tz = (y * 2) / (3 * hexSize);
        return new Cube(tx, -tx - tz, tz);
    }.bind(this);
    this.toCube = function() {
        return toUnRoundCube().round();
    };

    this.toOffset = function() {
        return toCube().toOffset();
    };

    this.add = function(point) {
        return new Point(x + point.getX(), y + point.getY(), hexSize);
    };
    this.sub = function(point) {
        return new Point(x - point.getX(), y - point.getY(), hexSize);
    };

    this.getCorner = function(direction) {
        with (Math) {
            var angle = PI * direction / 3 + PI / 6;
            return new Point(x + hexSize * cos(angle), y + hexSize * sin(angle));
        }
    };
};

function Chunk(x, y) {
	
};

ChunkParams = function (tx, ty) {
	this.width = tx;
	this.height = ty;
};

//(0, 0) in the center of hex[0][0]
const sqrt3 = Math.sqrt(3);

function offset_to_chunk(offset, chunk_params) {
	with (Math) {
		return new Chunk(
			floor(offset.col / chunk_params.width),
			floor(offset.row / chunk_params.height)
		);
	}
};
function pixel_to_chunk(pixel, size, topleft, chunk_params) {
	return offset_to_chunk(
		pixel_to_offset(pixel, size, topleft), 
		chunk_params
	);
};
function chunk_inside(chunk, bord1, bord2) {
	return bord1.x <= chunk.x &&
		   bord2.x >= chunk.x &&
		   bord1.y <= chunk.y &&
		   bord2.y >= chunk.y;
};
function chunk_to_offset(chunk, chunk_params) {
	return new Offset(
		chunk.x * chunk_params.width, 
		chunk.y * chunk_params.height);
};