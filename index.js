var board;
var myTurn = false;
var player = 0; // 0 - observer, 1 - player 1, 2 - player 2
var id = false;
var chain = []; // stored in absolutePos

$(document).ready(function() {
    var socket = io('http://localhost:8080');
    var name = "";

    socket.on("connect", function() {
        id = this.id;
    });

    $("#btn-login").on("click", function() {
        name = $("#name").val();
        socket.emit("login", {name : name});
        $("#login-form").hide();
    });

    socket.on("game-state", function(data) {
        var userList = [];
        var playerList = [];
        for (var i in data.users) {
            var user = data.users[i];
            var me = i.slice(2) == id ? true : false;
            if (me) {
                user = "<b>" + user + "</b>";
            }
            var index = data.players.indexOf(i);
            if (index === -1) {
                userList.push(user);
                if (me) {
                    player = 0;
                }
            } else {
                playerList.push(user);
                if (me) {
                    player = index + 1;
                }
            }
        }

        $("#observers").html(userList.join(", "));

        if (playerList.length > 0) {
            $("#player1").html(playerList[0]);
        }
        if (playerList.length > 1) {
            $("#player2").html(playerList[1]);
        } else {
            if (player === 0) {
                $("#join").show();
            }
        }

        $("#user-info").show();

        drawBoard();
        board = data.board;
        drawPieces();

        myTurn = false;
        if (data.turn === player) {
            myTurn = true;
            $("#cmd").html("It is your turn!");
        } else {
            $("#cmd").html("");
        }
    });

    $("#join").on("click", function() {
        $("#join").hide();
        socket.emit("join", {});
    });

    // stop firefox image dragging
    $(document).on("dragstart", function() {
         return false;
    });

    // ***************** ACTIVE WORK ***************
    $(document).on("mousedown", "#board", function(event) {
        var p = findPos(event);

        if (!myTurn) {
            chain = [];
            return;
        }

        var n = whoAt(p, true);

        if (player === 1) {
            chain.push(p);
        } else {
            chain.push(reversePos(p));
        }
    });

    $(document).on("mousemove", "#board", function(event) {
        var len = chain.length;

        if (len === 0) {
            return;
        }

        var p = findPos(event);
        var me = whoAt(chain[0]);
        var who = whoAt(p, true);
        var last = chain[len - 1];
        var pos = player === 1 ? p : reversePos(p);

        // no move onto somebody
        if (who !== 0) {
            return;
        }

        // only move onto black space
        if ((pos.x + pos.y) % 2 !== 1) {
            return;
        }

        // red non crown only move forward
        if (me === 2) {
            if (last.y >= pos.y) {
                return;
            }
        } else if (me === 1) { // same for black
            if (last.y <= pos.y) {
                return;
            }
        }

        // not last position
        if (pos.x === last.x && pos.y === last.y) {
            return;
        }

        // only jumps
        var singleOk = false;
        if (len === 1) {
            singleOk = true;
        }

        var moved = false;
        var diffX = pos.x - last.x,
            diffY = pos.y - last.y;

        // single
        if (singleOk) {
            if (Math.abs(diffX) === 1 && Math.abs(diffY) === 1) {
                chain.push(pos);
                moved = true;
            }
        }

        // jump
        if (!moved){
            if (Math.abs(diffX) === 2 && Math.abs(diffY) === 2) {
                var between = {
                    x: last.x + (diffX / 2),
                    y: last.y + (diffY / 2),
                };

                var jumped = whoAt(between);

                // jumping nobody
                if (jumped === 0) {
                    return;
                }

                // jumping own players?
                if ((me >= 10 ? me / 10 : me) === (jumped >= 10 ? jumped/10 : jumped)) {
                    return;
                }

                chain.push(pos);
                moved = true;
            }
        }

        if (!moved) {
            return;
        }

        // redraw line
        $("svg polyline").remove();
        var unit = 10;
        var svgNS = "http://www.w3.org/2000/svg";
        var line = document.createElementNS(svgNS, "polyline");
        line.setAttribute("stroke-width", "0.5");
        line.setAttribute("stroke", "#fff");
        line.setAttribute("fill", "none");

        var points = "";
        for (var i in chain) {
            var screenPos = player === 2 ? reversePos(chain[i]) : chain[i];
            points += (screenPos.x * unit + 5) + "," + (screenPos.y * unit + 5) + " ";
        }
        line.setAttribute("points", points);

        document.getElementById("board").appendChild(line);
    });

    $(document).on("mouseup", "#board", function(event) {
        var len = chain.length;
        var noMove = false;

        if (len < 2) {
            noMove = true;
            chain = [];
            return;
        }

        var lastPos = chain[len - 1];
        var currPos = findPos(event);
        if (player === 2) {
            currPos = reversePos(currPos);
        }

        if (lastPos.x !== currPos.x || lastPos.y !== currPos.y) {
            noMove = true;
        }

        if (noMove) {
            chain = [];
            $("svg polyline").remove();
            return;
        }

        $("svg polyline").remove();
        $("svg circle").remove();


        socket.emit("move", chain);
        chain = [];
    });
});

