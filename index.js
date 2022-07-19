const { WebcastPushConnection } = require('tiktok-live-connector');
const { Server } = require('socket.io');
const express = require('express');
const { createServer } = require('http');
const app = express();
const httpServer = createServer(app);


const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});


io.on('connection', (socket) => {
    console.info('New connection from origin', socket.handshake.headers['origin'] || socket.handshake.headers['referer']);
}
);

// Username of someone who is currently live
let tiktokUsername = "_ngocclinh2_";

// Create a new wrapper object and pass the username
let tiktokChatConnection = new WebcastPushConnection(tiktokUsername);

// Connect to the chat (await can be used as well)
tiktokChatConnection.connect().then(state => {
    console.info(`Connected to roomId ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect', err);
})

// Define the events that you want to handle
// In this case we listen to chat messages (comments)
tiktokChatConnection.on('chat', data => {
    io.emit('snedmesssa', data);
    console.log(`${data.uniqueId} (userId:${data.userId}) writes: ${data.comment}`);
})

// And here we receive gifts sent to the streamer
tiktokChatConnection.on('gift', data => {
    // io.emit('message', data);
    console.log(`${data.uniqueId} (userId:${data.userId}) sends ${data.giftId}`);
})

// And here we receive gifts sent to the streamer
tiktokChatConnection.on('like', data => {
    // io.emit('message', data);
    console.log(` live =${data.userId} `);
})


httpServer.listen(8081);