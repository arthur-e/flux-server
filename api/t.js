var core = require('../core').core;
var numeric = require('numeric');
var _ = require('underscore');
/**
    GET Parameters:
        aggregate       [Optional]  Used with: interval, start, end, geom
        coords          [Optional]  Used with: [None]
        end             [Optional]  Used with: aggregate, interval, start, geom
        geom            [Optional]  Used with: aggregate, start, end
        interval        [Optional]  Used with: aggregate, start, end
        start           [Optional]  Used with: aggregate, interval, end, geom

        Valid combinations:
            (coords),
            (start, end, aggregate, geom),
            (start, end, aggregate, interval),
            (start, end, aggregate),
 */

function t (req, res) {
    var body, coords, argument, i, idx;
    var collection = core.DATA[req.params.scenario];
    var aggregate = {};
    var interval = {};

    if (collection === undefined) {
        return res.send(404, 'Not Found');
    }

    if (!_.has(req.query, 'start') || !_.has(req.query, 'end')) {
        return res.send(400, 'Bad Request');
    }

    // start && end parameter constraints
    if (!core.REGEX.iso8601.test(req.query.start) || !core.REGEX.iso8601.test(req.query.end)) {
        return res.send(400, 'Bad Request');
    }

    numeric.precision = core.PRECISION;

    ////////////////////////////////////////////////////////////////////////////
    // T Data (Time Series) ////////////////////////////////////////////////////

    if (_.has(req.query, 'coords')) {
        coords = core.pointCoords(req.query.coords);
        idx = core.getCellIndex(coords, req.params.scenario);

        if (idx === undefined) {
            return res.send(404, 'Not Found');
        }

        collection.find({
            '_id': {
                '$gte': new Date(req.query.start),
                '$lte': new Date(req.query.end)
            }
        }).sort({'_id': 1}).toArray(function (err, items) {
            if (err) return console.log(err);

            if (items.length === 0) {
                return res.send(404, 'Not Found');
            } else if (!items[0].hasOwnProperty('values')) {
                return res.send(404, 'Not Found');
            }

            body = {
                'series': items.map(function (v, i) {
                    return Number(v.values[idx].toFixed(core.PRECISION));
                }),
                'properties': {
                    'start': req.query.start,
                    'end': req.query.end,
                    'coords': coords
                }
            }

            // Send the response as a json object
            res.send(body);
        });

    ////////////////////////////////////////////////////////////////////////////
    // T Aggregation in Space or Time //////////////////////////////////////////

    } else if (_.has(req.query, 'aggregate')) {

        // aggregate parameter constraints
        if (!_.contains(['positive', 'negative', 'net', 'mean', 'min', 'max'], req.query.aggregate)) {
            return res.send(400, 'Bad Request');
        }

        // geom ////////////////////////////////////////////////////////////////
        if (_.has(req.query, 'geom')) {

            return res.send(501, 'Not Implemented'); //TODO

        // start && end ////////////////////////////////////////////////////////
        } else {

            // start && end parameter constraints
            if (!core.REGEX.iso8601.test(req.query.start) || !core.REGEX.iso8601.test(req.query.end)) {
                return res.send(400, 'Bad Request');
            }

            if (_.has(req.query, 'interval')) {
                // interval parameter constraints
                if (!_.contains(['daily', 'monthly', 'annual'], req.query.interval)) {
                    return res.send(400, 'Bad Request');
                }

                // Need to define property names dependent on the query given
                // Creates object interval e.g. {'$dayOfYear': '$_id'}
                Object.defineProperty(interval, core.INTERVALS[req.query.interval], {
                    enumerable: true,
                    value: '$_id'
                });

            } else {
                // Default to the temporal resolution of the data (no temporal
                //  aggregation)
                interval = '$_id';
            }

            // positive || negative ////////////////////////////////////////////
            if (_.contains(['positive', 'negative'], req.query.aggregate)) {

                // Creates object aggregate e.g. {'$gte': 0}
                Object.defineProperty(aggregate, core.AGGREGATES[req.query.aggregate], {
                    enumerable: true,
                    value: 0
                });

                // New implementation using the aggregation framework.
                //  Response time averages around 4.3 seconds. 
                collection.aggregate({
                    '$match': {
                        _id: {
                            $gte: new Date(req.query.start),
                            $lte: new Date(req.query.end)
                        }
                    }
                }, {
                    '$unwind': '$values'
                }, {
                    '$match': {
                        values: aggregate
                    }
                }, {
                    '$group': {
                        '_id': interval,
                        values: { '$sum': '$values' }
                    }
                }, {
                    '$sort': { _id: 1 }
                }, {
                    '$project': { value: '$values' }

                }, function (err, results) {
                    if (err) {
                        if (err.code === 16389) {
                            return res.send(413, 'Request Entity Too Large');
                        }

                        return console.log(err);
                    }

                    return res.send({
                        properties: {
                            start: req.query.start,
                            end: req.query.end
                        },
                        series: _.map(results, function (doc) {
                            return Number(doc.value.toFixed(core.PRECISION));
                        })
                    });
                });

            // net || mean || min || max ///////////////////////////////////////
            } else {

                // Creates object aggregate e.g. {'$sum': '$values'}
                Object.defineProperty(aggregate, core.AGGREGATES[req.query.aggregate], {
                    enumerable: true,
                    value: '$values'
                });

                collection.aggregate({
                    '$match': {
                        '_id': {
                            '$gte': new Date(req.query.start),
                            '$lte': new Date(req.query.end)
                        }
                    }
                }, {
                    '$unwind': '$values'
                }, {
                    '$group': {
                        '_id': interval,
                        'values': aggregate
                    }
                }, {
                    '$sort': {
                        '_id': 1
                    }
                }, {
                    '$project': {
                        'value': '$values',
                    }
                }, function (err, results) {
                    if (err) {
                        if (err.code === 16389) {
                            return res.send(413, 'Request Entity Too Large');
                        }

                        return console.log(err);
                    }

                    return res.send({
                        properties: {
                            start: req.query.start,
                            end: req.query.end
                        },
                        series: _.map(results, function (doc) {
                            return Number(doc.value.toFixed(core.PRECISION));
                        })
                    });
                });

            }

        }

    }

};

exports.t = t;
