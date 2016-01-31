var fs = require("fs");
var http = require("http");
var server = http.createServer(handler);
var io = require("socket.io")(server);

var players = [];
var users = {};

var startBoard = [
    [0, 2, 0, 2, 0, 2, 0, 2],
    [2, 0, 2, 0, 2, 0, 2, 0],
    [0, 2, 0, 2, 0, 2, 0, 2],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0]
];

// copy startBoard
var turn = -1;
var board = JSON.parse(JSON.stringify(startBoard));

server.listen(8080);

function handler(request, response) {
    var url = request.url;
    if (url === '/') {
        url = "/index.html";
    }

    fs.readFile(__dirname + url, function(err, data) {
        if (err) {
            response.writeHead(404);
            response.end("Unable to find page");
        } else {
            response.writeHead(200, {
                "Content-Type" : "text/html"
            });

            response.end(data);
        }
    });
}

function sendGameState(socket, sendToAll/*=true*/) {
    socket.emit("game-state", {
        users: users,
        players: players,
        board: board,
        turn: turn
    });

    sendToAll = typeof sendToAll !== "undefined" ? sendToAll : true;

    if (sendToAll) {
        socket.broadcast.emit("game-state", {
            users: users,
            players: players,
            board: board,
            turn: turn
        });
    }
}

io.on("connection", function(socket) {
    socket.on("login", function(data) {
        // Check if name already taken
        var taken = false;
        for (var i in users) {
            if (users[i] === data.name) {
                taken = true;
            }
        }

        if (taken) {
            socket.emit("name-taken");
            return;
        }

        // Add User
        users[socket.id] = data.name;

        sendGameState(socket);
    });

    socket.on("join", function() {
        if (players.length < 2) {
            players.push(socket.id);

            if (players.length === 2) {
                // reset game and start game
                turn = 1;
                board = JSON.parse(JSON.stringify(startBoard));
            }
            sendGameState(socket);
        } else {
            sendGameState(socket, false);
        }
    });

    socket.on("move", function(data) {
        var chain = data;

        // process only jumped enemies
        for(var i in chain) {
            var j = parseInt(i) + 1;

            if (j >= chain.length) {
                continue;
            }

            var diffX = chain[j].x - chain[i].x;
            if (Math.abs(diffX) !== 2) {
                continue;
            }
            var diffY = chain[j].y - chain[i].y;

            var jumpedPos = {
                x: chain[i].x + diffX / 2,
                y: chain[i].y + diffY / 2
            };
            setAt(jumpedPos, 0);
        }

        var len = chain.length;
        var lastPos = chain[len - 1];
        var me = whoAt(chain[0]);

        // move piece
        setAt(chain[0], 0);
        setAt(lastPos, me);

        // crowning
        if (me === 1 && lastPos.y === 0) {
            setAt(lastPos, me * 10);
        }
        if (me === 2 && lastPos.y === 7) {
            setAt(lastPos, me * 10);
        }

        // switch turns
        turn = turn === 1 ? 2 : 1;

        sendGameState(socket);
    });

    socket.on("disconnect", function() {
        console.log(socket.id + " disconnected");
    });
});

function setAt(pos, state) {
    board[pos.y][pos.x] = state;
}

function whoAt(pos) {
    return board[pos.y][pos.x];
}
