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
    this.speed = 5

    this.ws = ws
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
    this.seeker = -1

    this.objects = []
    for(let i = 0; i < 100; i++)
      this.objects.push({
        x: Math.random() * 2.9 + 0.09,
        y: Math.random() * 2.9 + 0.09,
        width: Math.random() * .2 + .05,
        height: Math.random() * .2 + .05,
      })
  }

  start() {
    delete games[this.gid]
    // send all game_events
    let uids = Object.keys(this.players)
    this.seeker = uids[Math.floor(Math.random() * uids.length)]
    let gameEvents = Object.values(this.players).map(p => ({
        type: "playerMove",
        x: 0,
        y: 0,
        uid: p.uid
    })).concat([{
        type: "playerMessage", uid: "<server>",
        text: "The Game Started. Hide from the Square for 3 minutes!"
    }]).concat([{
        type: "gameStart",
        seeker: this.seeker
    }])

    // events for each player
    Object.values(this.players).forEach(p => p.send({gameEvents}))

    const me = this
    setTimeout(() => me.sid = setInterval(() => {me.schedule()}, 30), 5000);

    // End game, hiders win
    this.wt = setTimeout(() => {
      Object.values(this.players).forEach(p => {
          let type = "win"
          if(p.uid == this.seeker)
              type = "loose"

          p.send({
              gameEvents: [{
                  type: type
              }]
          })
      })
      delete this.wt
      this.destroy()
    }, 180000)
  }

  destroy() {
    this.seeker = -1
    clearInterval(this.sid)
    if(this.wt)
        clearTimeout(this.wt)
  }

    schedule() {
        const seeker = this.players[this.seeker]
        Object.values(this.players).forEach(p => {
            if(p.uid == seeker.uid)
                return
            const dis = Math.sqrt((seeker.x - p.x)**2 + (seeker.y - p.y)**2)
            if(dis < .04) {
                delete this.players[p.uid]
                if(Object.keys(this.players).length == 1) {
                    seeker.send({
                        gameEvents: [{
                            type: "win"
                        }]
                    })
                    this.destroy();
                }
                p.send({
                    gameEvents: [{
                        type: "loose"
                    }]
                })
                p.ws.close()
            }
        })
    }
}


const games = {}

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

        // handle game events
        switch(data.type) {
          // ---------------------------- HANDLE GAME EVENTS ------------
          case "playerMove": {
            // move to x y
            var x = data.x, y = data.y
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

      if(data.game_start && ws.owner == true) {
        ws.game.start()
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
        ws.owner = true
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
