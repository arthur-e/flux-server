var core = require('../core').core;
var moment = require('../node_modules/moment/moment');
var numeric = require('numeric');
var _ = require('underscore');

// GET Parameters:
//
//     aggregate   [Optional]  Used with: coords, interval, start, end, geom
//     coords      [Optional]  Used with: aggregate, interval, start, end
//     end         [Optional]  Used with: aggregate, coords, interval, start, geom
//     geom        [Optional]  Used with: aggregate, coords, start, end
//     interval    [Optional]  Used with: aggregate, coords, start, end
//     start       [Optional]  Used with: aggregate, coords, interval, end, geom
//
//     Valid combinations:
//       (coords),
//       (coords, start, end),
//       (coords, start, end, aggregate),
//       (coords, start, end, aggregate, interval),
//       (geom, start, end, aggregate)
//       (geom, start, end, aggregate, interval),
//       (start, end, aggregate, interval),
//       (start, end, aggregate),

function t (req, res) {

    var body, coords, grouping, i, idx, projection;
    var collection = core.DATA[req.params.scenario];
    var aggregate = {};

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

    // T Aggregation in Space or Time
    // ------------------------------

    if (_.has(req.query, 'aggregate')) {

        // aggregate parameter constraints
        if (!_.contains(['positive', 'negative', 'net', 'mean', 'min', 'max'], req.query.aggregate)) {
            return res.send(400, 'Bad Request');
        }

        // geom
        if (_.has(req.query, 'geom')) {

            return res.send(501, 'Not Implemented'); //TODO

        // coords
        } else if (_.has(req.query, 'coords')) {

            if (!_.has(req.query, 'interval')) {
                return res.send(400, 'Bad Request');
            }

            // interval parameter constraints
            if (!_.contains(['daily', 'monthly', 'annual'], req.query.interval)) {
                return res.send(400, 'Bad Request');
            }

            // Get the integer value of the cell index
            coords = core.pointCoords(req.query.coords);
            idx = core.getCellIndex(coords, req.params.scenario);

            if (idx === undefined) {
                return res.send(400, 'Bad Request');
            }

            collection.find({
                '_id': {
                    '$gte': new Date(req.query.start),
                    '$lte': new Date(req.query.end)
                }
            }).toArray(function (err, docs) {
                var i = j = 0
                var unit, t1;
                var t0 = moment.utc(docs[0]._id);
                var ds = [];
                var operation, subop;

                if (err) console.log(err);

                subop = core.getSubOp(req.query.aggregate);

                unit = core.getIntervalUnit(req.query.interval);

                operation = function (series) {
                    return subop(_.map(series, function (serie) {
                        return serie.values[idx];
                    }));
                };

                t1 = t0.clone().add(1, unit);
                while (j < docs.length) {
                    if (moment.utc(docs[j]._id).isSame(t1) || moment.utc(docs[j]._id).isAfter(t1)) {
                        // Call the operation on the subsequence of data from the last
                        //  time point to the current
                        if (!moment.utc(docs[j]._id).isSame(t1)) {
                            ds.push(operation.call(this, docs.slice(i, j)));
                        } else {
                            ds.push(operation.call(this, docs.slice(i, j + 1)));
                        }

                        // Update the forward-looking timestamp
                        t1.add(1, unit);
                        i = j;
                    }

                    j += 1;
                }

                return res.send({
                    properties: {
                        aggregate: req.query.aggregate,
                        interval: req.query.interval,
                        start: req.query.start,
                        end: req.query.end,
                        coords: 'POINT(' + coords.join(' ') + ')'
                    },
                    series: _.map(ds, function (d) {
                        return Number(d.toFixed(core.PRECISION));
                    })
                });

            });

        // interval? && start && end && aggregate
        } else {

            if (_.has(req.query, 'interval')) {
                // interval parameter constraints
                if (!_.contains(['daily', 'monthly', 'annual'], req.query.interval)) {
                    return res.send(400, 'Bad Request');
                }

                projection = core.INTERVALS[req.query.interval];
                grouping = {
                    'year': '$year',
                    'month': '$month',
                    'day': '$day',
                    'hour': '$hour',
                    'minute': '$minute'
                };

            } else {
                // Default to the temporal resolution of the data (no temporal
                //  aggregation)
                projection = {
                    '_id': '$_id',
                    'values': '$values'
                };
                grouping = '$_id';
            }

            // positive || negative
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
                        '_id': {
                            $gte: new Date(req.query.start),
                            $lte: new Date(req.query.end)
                        }
                    }
                }, {
                    '$project': projection
                }, {
                    '$unwind': '$values'
                }, {
                    '$match': {
                        'values': aggregate
                    }
                }, {
                    '$group': {
                        '_id': grouping,
                        'values': { '$sum': '$values' }
                    }
                }, {
                    '$sort': {
                        '_id': 1
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
                            aggregate: req.query.aggregate,
                            interval: req.query.interval,
                            start: req.query.start,
                            end: req.query.end
                        },
                        series: _.map(results, function (doc) {
                            return Number(doc.values.toFixed(core.PRECISION));
                        })
                    });
                });

            // net || mean || min || max
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
                    '$project': projection
                }, {
                    '$unwind': '$values'
                }, {
                    '$group': {
                        '_id': grouping,
                        'values': aggregate
                    }
                }, {
                    '$sort': {
                        '_id': 1
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
                            aggregate: req.query.aggregate,
                            interval: req.query.interval,
                            start: req.query.start,
                            end: req.query.end
                        },
                        series: _.map(results, function (doc) {
                            return Number(doc.values.toFixed(core.PRECISION));
                        })
                    });
                });

            }

        }

    // T Filtering in Space, by a single cell
    // --------------------

    } else if (_.has(req.query, 'coords')) {
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
                series: items.map(function (v, i) {
                    return Number(v.values[idx].toFixed(core.PRECISION));
                }),
                properties: {
                    start: req.query.start,
                    end: req.query.end,
                    coords: coords
                }
            }

            // Send the response as a json object
            res.send(body);
        });
	
    // T Filtering in Space, by a multiple cells
    // --------------------

    } else if (_.has(req.query, 'geom')) {
        core.checkGeometryCollection(req, res, core.runGeomQuery);

    } else {
        return res.send(400, 'Bad Request');

    }

};

exports.t = t;


