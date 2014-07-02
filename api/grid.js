var core                    = require('../core').core;
var numeric                 = require('numeric');
var _                       = require('underscore');

// Returns the model grid as a MultiPoint GeoJSON response.
function grid(req, res){
  
  if (!req.params.scenario) return res.send(400, 'Bad Request');

  if (!(req.params.scenario in core.INDEX) || core.INDEX[req.params.scenario] === undefined) {
      return res.send(404, 'Not Found');
  }

  var idx = core.INDEX[req.params.scenario];
  var body = {
    type: "MultiPoint",
    _id: req.params.scenario,
    coordinates: []
  }

  for (var i = 0; i < idx.length; i+=1) {
    body.coordinates.push(idx[i])
  };

  return res.send(body);

}

// Returns the model grid as a GeometryCollection GeoJSON response.
function geometryCollection(req, res){
  
  if(!req.params.scenario) return res.send(400, 'Bad Request');


  if (!(req.params.scenario in core.INDEX) || core.INDEX[req.params.scenario] === undefined) {
      return res.send(404, 'Not Found');
  }

  var idx = core.INDEX[req.params.scenario];
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
