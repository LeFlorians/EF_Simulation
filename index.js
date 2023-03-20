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
      "abcdefghijklmnopqrstuvwxyz0123456789";

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
    this.uid = uid
    this.secret = secret
    this.x = 0
    this.y = 0

    this.ws = ws
    this.lastMoveTimestamp = 0
  }

  send(obj) {
    if(obj && this.ws)
      this.ws.send(JSON.stringify(obj))
  } 
}


class Game {
  constructor(id, secret) {
    this.currentId = 0;
    this.secret = secret
    this.gid = id
    this.players = {}
    this.messages = []

    this.objects = []
    for(let i = 0; i < 50; i++)
      this.objects.push({
        x: Math.random() * 3,
        y: Math.random() * 3,
        width: Math.random() * .1 + .2,
        height: Math.random() * .1 + .2,
      })
  }
  destroy() {
    clearInterval(this.sid)
    games.remove(this.gid)
  }
  startScheduler() {
    // 1 TPS
    this.sid = setInterval(() => {

      // events for each player
      Object.values(this.players).foreach(p => {

      })

    }, 1)
  }
}


const games = {}

// Anticheat constants
const maxVelocity = 10000 // units / second

const websocket = new WebSocketServer({ port: 8082 });
websocket.on('connection', (ws) => {
  const sendMe = (obj) => { ws?.send(JSON.stringify(obj)) };
    ws.on('close', () => {
      console.log('Client has disconnected!'); 
      if(ws.player?.ws) 
        ws.player.ws = null
    });

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
            const moveX = x - player.x, moveY = y - player.y
            // limit movement length to deltaTime
            const norm = Math.sqrt(moveX*moveX+moveY*moveY)
            if(norm > deltaTime * maxVelocity) {
              // Anticheat trigger
              x = moveX / deltaTime + player.x, y / moveY + player.y
              // also send to player
              sendMe({
                gameEvents: [{type: "playerMove", uid: player.uid, x, y}]
              })
              console.log("Anticheat trigger by player " + player.uid + ". His speed is " + norm / deltaTime)
            } // else x,y are good
            // update player timestamp
            player.lastMoveTimestamp = timestamp
            player.x = x, player.y = y

            // broadcast new positions
            Object.values(game.players).filter(p => p.uid != player.uid).forEach(p => 
              p.send({
                gameEvents: [{type: "playerMove", uid: player.uid, x, y}]
              })
            )

          }

          case "playerMessage": {
            let text = data.text
            if(!text)
              return

            text = text.replace(/(\r\n|\n|\r|\[|\])/gm, "");
            if(text.length > 256) {
              player.send({
                gameEvents: [{type: "playerMessage", uid: "<server>", 
                text: "Your message exceeded the maximum length of 256" }]
              })
              return
            }

            const msgEvent = {type: "playerMessage", uid: player.uid, text}
            // queue event
            game.messages.push(msgEvent)
            // limit saved messages to 32
            if(game.messages.length > 32)
              game.messages.shift()

            // relay and broadcast chat messages
            Object.values(game.players).forEach(p => 
              p.send({
                gameEvents: [msgEvent]
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
          let player, uid

          if(game.gid === data.gid && data.secret
              && (player = game.players[data.uid])?.secret === data.secret
              && player.ws == null) {
            uid = data.uid
            player.ws = ws
          } else {
            uid = game.currentId++
            player = game.players[uid] = new Player(uid, genSecret(), ws)
          }

          console.log("Client joins:", game)

          ws.game = game
          ws.player = player
          sendMe({
            page: "clients/client.html",
            uid: uid,
            gid: game.gid,
            secret: player.secret,

            // send all game_events
            gameEvents: Object.values(game.players).map(p => ({
              type: "playerMove",
              x: p.x,
              y: p.y,
              uid: p.uid
            })).concat(game.messages),

            gameObjects: game.objects
          })
        } else {
          console.log("Game not found")
        }
      }

      if(data.create_game) {
        let game
        if(data.secret && data.gid && (games[data.gid]?.secret === data.secret))
          game = games[data.gid]
        else 
          game = new Game(generateUniqueId(), genSecret())
        games[game.gid] = game
        ws.game = game
        sendMe({
          page: "root/root.html",
          gid: game.gid,
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