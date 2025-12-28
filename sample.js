// let http = require('http');

// http.createServer((req, res) => {
//     res.writeHead(200, {'Content-Type': 'text/html'});
//     res.end('<h1>Hello World</h1>');
// }).listen(3000, () => {
//     console.log('Server is running on port 3000');
// });

const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Hello World');
});


app.get('/contact/:id', (req, res) => {
    res.send(`Contact ${req.params.id}`);
});

app.get('/contact/:id/info', (req, res) => {
    res.send(`Contact ${req.params.id} info: ${req.query.name} ${req.query.age}`);
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});