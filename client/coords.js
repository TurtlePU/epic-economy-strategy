Cube = function (tx, ty, tz) {
    var x = tx;
    var y = ty;
    var z = tz
};

Offset = function (trow, tcol) {
    var row = trow;
    var col = tcol;
};

Point = function (tx, ty) {
    var px_x = tx;
    var px_y = ty;
};

function hex_corner(center, size, i) {
    with (Math) {
        var angle = PI * i / 3 + PI / 6;
        return Point(center.x + size * cos(angle), center.y + size * sin(angle));
    }
};

//нечет-r
function offset_coords(cube) {
    return Offset(cube.z, cube.x + (cube.z - (cube.z & 1)) / 2);
};

function cube_coords(offset) {
    let row = offset.row,
        col = offset.col,
        x = col - (row - (row & 1)) / 2,
        z = row;
    return Cube(x, z, - x - z);
};

var directions = [
   Cube(+1, -1, 0), Cube(+1, 0, -1), Cube(0, +1, -1),
   Cube(-1, +1, 0), Cube(-1, 0, +1), Cube(0, -1, +1)
]

function cube_neighbor(hex, direction) {
    return cube_add(hex, directions[direction]);
}
function offset_neighbor(offset, direction) {
    return offset_coords(cube_neighbor(cube_coords(offset), direction));
}

var diagonals = [
   Cube(+2, -1, -1), Cube(+1, +1, -2), Cube(-1, +2, -1), 
   Cube(-2, +1, +1), Cube(-1, -1, +2), Cube(+1, -2, +1)
]

function cube_diagonal_neighbor(hex, direction) {
    return cube_add(hex, diagonals[direction])
}
function offset_diagonal_neighbor(offset, direction) {
    return offset_coords(cube_diagonal_neighbor(cube_coords(offset), direction));
}

function cube_add(a, b) {
    return Cube(a.x + b.x, a.y + b.y, a.z + b.z);
}

function cube_distance(a, b) {
    with (Math) {
        return (abs(a.x - b.x) + abs(a.y - b.y) + abs(a.z - b.z)) / 2;
    }
}
function offset_distance(a, b) {
    let cube_a = cube_coords(a),
        cube_b = cube_coords(b);
    return cube_distance(cube_a, cube_b);
}

function cube_reaches(cube, r) {
    var result = [];
    for (let x = cube.x - r; x <= cube.x + r; ++x)
        for (let y = cube.y - r; y <= cube.y + r; ++y)
            result.push(Cube(x, y, -x - y));
    return result;
}
function offset_reaches(offset, r) {
    let t = cube_reaches(cube_coords(offset), r);
    var result = [];
    t.forEach(function (cube) {
        result.push(offset_coords(cube));
    });
    return result;
}