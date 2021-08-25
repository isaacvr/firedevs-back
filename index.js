const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
let app = express();
let router = require('./api');
let bodyParser = require('body-parser');

app.use(morgan('dev'));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/dist'));
app.use('/api', router);
app.use(function(req, res) {
  return res.sendFile(__dirname + '/dist/index.html');
});

app.listen(4000, () => {
  console.log("Server running at http://localhost:4000");
});