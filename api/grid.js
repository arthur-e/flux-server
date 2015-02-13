// This module contains two functions for generating GeoJSON representations
// of grid cell geometry as HTTP responses. Grid cell geometry can either be
// represented and returned as a single GeoJSON MultiPoint geometry or as a
// GeometryCollection.

// Load dependencies
var core    = require('../core').core;
var numeric = require('numeric');
var _       = require('underscore');

// Returns the model grid as a MultiPoint GeoJSON response
var grid = function (req, res) {
    
    // If the user didn't include the `scenario` request parameter...
    if (!req.params.scenario) return res.send(400, 'Bad Request');

    // If the user specified a `scenario` that doesn't exist/ doesn't have a grid...
    if (!(req.params.scenario in core.INDEX) || core.INDEX[req.params.scenario] === undefined) {
        return res.send(404, 'Not Found');
    }

    // Get the grid cell index for that scenario
    var idx = core.INDEX[req.params.scenario];

    // Construct a GeoJSON MultiPoint representation of the grid cell geometry
    var body = {
        type: "MultiPoint",
        _id: req.params.scenario,
        coordinates: []
    }

    for (var i = 0; i < idx.length; i += 1) {
        body.coordinates.push(idx[i])
    };

    return res.send(body);

}

// Returns the model grid as a GeometryCollection GeoJSON response
var geometryCollection = function (req, res) {

    // If the user didn't include the `scenario` request parameter...
    if (!req.params.scenario) return res.send(400, 'Bad Request');

    // If the user specified a `scenario` that doesn't exist/ doesn't have a grid...
    if (!(req.params.scenario in core.INDEX) || core.INDEX[req.params.scenario] === undefined) {
        return res.send(404, 'Not Found');
    }

    // Get the grid cell index for that scenario
    var idx = core.INDEX[req.params.scenario];

    // Construct a GeoJSON GeometryCollection response template
    var body = {
        type: "GeometryCollection",
        _id: req.params.scenario,
        geometries: []
    }
    for (var i = 0; i < idx.length; i++) {
        body.geometries.push({type:"Point", coordinates:idx[i]})        
    };

    return res.send(body);

}

exports.grid = grid;
