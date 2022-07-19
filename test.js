const http = require('http');
const express = require('express');
const hostname = 'localhost';
const port = 3000;
const app = express();

const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Welcome to Node.js!\n');
});



server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
