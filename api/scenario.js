var core                    = require('../core').core;
var numeric                 = require('numeric');
var _                       = require('underscore');

function scenario (req, res) {
    if (!(req.params.scenario || req.query.scenario)) {
        // Only return the list of scenario names
        if (!core.SCENARIOS) {
            return res.send(404, "Not Found");
        } else {
            return res.send(_.map(core.SCENARIOS, function (name) {
                return {
                    _id: name
                }
            }));
        }
    }

    var scn = req.params.scenario || req.query.scenario;

    if (!(scn in core.METADATA) || core.METADATA[scn] === undefined) {
        return res.send(404, 'Not Found');
    }

    return res.send(core.METADATA[scn]);
}

exports.scenario = scenario;
