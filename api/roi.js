// Load dependencies
var core = require('../core').core;
var moment = require('../node_modules/moment/moment');
var numeric = require('numeric');
var _ = require('underscore');

// The following `GET` parameters are supported; all are o:

// * `end` **(Required)**; used with: `interval`, `start`, `geom`
// * `geom` **(Required)**; used with: `start`, `end`
// * `interval` (Optional); used with: `start`, `end`
// * `start` **(Required)**; used with: 'interval`, `end`, `geom`

// The following are valid combinations of `GET` parameters; no combinations
// not listed here are valid:
//
//      (geom, start, end)
//      (geom, start, end, interval),

var roi = function (req, res) {
    var body, coords, grouping, i, idx, projection;
    var collection = core.DATA[req.params.scenario];
    var aggregate = {};

    if (collection === undefined) {
        return res.send(404, 'Collection not found');
    }

    if (!_.has(req.query, 'start') || !_.has(req.query, 'end')) {
        return res.send(400, '"start" and "end" query parameters required');
    }

    // `start` and `end` parameter constraints
    if (!core.REGEX.iso8601.test(req.query.start) || !core.REGEX.iso8601.test(req.query.end)) {
        return res.send(400, 'Bad Request');
    }

    numeric.precision = core.PRECISION;

    // T-dimension aggregation in space or time
    if (_.has(req.query, 'aggregate')) {
        return res.send(404, 'Aggregate queries are not yet supported for ROI statistics');
        
    } else if (_.has(req.query, 'geom')) {
        core.checkGeometryCollection(req, res, core.runGeomQuery);

    } else {
        return res.send(400, 'Bad Request');

    }

};

exports.roi = roi;
