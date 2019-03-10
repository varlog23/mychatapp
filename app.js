const express = require("express");
const expresLayouts = require('express-ejs-layouts')
const mongoose = require('mongoose');
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('passport');
const socketio = require("socket.io");
const AYLIENTextAPI = require('aylien_textapi');
const ss = require('socket.io-stream');
const PORT = process.env.PORT || 4021;

// Aylien Config
const appId = require('./config/keys').aylienAppId;
const appKey = require('./config/keys').aylienAppKey;

// Create AYLIENTextAPI instace using AYLIEN credentials
var textapi = new AYLIENTextAPI({
  application_id: appId,
  application_key: appKey
});

const app = express();

// Passport Config
require('./config/passport')(passport);

// DB Config
const db = require('./config/keys').mongoURI;

// Used for testing locally
//const db = 'mongodb://localhost:27017/test';

// To use EJS
app.use(expresLayouts);
app.set('view engine', 'ejs');

// Express body parser
app.use(express.urlencoded({ extended: true }));

// Create a session middleware using Express session
app.use(
    session({
      secret: 'secret',
      resave: true,
      saveUninitialized: true
    })
);

// Create Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Connect flash
app.use(flash());

// Global variables - To have different colors for different messages(frontend)
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

// Routes
app.use('/', require('./routes/index'))
app.use('/users', require('./routes/users'))

const expressServer = app.listen(PORT, console.log(`Server started on port ${PORT}`));
//Socket server is listining to http server
const io = socketio(expressServer);
console.log('Server running...');

let users = [];
let connections = [];

mongoose.connect(db, { useNewUrlParser: true })
.then(() => {
  console.log('MongoDB connected...');

  io.on('connection',(socket)=>{
    connections.push(socket);
    console.log('Connected: %s sockets connected',connections.length);

    // Handle video message from client with stream
    ss(socket).on('file', function(stream, data) { 
      console.log('inside one');
        parts = []
        stream.on('data', function(chunk){
          parts.push(chunk);
        });        
        stream.on('end', function () {
          console.log('file received');
          //console.log(parts)
          let buf = Buffer.concat(parts);
          //console.log(buf);
          io.emit("videoToClients",{msg:buf, user: socket.username});
          socket.emit('status', {message: 'Message sent'});
        });
    });

    // When user logs in
    socket.on('newUserToServer',(data)=>{
      socket.username = data;
      users.push(socket.username);
      updateUserNames();
    });

    // When user logs out or disconnects
    socket.on('disconnect',(data)=>{
      users.splice(users.indexOf(socket.username),1);
      updateUserNames();
      connections.splice(connections.indexOf(socket),1);
      console.log('Disconnected: %s sockets connected',connections.length);
    });

    // Send list of users to all clients
    function updateUserNames(){
        io.emit("usersToClients",users);
    }    

    // Handle text message from client
    socket.on('newMessageToServer',(data)=>{
      textapi.sentiment({
        'text': data
          }, function(error, response) {
          if (error !== null) {
            console.log("Error: " + error);
            io.emit("messageToClients",{msg:data, user: socket.username, sentiment: "neutral"});
            socket.emit('status', {message: 'Message sent'});
          } else {
            io.emit("messageToClients",{msg:data, user: socket.username, sentiment: response.polarity});
            socket.emit('status', {message: 'Message sent'});
          }
        });
    });

    // Handle video message from client /* no longer used */
    socket.on('newVideoToServer',(data)=>{
      io.emit("videoToClients",{msg:data, user: socket.username});
      socket.emit('status', {message: 'Message sent'});
    });    
  
  });  
})
.catch(err => console.log(err));
