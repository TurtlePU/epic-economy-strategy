function CoordsEnvironment(hexSize, chunkWidth, chunkHeight) {
    //(0, 0) in the center of topleft cell
    const sqrt3 = Math.sqrt(3);
    const CE = this;

    this.getHexHeight = function() { return hexSize * 2; }

    this.Offset = function(row, col) {
        this.getRow = function() {return row;};
        this.getCol = function() {return col;};

        this.toCube = function() {
            let x = col - (row - (row & 1)) / 2,
                z = row;
            return new Cube(x, - x - z, z);
        };
        this.toPoint = function() {
            var x = hexSize * sqrt3 * (col + 0.5 * (row & 1)),
                y = hexSize * 3 / 2 * row;
            return new CE.Point(x, y);
        };
        this.upperLeftPixel = function() {
            return this.toPoint().sub(pixelShift);
        };
        this.toChunk = function() {
            with(Math) {
                return new CE.Chunk(floor(row / chunkHeight), floor(col / chunkWidth));
            }
        };

        var add = function(offset) {
            return new CE.Offset(row + offset.getRow(), col + offset.getCol());
        }.bind(this);
        this.sub = function(offset) {
            return new CE.Offset(row - offset.getRow(), col - offset.getCol());
        }

        this.getNeighbor = function(direction) {
            return this.toCube().getNeighbor(direction).toOffset();
        };
        this.getDiagonalNeighbor = function(direction) {
            return this.toCube().getDiagonalNeighbor(direction).toOffset();
        };

        this.dist = function(offset) {
            return this.toCube().dist(offset.toCube());
        };
        this.reaches = function(radius) {
            var result = [], t = this.toCube().reaches(radius);
            t.forEach(function(item, index, array) {
                result.push(t.toOffset());
            });
            return result;
        };
    };

    function Cube(x, y, z) {
        this.getX = function() {return x;};
        this.getY = function() {return y;};
        this.getZ = function() {return z;};

        this.toOffset = function() {
            return new CE.Offset(z, x + (z - (z & 1)) / 2);    
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

        var add = function(cube) {
            return new Cube(x + cube.getX(), y + cube.getY(), z + cube.getZ());
        }.bind(this);

        this.dist = function(cube) {
            with (Math) {
                return max(abs(x - cube.getX()), abs(y - cube.getY()), abs(z - cube.getZ()));
            }
        };

        this.getNeighbor = function(direction) {
            return add(directions[direction]);
        };

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

    this.Point = function(x, y) {
        this.getX = function() {return x;};
        this.getY = function() {return y;};

        var toUnRoundCube = function() {
            let tx = (x * sqrt3 - y) / (3 * hexSize),
                tz = (y * 2) / (3 * hexSize);
            return new Cube(tx, -tx - tz, tz);
        }.bind(this);
        this.toCube = function() {
            return toUnRoundCube().round();
        };

        this.toOffset = function() {
            return this.toCube().toOffset();
        };

        this.toChunk = function() {
            return this.toOffset().toChunk();
        };

        this.add = function(point) {
            return new CE.Point(x + point.getX(), y + point.getY());
        };
        this.sub = function(point) {
            return new CE.Point(x - point.getX(), y - point.getY());
        };
        this.mid = function(point) {
            return new CE.Point((x + point.getX()) / 2, (y + point.getY()) / 2);
        };
        this.mul = function(k) {
            return new CE.Point(k * x, k * y);
        };

        this.equals = function(point) {
            return x == point.getX() && y == point.getY();
        }

        this.getCorner = function(direction) {
            with (Math) {
                var angle = PI * direction / 3 + PI / 6;
                return new CE.Point(x + hexSize * cos(angle), y + hexSize * sin(angle));
            }
        };
    };

    const pixelShift = new this.Point(sqrt3 * hexSize / 2, hexSize);
    this.getPixelShift = function() {return pixelShift;};

    this.Chunk = function(x, y) {
        this.getX = function() {return x;};
        this.getY = function() {return y;};

        this.inside = function(bord1, bord2) {
            return 
                (x - bord1.getX()) * (x - bord2.getX()) <= 0
                && (y - bord1.getY()) * (y - bord2.getY()) <= 0;
        };

        this.toOffset = function() {
            return new CE.Offset(
                x * chunkHeight,
                y * chunkWidth);
        };

        this.upperLeftPixel = function() {
            return this.toOffset().upperLeftPixel();
        }; 
    };

    const directions = [
        new Cube(+1, -1, 0), new Cube(+1, 0, -1), new Cube(0, +1, -1),
        new Cube(-1, +1, 0), new Cube(-1, 0, +1), new Cube(0, -1, +1)
    ];

    const diagonals = [
        new Cube(+2, -1, -1), new Cube(+1, +1, -2), new Cube(-1, +2, -1), 
        new Cube(-2, +1, +1), new Cube(-1, -1, +2), new Cube(+1, -2, +1)
    ];
};

module.exports = {
    CoordsEnvironment: CoordsEnvironment
};
