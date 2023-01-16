const express = require("express")
const path = require("path")
const crypto = require('crypto');

const PORT = 8080;

// create express instance
const app = express()

// initialize body parser
app.use(express.json());

// serve static js
app.use(express.static("src/"))

function genSecret() {
  return crypto.randomBytes(16).toString("hex")
}

gameIDs = []
function generateUniqueId() {
  let id = "";
  do {
    const possibleCharacters = 
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    id = "";

    for (let i = 0; i < 6; i++)
      id += possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
  } while(gameIDs.includes(id));
  return id;
}

// setup express-session
const session = require("express-session")
app.use(session({
    secret: 'capitalism LOL',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // enable when using HTTPS
  }))

// serve html files
sendFile = (res, file) => {res.sendFile(file, {root: path.join(__dirname, "src/")})}
app.get("/style.css", (req,res) => sendFile(res, "style.css"))
app.get('/', (req, res) => { 
    sendFile(res, "index.html")

  if(req.session){
    console.log("user session: " + JSON.stringify(req.session))

    // if(req.session && typeof(req.session.root) == true)
    //     sendFile(res, "root/root.html")
    // else
    //     sendFile(res, "client/client.html")
  }
})

// create websocket
const { WebSocketServer } = require('ws');

class Player {
  constructor(uid, secret, ws) {
    this.userId = uid
    this.secret = secret
    this.x = 0
    this.y = 0

    this.ws = ws
    this.lastMoveTimestamp = 0
  }

  send(obj) {
    this.ws.send(JSON.stringify(obj))
  } 
}


class Game {
  constructor(id, secret) {
    this.currentId = 0;
    this.secret = secret
    this.gameId = id
    this.players = {}
  }
  destroy() {
    clearInterval(this.sid)
    games.remove(this.gameId)
  }
  startScheduler() {
    // 1 TPS
    this.sid = setInterval(() => {

      // events for each player
      this.players.foreach(p => {


      })

    }, 1)
  }
}


const games = {}

// Anticheat constatns
const maxVelocity = 5 // units / second

const websocket = new WebSocketServer({ port: 8082 });
websocket.on('connection', (ws) => {
  const sendMe = (obj) => { this.ws.send(JSON.stringify(obj)) };
    ws.on('close', () => console.log('Client has disconnected!'));

    console.log('New client connected!'); 
    ws.on('message', (data) => {
      data = JSON.parse(data)

      console.log("Received message: ", data)

      if(data.game_event == true) {
        const player = ws.player
        const game = ws.game
        if(!game || !player)
          return;

        // timestamp in seconds
        const timestamp = Date.now() / 1000

        // handle game events
        switch(data.type) {
          // ---------------------------- HANDLE GAME EVENTS ------------
          case "playerMove": {
            // move to x y
            var x = data.x, y = data.y
            const deltaTime = Math.min(1, timestamp - player.lastMoveTimestamp)
            const moveX = x - player.x, moveY = y.player.y
            // limit movement length to deltaTime
            const norm = Math.sqrt(moveX*moveX+moveY*moveY)
            if(norm > deltaTime * maxVelocity) {
              // Anticheat trigger
              x = moveX / deltaTime + player.x, y / moveY + player.y
              // also send to player
              sendMe({
                gameEvents: [{type: "playerMove", uid: player.uid, x, y}]
              })
            } // else x,y are good
            // update player timestamp
            player.lastMoveTimestamp = timestamp
            // broadcast new positions
            game.players.filter(p => p.uid != player.uid).foreach(p => 
              p.send({
                gameEvents: [{type: "playerMove", uid: player.uid, x, y}]
              })
            )

          }


          // ---------------------------- HANDLE GAME EVENTS ------------
        }
      }

      // process requests
      if(data.join_game) {
        const game = games[data.join_game]
        if(game) {
          console.log("Client joins:", game)
          const uid = game.currentId++
          const player = game.players[uid] = new Player(uid, genSecret(), ws)
          sendMe({
            page: "clients/client.html",
            userId: uid,
            secret: player.secret,

            // send all game_events
            gameEvents: game.players.map(p => ({
              type: "playerMove",
              x: p.x,
              y: p.y,
              uid: p.uid
            }))
          })
          ws.game = game
          ws.player = player
        } else {
          console.log("Game not found")
        }
      }

      if(data.create_game) {
        const game = new Game(generateUniqueId(), genSecret())
        games[game.gameId] = game
        ws.game = game
        sendMe({
          page: "root/root.html",
          gameId: game.gameId,
          secret: game.secret
        })
      }

  })
});

// setInterval(() => {
//    websocket.clients.forEach((client) => {
//        const data = JSON.stringify({'type': 'time', 'time': new Date().toTimeString()});
//        client.send(data);
//    });
// }, 1000);

// listen on webserver
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
})