var core = require('../core').core;
var moment = require('../node_modules/moment/moment');
var numeric = require('numeric');
var _ = require('underscore');

// GET Parameters:
//
//     aggregate   [Optional]  Used with: interval, start, end, geom
//     end         [Optional]  Used with: aggregate, interval, start, geom
//     geom        [Optional]  Used with: aggregate, start, end
//     interval    [Optional]  Used with: aggregate, start, end
//     start       [Optional]  Used with: aggregate, interval, end, geom
//
//     Valid combinations:
//       (geom, start, end)
//       (geom, start, end, aggregate)
//       (geom, start, end, aggregate, interval),


function roi (req, res) {
    var body, coords, grouping, i, idx, projection;
    var collection = core.DATA[req.params.scenario];
    var aggregate = {};

    if (collection === undefined) {
        return res.send(404, 'Collection not found');
    }

    if (!_.has(req.query, 'start') || !_.has(req.query, 'end')) {
        return res.send(400, '"start" and "end" query parameters required');
    }

    // start && end parameter constraints
    if (!core.REGEX.iso8601.test(req.query.start) || !core.REGEX.iso8601.test(req.query.end)) {
        return res.send(400, 'Bad Request');
    }

    numeric.precision = core.PRECISION;

    // T Aggregation in Space or Time
    // ------------------------------

    if (_.has(req.query, 'aggregate')) {
        return res.send(404, 'Aggregate queries are not yet supported for ROI statistics');
        
    } else if (_.has(req.query, 'geom')) {
        core.checkGeometryCollection(req, res, core.runGeomQuery);

    } else {
        return res.send(400, 'Bad Request');

    }

};


exports.roi = roi;


