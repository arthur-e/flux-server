var core                    = require('../core').core;
var numeric                 = require('numeric');
var _                       = require('underscore');


function geometry(req, res){
  
  if(!req.params.scenario) return res.send(400, 'Bad Request');


  if (!(req.params.scenario in core.INDEX) || core.INDEX[req.params.scenario] === undefined) {
      return res.send(404, 'Not Found');
  }

  var idx = core.INDEX[req.params.scenario];
  var body = {type: "GeometryCollection", geometries:[]}
  for (var i = 0; i < idx.length; i++) {
    body.geometries.push({type:"Point", coordinates:idx[i]})    
  };

  return res.send(body);

}

exports.geometry = geometry;