var svgNS = "http://www.w3.org/2000/svg";
function drawBoard() {
    var color = "#c44";
    $("#bg-board").attr("fill", "#444");

    var boardSize = 80;
    for (var y = 0; y < boardSize; y += 10) {
        for (var x = (y % 20) ? 10 : 0; x < boardSize; x += 20) {
            var rect = document.createElementNS(svgNS, "rect");
            rect.setAttribute("x", x);
            rect.setAttribute("y", y);
            rect.setAttribute("width", 10);
            rect.setAttribute("height", 10);
            rect.setAttribute("fill", color);
            document.getElementById("board").appendChild(rect);
        }
    }
}

function drawPieces() {
    $("svg circle").remove();
    var i = 100;
    for (var y in board) {
        for (var x in board[y]) {
            var piece = whoAt({x: x, y: y}, true);
            if (piece) {
                var circle = document.createElementNS(svgNS, "circle");
                circle.setAttribute("cx", x*10 + 5);
                circle.setAttribute("cy", y*10 + 5);
                circle.setAttribute("r", 4);
                circle.setAttribute("stroke", "#555");
                circle.setAttribute("stroke-width", ".3");
                circle.setAttribute("fill", $.inArray(piece, [1, 10]) !== -1 ? '#f00' : '#000');
                document.getElementById("board").appendChild(circle);

                if ($.inArray(piece, [10, 20]) !== -1) {
                    circle = document.createElementNS(svgNS, "circle");
                    circle.setAttribute("cx", x*10 + 5);
                    circle.setAttribute("cy", y*10 + 5);
                    circle.setAttribute("r", 3);
                    circle.setAttribute("stroke", "#ffd700");
                    circle.setAttribute("stroke-width", ".5");
                    circle.setAttribute("fill", piece === 10 ? '#f00' : '#000');
                    document.getElementById("board").appendChild(circle);
                }
            }
            i--;
            if (i < 0) {
                return;
            }
        }
    }
}

function findPos(event)
{
    var offset = $("svg").offset();
    var unit = 500 / 8;

    var scrollX = $(window).scrollLeft(),
        scrollY = $(window).scrollTop();

    var mPos = {
        x: event.clientX - offset.left + scrollX,
        y: event.clientY - offset.top  + scrollY
    };

    var pos = {
        x: Math.floor(mPos.x / unit),
        y: Math.floor(mPos.y / unit)
    };

    if (pos.y > 7) {
        pos.y = 7;
    }
    if (pos.y > 8) {
        pos.y = 8;
    }

    return pos;
}

function whoAt(pos, reverseForPlayer2) { // default reverseForPlayer2 = false
    if (typeof reverseForPlayer2 === "undefined") {
        reverseForPlayer2 = false;
    }
    var p;
    if (player === 2 && reverseForPlayer2) {
        p = reversePos(pos);
    } else {
        p = pos;
    }

    return board[p.y][p.x];
}

function reversePos(pos) {
    var o = {x : 7 - pos.x, y : 7 - pos.y};
    return o;
}
