// Load dependencies
var core = require('../core').core;
var numeric = require('numeric');
var _ = require('underscore');

function scenario (req, res) {
    var scn = req.params.scenario || req.query.scenario;
    var scns;

    // Only return the list of scenario names
    if (!scn) {
        if (!core.SCENARIOS) {
            return res.send(404, "Not Found");
        } else {
            scns = [];
            _.each(core.SCENARIOS, function (name) {
                scns.push(_.pick(core.METADATA[name], '_id', 'title', 'gridded'));
            });
            return res.send(scns);
        }
    }

    if (!(scn in core.METADATA) || core.METADATA[scn] === undefined) {
        return res.send(404, 'Not Found');
    }

    return res.send(core.METADATA[scn]);
}

exports.scenario = scenario;
