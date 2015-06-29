// The Carbon Data Explorer Web API Server ("flux-server")
// =======================================

// **Documentation last updated: May 21, 2015**

// The Carbon Data Explorer Web API Server ("flux-server") is the software layer
// that handles client requests for data, queries the MongoDB database, and
// returns data in the appropriate format. It is intended to run on a local
// network or over the internet (i.e., on a remote server) to handle requests
// issued from the Carbon Data Explorer Web API Client ("flux-client").

// Load dependencies
var _       = require('underscore');
var fs      = require('fs')
var numeric = require('numeric');
var mongo   = require('mongodb').MongoClient;
var express = require('express');
var core    = require('./core').core;

// Route requires
// --------------
var xy        = require('./api/xy.js').xy;
var t         = require('./api/t.js').t;
var scenarios = require('./api/scenario.js').scenario;
var grid      = require('./api/grid.js').grid;
var forward   = require('./api/forward.js').forward;

// Express
// -------

// Set up the express app
var app = express();

// Specify that we want no spaces, no newlines in JSON responses
app.set('json spaces', 0);

// Initialize our app core
console.dir(core);
core.init()

// Static Files
// ------------

// Static files are served from these URLs (first argument)
app.use('/flux/', express.static(core.PROJ_DIR + '/public'));
app.use('/flux/shared', express.static(core.PROJ_DIR + '/node_modules'));

// API Routes
// ----------

app.use('/flux/api', express.static(core.PROJ_DIR + '/api'));

// Bring in all the routes here
app.get('/flux/api/scenarios.json', scenarios);
app.get('/flux/api/scenarios/:scenario.json', scenarios);
app.get('/flux/api/scenarios/:scenario/grid.json', grid);
app.get('/flux/api/scenarios/:scenario/xy.json', xy);
app.get('/flux/api/scenarios/:scenario/t.json', t);
app.get('/flux/api/forward.json', forward);


// Error Handling
// --------------

// If there's an error somewhere, instead of crashing the server, let the user
// know with a standard RESTful response: an HTTP 500 error
app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.send(500, 'Internal Server Error');
});

// Launch
// ------

app.listen(8080);
console.log('Listening on port 8080: http://localhost:8080');




