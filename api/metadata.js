var core                    = require('../core').core;
var numeric                 = require('numeric');
var _                       = require('underscore');

/**
    Returns the metadata associated with the specified scenario.
 */
function metadata(req, res){
  
    if (!req.params.scenario) return res.send(400, 'Bad Request');

    if (!(req.params.scenario in core.METADATA) || core.METADATA[req.params.scenario] === undefined) {
        return res.send(404, 'Not Found');
    }

    return res.send(core.METADATA[req.params.scenario]);

}

exports.metadata = metadata;
