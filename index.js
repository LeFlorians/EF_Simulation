const express = require("express")
const path = require("path")

const PORT = 8080;

// create express instance
const app = express()

// initialize body parser
app.use(express.json());

// serve static js
app.use(express.static("src/"))

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
const { Server } = require('ws');
 
const websocket = new Server({ port: 8082 });
websocket.on('connection', (ws) => {
   console.log('New client connected!'); 
   ws.on('close', () => console.log('Client has disconnected!'));
});
 
websocket.on('message', (evt) => {
  console.log("received message: " + evt.data)
})


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