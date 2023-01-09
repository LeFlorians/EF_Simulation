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
  constructor(uid) {
    this.userId = uid
    this.x = 0
    this.y = 0
  }
}


class Game {
  constructor(id, ownerKey) {
    this.currentId = 0;
    this.ownerKey = ownerKey
    this.gameId = id
    this.players = {}
  }
  destroy() {
    gameIDs.remove(this.gameId)
  }
}


const games = {}

const websocket = new WebSocketServer({ port: 8082 });
websocket.on('connection', (ws) => {
    const send = (obj) => ws.send(JSON.stringify(obj))
    ws.on('close', () => console.log('Client has disconnected!'));

    console.log('New client connected!'); 
    ws.on('message', (data) => {
      data = JSON.parse(data)

      console.log("Received message: ", data)

      // process requests
      if(data.join_game) {
        const game = games[data.join_game]
        if(game) {
          const uid = game.currentId++
          send({
            page: "clients/client.html",
            userId: uid
          })
          ws.game = game
          game.players[uid] = new Player(uid)
        }
      }

      if(data.create_game) {
        const game = new Game(generateUniqueId(), crypto.randomBytes(16).toString("hex"))
        games[game.gameId] = game
        ws.game = game
        send({
          page: "root/root.html",
          gameId: game.gameId,
          ownerKey: game.ownerKey,
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