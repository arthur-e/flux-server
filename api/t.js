// **This module contains the request handlers for all time series data
// requests.** These request handlers respond to requests on the `t.json`
// API endpoint.

// Load dependencies
var core = require('../core').core;
var moment = require('../node_modules/moment/moment');
var numeric = require('numeric');
var _ = require('underscore');

// The following `GET` parameters are supported; all are optional except for
// `start` and `end` parameters, required for every request:

// * `aggregate`; used with: `coords`, `interval`, `start`, `end`, `geom`
// * `coords`; used with: `aggregate`, `interval`, `start`, `end`
// * `end` **(Required)**; used with: `aggregate`, `coords`, `interval`, `start`, `geom`
// * `geom`; used with: `aggregate`, `coords`, `start`, `end`
// * `interval`; used with: `aggregate`, `coords`, `start`, `end`
// * `start` **(Required)**; used with: `aggregate`, `coords`, `interval`, `end`, `geom`

// The following are the only valid combinations of `GET` parameters:
//
//      (coords, start, end)
//      (coords, start, end, aggregate)
//      (coords, start, end, aggregate, interval)
//      (geom, start, end, aggregate)
//      (geom, start, end, aggregate, interval)
//      (start, end, aggregate, interval)
//      (start, end, aggregate)

function t (req, res) {

    var body, coords, grouping, i, idx, projection;
    var collection = core.DATA[req.params.scenario];
    var aggregate = {};

    if (collection === undefined) {
        return res.send(404, 'Not Found');
    }

    // `start` and `end` parameters are required
    if (!_.has(req.query, 'start') || !_.has(req.query, 'end')) {
        return res.send(400, 'Bad Request');
    }

    // `start` and `end` parameter constraints
    if (!core.REGEX.iso8601.test(req.query.start) || !core.REGEX.iso8601.test(req.query.end)) {
        return res.send(400, 'Bad Request');
    }

    numeric.precision = core.PRECISION;

    // Get aggregate time series
    // -------------------------

    if (_.has(req.query, 'aggregate')) {

        // `aggregate` parameter constraints
        if (!_.contains(['positive', 'negative', 'net', 'mean', 'min', 'max'], req.query.aggregate)) {
            return res.send(400, 'Bad Request');
        }

        // If `geom` parameter present... This hasn't been implemented yet!
        if (_.has(req.query, 'geom')) {

            return res.send(501, 'Not Implemented'); //TODO

        // Get aggregate time series at specific coordinates
        // -------------------------------------------------

        // If `coords` paramter present...
        } else if (_.has(req.query, 'coords')) {

            if (!_.has(req.query, 'interval')) {
                return res.send(400, 'Bad Request');
            }

            // `interval` parameter constraints
            if (!_.contains(['daily', 'monthly', 'annual'], req.query.interval)) {
                return res.send(400, 'Bad Request');
            }

            // Get the integer value of the cell indexg
            coords = core.pointCoords(req.query.coords);
            idx = core.getCellIndex(coords, req.params.scenario);

            if (idx === undefined) {
                return res.send(400, 'Bad Request');
            }

            // Query for data slices (MongoDB documents) that are within the
            // `start` and `end` date range
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

                // Figure out what kind of aggregation needs to be performed
                // based on the `aggregate` keyword provided; `subop` is a
                // reducer (function)
                subop = core.getSubOp(req.query.aggregate);

                // Similarly, figure out over what time interval aggregation is
                // to be performed (or, for no aggregation, at what time
                // intervals values should be returned) based on the `interval` keyword
                unit = core.getIntervalUnit(req.query.interval);

                // Define a map-reduce operation
                operation = function (series) {
                    return subop(_.map(series, function (serie) {
                        return serie.values[idx];
                    }));
                };

                // Get values at each valid time step (according to the number
                // of `unit`) to construct a time series
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

                // Finally, return a JSON response with appropriate metadata in
                // `properties` and the time `series` itself
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

        // Get aggregate time series aggregated across the entire spatial domain
        // ---------------------------------------------------------------------

        // Here, the time series returned may be aggregated in both space and
        // time; the entire spatial domain of the data is aggregated based on
        // the time `interval` specified.

        // If `interval` parameter used with `aggregate`...
        } else {

            if (_.has(req.query, 'interval')) {
                // `interval` parameter constraints
                if (!_.contains(['daily', 'monthly', 'annual'], req.query.interval)) {
                    return res.send(400, 'Bad Request');
                }

                // Determine what interval to aggregate the data to
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

            // For `positive` or `negative` aggregation...
            if (_.contains(['positive', 'negative'], req.query.aggregate)) {

                // Creates object aggregate e.g. {'$gte': 0}
                Object.defineProperty(aggregate, core.AGGREGATES[req.query.aggregate], {
                    enumerable: true,
                    value: 0
                });

                // This is a new implementation using the aggregation framework;
                // the response time averages around 4.3 seconds.

                // Call the MongoDB aggregation pipeline
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

            // For all other kinds of aggregation (`net`, `mean`, `min`, `max`)...
            } else {

                // Creates object aggregate e.g. `{'$sum': '$values'}`
                Object.defineProperty(aggregate, core.AGGREGATES[req.query.aggregate], {
                    enumerable: true,
                    value: '$values'
                });

                // Call the MongoDB aggregation pipeline
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

    // Get a raw time series for a single grid cell
    // --------------------------------------------

    // Here, the time series returned is not aggregated.

    } else if (_.has(req.query, 'coords')) {
        coords = core.pointCoords(req.query.coords);
        idx = core.getCellIndex(coords, req.params.scenario);

        if (idx === undefined) {
            return res.send(404, 'Not Found');
        }

        // Filter the MongoDB collection to the `start` and `end` date range...
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

            // Extract the value at the specified grid cell index `idx` for
            // every time slice
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

            // Send the response as a JSON object
            res.send(body);
        });
	
    // Get a raw time series for multiple grid cells
    // ---------------------------------------------

    // This isn't supported yet.

    } else if (_.has(req.query, 'geom')) {
        core.checkGeometryCollection(req, res, core.runGeomQuery);

    } else {
        return res.send(400, 'Bad Request');

    }

};

exports.t = t;


