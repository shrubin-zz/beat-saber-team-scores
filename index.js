var app = require('express')();
var expressWs = require('express-ws')(app);

var teams = {};
var scores = {};
var viewers = new Set([]);

function leaveView(ws) {
    console.log('viewer left');
    viewers.delete(ws);
}

function view() {
    viewers.forEach((ws) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(scores));
        } else if (ws.readyState === ws.CLOSED) {
            leaveView(ws); 
        }
    });
}

function leave(ws, team, user) {
    console.log('user ' + user + ' from team ' + team + ' left');
    teams[team].delete(ws);
    delete scores[team][user];
    if (teams[team].size === 0) {
        console.log('team ' + team + ' left');
        delete teams[team];
        delete scores[team];
        return false;
    }
    return true;
}

function broadcast(team) {
    var total = 0;
    for (var user in scores[team]) {
        total += scores[team][user];
    }
    teams[team].forEach((ws) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(total);
        } else if (ws.readyState === ws.CLOSED) {
            leave(ws, team, user);
        }
    });
    view();
}

app.ws('/:team/:user', (ws, req) => {
    var team = req.params.team;
    var user = req.params.user;
    if (team in teams) {
        teams[team].add(ws);
    } else {
        console.log('team ' + team + ' joined');
        teams[team] = new Set([ws]);
        scores[team] = {};
    }
    console.log('user ' + user + ' joined team ' + team);
    scores[team][user] = 0;
    broadcast(team);
    ws.on('message', (msg) => {
        if (msg === 'ping') return;
        scores[team][user] = Number(msg);
        broadcast(team);
    });
    ws.on('close', () => {
        if (leave(ws, team, user)) {
            broadcast(team);
        } else {
            view();
        }
    });
});

app.ws('/', (ws, req) => {
    console.log('viewer joined');
    viewers.add(ws);
    ws.on('close', () => {
        leaveView(ws);
    });
    view();
});

app.listen(process.env.PORT || 6558);
