var core                    = require('../core').core;
var numeric                 = require('numeric');
var _                       = require('underscore');


function scenario(req, res) {

    if(!req.params.scenario) return res.send(400, 'Bad Request');
    

    if (!(req.params.scenario in core.METADATA) || core.METADATA[req.params.scenario] === undefined) {
        return res.send(404, 'Not Found');
    }

    else return res.send(core.METADATA[req.params.scenario]);
}


function scenario_list(req, res) {

    //Only return the list of scenario names
    if (!core.SCENARIOS) res.send(404, "Not Found");
    else res.send({scenarios:core.SCENARIOS});


}

exports.scenario = scenario;
exports.scenario_list = scenario_list;
