// **This module contains the request handlers for all the spatial data requests
// (requests for X-Y, i.e., map data).** These request handlers respond to
// requests on the `xy.json` API endpoint.

// Load dependencies
var core = require('../core').core;
var numeric = require('numeric');
var _ = require('underscore');

// The following `GET` parameters are supported; all are optional but either
// `time` or both `start` and `end` must be used:

// * `time`; used with: (None)
// * `start`; used with: `aggregate`, `end`
// * `end`; used with: `aggregate`, `start`
// * `aggregate`; used with: `start`, `end`

// The following are the only valid combinations of `GET` request parameters:
//
//      (time)
//      (start, end)
//      (start, end, aggregate)

function xy (req, res) {
    var collection = core.DATA[req.params.scenario];
    var metadata = core.METADATA[req.params.scenario];
    var verbose = (_.has(req.query, 'verbose'));

    if (collection === undefined) {
        return res.send(404, 'Not Found');
    }
    
    numeric.precision = core.PRECISION;

    // Get a map for a specific time
    // -----------------------------

    if (_.has(req.query, 'time')) {
        var body, cursor, i;

        // Grab the date string from the query
        var argument = new Date(req.query.time);

        if (metadata.gridded) {
            // Gridded data are uniquely indexed
            cursor = collection.find({'_id': argument});
        } else {
            // Non-gridded data have non-unique IDs but a unique timestamp
            cursor = collection.find({'timestamp': argument});
        }

        // Fetch the data from MongoDB and construct the JSON response;
        // Note that MongoDB `find()` query can use the `Date` object instead
        // of a constructed date string
        cursor.toArray(function (err, map) {
            if (err) return console.log(err);

            if (map.length === 0 || !_.isArray(map[0].values)) {
                return res.send(404, 'Not Found');
            }

            // In verbose mode, emit a GeoJSON-compliant FeatureCollection
            if (verbose) {
                body = {
                    'timestamp': argument.toISOString(),
                    'type': 'FeatureCollection',
                    'features': []
                };

                map[0].values.forEach(function (v, i) {
                    if (!v) {
                        return;
                    }

                    body.features.push({
                        'type': 'Point',
                        'coordinates': core.INDEX[req.params.scenario][i],
                        'properties': {
                            'v': Number(v.toFixed(core.PRECISION)),
                        }
                    });
                });

            // Otherwise, emit a stripped-down version that uses fewer bytes
            } else {
                body = {
                    'timestamp': argument.toISOString(),
                    'features': [],
                    'properties': {
                        'source' : req.params.scenario
                    }
                };

                map[0].values.forEach(function (v, i) {
                    body.features.push((v) ? Number(v.toFixed(core.PRECISION)) : v);
                });

            }

            // Send the response as a JSON object
            return res.send(body);
        });

    // Get a map aggregated in time
    // ----------------------------

    } else if (_.has(req.query, 'aggregate')) {

        // Aggregating non-gridded data is not supported
        if (!metadata.gridded) {
            return res.send(501, 'Not Implemented');
        }

        if (!_.has(req.query, 'start') || !_.has(req.query, 'end')) {
            return res.send(400, 'Bad Request: xy.js; both "start" and "end" parameters required');
        }

        // `start` and `end` parameter constraints
        if (!core.REGEX.iso8601.test(req.query.start) || !core.REGEX.iso8601.test(req.query.end)) {
            return res.send(400, 'Bad Request: xy.js; "start" and/or "end" parameters are incorrectly formatted. "start" = ' + req.query.start + '; "end" = ' + req.query.end);
        }

        // `aggregate` parameter constraints
        if (!_.contains(['positive', 'negative', 'net', 'mean', 'min', 'max'], req.query.aggregate)) {
            return res.send(400, 'Bad Request: xy.js; "aggregate" parameter invalid');
        }

        // Aggregation pipeline definition; can be modified later
        var definition = [{
            '$match': {
                '_id': {
                    '$gte': new Date(req.query.start),
                    '$lt': new Date(req.query.end)
                }
            }
        }, {
            '$sort': {'_id': 1}
        }];

        // What the response body should look like
        var template = {
            'timestamp': req.query.start,
            'properties': {
                'start': req.query.start,
                'end': req.query.end
            },
            'features': []
        }

        // This will be consumed in one of the following conditionals
        var result = [];

        // Create an empty array
        i = 0;
        while (i < core.INDEX[req.params.scenario].length) {
            result.push(0);
            i += 1;
        }

        // `min` or `max` aggregation
        if (_.contains(['min', 'max'], req.query.aggregate)) {

            // Add the callback function to the argument list for the aggregate() pipeline
            definition.push(function (err, docs) {
                var i, tpl;

                if (err) {
                    if (err.code === 16389) {
                        return res.send(413, 'Request Entity Too Large');
                    }

                    return console.log(err);
                }

                // Sum two Arrays at a time to get the total flux value in each cell
                _.each(docs, function (doc, i) {
                    if (i === 0) { // Start with the first document...
                        result = doc.values;

                    } else { // ...Compare it to evey document afterwards
                        _.each(doc.values, function (value, j) {
                            if (req.query.aggregate === 'min') {
                                // Update result with the max values
                                if (Number(value) < Number(result[j])) result[j] = value;
                            } else {
                                // Or, update result with the min values
                                if (Number(value) > Number(result[j])) result[j] = value;
                            }
                        });

                    }
                });

                tpl = _.clone(template);

                // Convert to Number and fix precision
                tpl.features = _.chain(result).map(function (v) {
                    return Number(v.toFixed(core.PRECISION));
                }).map(function (value, i) {
                    // Format response body
                    if (verbose) {
                        return {
                            'v': value,
                            'type': 'Point',
                            'coordinates': core.INDEX[req.params.scenario][i]
                        };
                    }

                    return value;
                }).value()

                return res.send(tpl);

            });

        // `mean` or `net` or `positive` or `negative` aggregation
        } else if (_.contains(['mean', 'net', 'positive', 'negative'], req.query.aggregate)) {

            // Add the callback function to the argument list for the aggregate() pipeline
            definition.push(function (err, docs) {
                var i, tpl;

                if (err) {
                    if (err.code === 16389) {
                        return res.send(413, 'Request Entity Too Large');
                    }

                    return console.log(err);
                }

                switch (req.query.aggregate) {

                    case 'negative':
                    // Sum two Arrays at a time to get the total flux value in each cell
                    _.each(docs, function (doc) {
                        result = numeric['+'](result, _.map(doc.values, function (v) {
                            // Sum only negative fluxes
                            return (v < 0) ? v : 0;
                        }));
                    });
                    break;

                    case 'positive':
                    // Sum two Arrays at a time to get the total flux value in each cell
                    _.each(docs, function (doc) {
                        result = numeric['+'](result, _.map(doc.values, function (v) {
                            // Sum only posittive fluxes
                            return (v > 0) ? v : 0;
                        }));
                    });
                    break;

                    default:
                    // Sum two Arrays at a time to get the total flux value in each cell
                    _.each(docs, function (doc) {
                        result = numeric['+'](result, doc.values);
                    });
                    break;

                }

                if (req.query.aggregate === 'mean') {
                    // Divide by the number of Arrays thus summed
                    result = numeric.div(result, docs.length);
                }

                tpl = _.clone(template);
                tpl.features = _.chain(result).map(function (v) { // Convert to Number and fix precision
                    return Number(v.toFixed(core.PRECISION));
                }).map(function (value, i) {
                    if (verbose) {
                        return {
                            'v': value,
                            'type': 'Point',
                            'coordinates': core.INDEX[req.params.scenario][i]
                        };
                    }

                    return value;
                }).value()

                return res.send(tpl);

            });

        } else {
            return res.send(400, 'Bad Request: xy.js; error with "aggregate" parameter');

        }

        // Invoke the aggregation pipeline with the arguments and callback function definition
        collection.aggregate.apply(collection, definition)

	
    // Get a FeatureCollection of non-gridded spatial data
    // ---------------------------------------------------
    } else if (_.has(req.query, 'start') && _.has(req.query, 'end')) {

        // Returning more than a single time step not supported for gridded data
        if (metadata.gridded) {
            return res.send(501, 'Not Implemented');
        }

        // `start` and `end` parameter constraints
        if (!core.REGEX.iso8601.test(req.query.start) || !core.REGEX.iso8601.test(req.query.end)) {
            return res.send(400, 'Bad Request: xy.js; "start" and/or "end" parameters are incorrectly formatted. "start" = ' + req.query.start + '; "end" = ' + req.query.end);
        }

        collection.find({
            'timestamp': {
                '$gte': new Date(req.query.start),
                '$lt': new Date(req.query.end)
            }
        }, {'_id': 0}).toArray(function (err, features) {
            var body;

            if (err) return console.log(err);

            if (features.length === 0) {
                return res.send(404, 'Not Found');
            }

            if (verbose) {
                return res.send({
                    'type': 'FeatureCollection',
                    'features': _.map(features, function (feature) {
                        return {
                            'type': 'Feature',
                            'properties': _.extend({
                                'timestamp': feature.timestamp,
                                'source' : req.params.scenario
                            }, feature.properties),
                            'geometry': {
                                'type': 'Point',
                                'coordinates': feature.coordinates
                            }
                        };
                    })
                });

             } else {
                return res.send({
                    'features': features,
                    'properties': {
                        'source': req.params.scenario
                    }
                });

            }

        });

    } else {
        return res.send(400, 'Bad Request: unkown xy.js request error');

    }

};

exports.xy = xy;
