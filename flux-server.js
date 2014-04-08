/**
 *	The Fluxvis app server
 */
var _       = require('underscore');
var fs      = require('fs')
var numeric = require('numeric');
var mongo   = require('mongodb').MongoClient;
var express = require('express');
var core    = require('./core').core;

// Route requires //////////////////////////////////////////////////////////////
var uncert  = require('./api/uncertainty.js').uncert;
var xy      = require('./api/xy.js').xy;
var t       = require('./api/t.js').t;
var stats   = require('./api/stats.js').stats;
var scenarios = require('./api/scenario.js').scenario;
var geom    = require('./api/geometry.js').geometry;

// Express /////////////////////////////////////////////////////////////////////

// Set up the express app
var app = express();

// No spaces, no newlines in JSON response
app.set('json spaces', 0);

// Initialize our app core
console.dir(core);
core.init()

////////////////////////////////////////////////////////////////////////////////
// Static Files ////////////////////////////////////////////////////////////////

app.use('/flux/', express.static(core.PROJ_DIR + '/public'));
app.use('/flux/shared', express.static(core.PROJ_DIR + '/node_modules'));

////////////////////////////////////////////////////////////////////////////////
// API Routes //////////////////////////////////////////////////////////////////

app.use('/flux/api', express.static(core.PROJ_DIR + '/api'));

//Bring in all the routes here
app.get('/flux/api/scenarios.json', scenarios);
app.get('/flux/api/scenarios/:scenario.json', scenarios);
app.get('/flux/api/scenarios/:scenario/geometry.json', geom);
app.get('/flux/api/scenarios/:scenario/uncertainty.json', uncert);
app.get('/flux/api/scenarios/:scenario/xy.json', xy);
app.get('/flux/api/scenarios/:scenario/t.json', t);

////////////////////////////////////////////////////////////////////////////////
// Error Handling //////////////////////////////////////////////////////////////

app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.send(500, 'Internal Server Error');
});

////////////////////////////////////////////////////////////////////////////////
// Launch //////////////////////////////////////////////////////////////////////
app.listen(8080);
console.log('Listening on port 8080: http://localhost:8080');




