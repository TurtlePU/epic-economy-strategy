Cube = function (tx, ty, tz) {
    this.x = tx;
    this.y = ty;
    this.z = tz
};

Offset = function (trow, tcol) {
    this.row = trow;
    this.col = tcol;
};

Point = function (tx, ty) {
    this.px_x = tx;
    this.px_y = ty;
};

Chunk = function(tx, ty) {
	this.x = tx;
	this.y = ty;
}

ChunkParams = function (tx, ty) {
	this.width = tx;
	this.height = ty;
};

function hex_corner(center, size, i) {
    with (Math) {
        var angle = PI * i / 3 + PI / 6;
        return new Point(center.px_x + size * cos(angle), center.px_y + size * sin(angle));
    }
};

//odd-r
function offset_coords(cube) {
    return new Offset(cube.z, cube.x + (cube.z - (cube.z & 1)) / 2);
};

function cube_coords(offset) {
    let row = offset.row,
        col = offset.col,
        x = col - (row - (row & 1)) / 2,
        z = row;
    return new Cube(x, z, - x - z);
};

var directions = [
   new Cube(+1, -1, 0), new Cube(+1, 0, -1), new Cube(0, +1, -1),
   new Cube(-1, +1, 0), new Cube(-1, 0, +1), new Cube(0, -1, +1)
];

function cube_neighbor(hex, direction) {
    return cube_add(hex, directions[direction]);
};
function offset_neighbor(offset, direction) {
    return offset_coords(cube_neighbor(cube_coords(offset), direction));
};

var diagonals = [
   new Cube(+2, -1, -1), new Cube(+1, +1, -2), new Cube(-1, +2, -1), 
   new Cube(-2, +1, +1), new Cube(-1, -1, +2), new Cube(+1, -2, +1)
];

function cube_diagonal_neighbor(hex, direction) {
    return cube_add(hex, diagonals[direction])
};
function offset_diagonal_neighbor(offset, direction) {
    return offset_coords(cube_diagonal_neighbor(cube_coords(offset), direction));
};

function cube_add(a, b) {
    return new Cube(a.x + b.x, a.y + b.y, a.z + b.z);
};

function cube_distance(a, b) {
    with (Math) {
        return (abs(a.x - b.x) + abs(a.y - b.y) + abs(a.z - b.z)) / 2;
    }
};
function offset_distance(a, b) {
    let cube_a = cube_coords(a),
        cube_b = cube_coords(b);
    return cube_distance(cube_a, cube_b);
};

function cube_reaches(cube, r) {
    var result = [];
    for (let x = cube.x - r; x <= cube.x + r; ++x)
        for (let y = cube.y - r; y <= cube.y + r; ++y)
            result.push(Cube(x, y, -x - y));
    return result;
};
function offset_reaches(offset, r) {
    let t = cube_reaches(cube_coords(offset), r);
    var result = [];
    t.forEach(function (cube) {
        result.push(offset_coords(cube));
    });
    return result;
};

//(0, 0) in the center of hex[0][0]
const sqrt3 = Math.sqrt(3);
function offset_to_pixel(offset, size, topleft) {
    var x = size * sqrt3 * (offset.col + 0.5 * (offset.row & 1)),
        y = size * 3 / 2 * offset.row;
    return point_substract(new Point(x, y), topleft);
};
function pixel_to_cube(pixel, size) {
    let x = (pixel.px_x * sqrt3 / 3 - pixel.px_y / 3) / size,
        z = pixel.px_y * 2 / 3 / size;
    return new Cube(x, -x - z, z);
};
function round_cube(cube) {
    with (Math) {
        var rx = round(cube.x),
            ry = round(cube.y),
            rz = round(cube.z),

            dx = abs(rx - cube.x),
            dy = abs(ry - cube.y),
            dz = abs(rz - cube.z);
    }
    if (dx >= dy && dx >= dz) rx = -ry - rz;
    else if (dy >= dz) ry = -rx - rz;
    else rz = -rx - ry;
    return new Cube(rx, ry, rz);
};
function pixel_to_offset(pixel, size, topleft) {
    return offset_coords(round_cube(pixel_to_cube(point_add(pixel, topleft), size)));
};

function point_substract(a, b) {
	return new Point(a.px_x - b.px_x, a.px_y - b.px_y);
};
function point_add(a, b) {
	return new Point(a.px_x + b.px_x, a.px_y + b.px_y);
};

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