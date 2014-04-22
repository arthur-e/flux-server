var core = require('../core').core;
var numeric = require('numeric');
var _ = require('underscore');

/**
    GET Parameters:
        time            [Optional]  Used with: [None]
        start           [Optional]  Used with: aggregate, end
        end             [Optional]  Used with: aggregate, start
        aggregate       [Optional]  Used with: start, end

        Valid combinations: (time), (start, end, aggregate)
 */
function xy (req, res) {
    var collection = core.DATA[req.params.scenario];
    var verbose = (_.has(req.query, 'verbose'));

    if (collection === undefined) {
        return res.send(404, 'Not Found');
    }
    
    numeric.precision = core.PRECISION;

    ////////////////////////////////////////////////////////////////////////////
    // XY Data (Maps) //////////////////////////////////////////////////////////

    if (_.has(req.query, 'time')) {
        var body, i;
        var argument = new Date(req.query.time); // Grab the date string from the query

        // Fetch the data from mongo and construct the GeoJSON response
        // Note that the mongo find query can use the date object instead
        // of a constructed date string
        collection.find({'_id': argument}).toArray(function (err, map) {
            if (err) return console.log(err);

            if (map.length === 0) {
                return res.send(404, 'Not Found');
            }

            if (verbose) {
                // Emit a GeoJSON-compliant FeatureCollection instead

                body = {
                    'timestamp': argument.toISOString(),
                    'type': 'FeatureCollection',
                    'features': []
                };

                map[0].values.forEach(function (v, i) {
                    body.features.push({
                        'type': 'Point',
                        'coordinates': core.INDEX[req.params.scenario][i],
                        'properties': {
                            'v': Number(v.toFixed(core.PRECISION)),
                        }
                    });
                });

             } else {
                body = {
                    'timestamp': argument.toISOString(),
                    'features': []
                };

                map[0].values.forEach(function (v, i) {
                    body.features.push(Number(v.toFixed(core.PRECISION)));
                });

            }

            // Send the response as a JSON object
            res.send(body);
        });

    ////////////////////////////////////////////////////////////////////////////
    // XY Aggregation in Time (Maps) ///////////////////////////////////////////

    } else if (_.has(req.query, 'aggregate')) {

        ['start', 'end'].forEach(function (key) {
            if (!_.has(req.query, key)) {
                return res.send(400, 'Bad Request');
            }
        });

        // start && end parameter constraints
        if (!core.REGEX.iso8601.test(req.query.start) || !core.REGEX.iso8601.test(req.query.end)) {
            return res.send(400, 'Bad Request');
        }

        // aggregate parameter constraints
        if (!_.contains(['positive', 'negative', 'net', 'mean', 'min', 'max'], req.query.aggregate)) {
            return res.send(400, 'Bad Request');
        }

        // Aggregation pipeline definition; can be modified later
        var definition = [{
            '$match': {
                '_id': {
                    '$gte': new Date(req.query.start),
                    '$lte': new Date(req.query.end)
                }
            }
        }, {
            '$sort': {'_id': 1}
        }]

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
        while (i < core.MODEL_CELLS) {
            result.push(0);
            i += 1;
        }

        // min || max //////////////////////////////////////////////////////////
        if (_.contains(['min', 'max'], req.query.aggregate)) {

            // Add the callback function to the argument list for the aggregate() pipeline
            definition.push(function (err, docs) {
                var i, tpl;

                // Sum two Arrays at a time to get the total flux value in each cell
                _.each(docs, function (doc, i) {
                    if (i === 0) { // Start with the first document...
                        result = doc.values;

                    } else { // ...Compare it to evey document afterwards
                        _.each(doc.values, function (value, j) {
                            if (req.query.aggregate === 'min') {
                                if (Number(value) < Number(result[j])) result[j] = value; // Update result with the max values
                            } else {
                                if (Number(value) > Number(result[j])) result[j] = value; // Update result with the min values
                            }
                        });

                    }
                });

                tpl = _.clone(template);
                tpl.features = _.chain(result).map(function (v) { // Convert to Number and fix precision
                    return Number(v.toFixed(core.PRECISION));
                }).map(function (value, i) { // Format response body
                    if (verbose) {
                        return {
                            'v': value,
                            'type': 'Point', // Required for compliant GeoJSON
                            'coordinates': core.INDEX[req.params.scenario][i]
                        };
                    }

                    return value;
                }).value()

                return res.send(tpl);

            });

        // mean || net || positive || negative /////////////////////////////////
        } else if (_.contains(['mean', 'net', 'positive', 'negative'], req.query.aggregate)) {

            // Add the callback function to the argument list for the aggregate() pipeline
            definition.push(function (err, docs) {
                var i, tpl;

                switch (req.query.aggregate) {

                    case 'negative':
                    // Sum two Arrays at a time to get the total flux value in each cell
                    _.each(docs, function (doc) {
                        result = numeric['+'](result, _.map(doc.values, function (v) {
                            return (v < 0) ? v : 0; // Sum only negative fluxes
                        }));
                    });
                    break;

                    case 'positive':
                    // Sum two Arrays at a time to get the total flux value in each cell
                    _.each(docs, function (doc) {
                        result = numeric['+'](result, _.map(doc.values, function (v) {
                            return (v > 0) ? v : 0; // Sum only positive fluxes
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
                    result = _.map(numeric.div(result, docs.length), function (v) {
                        return Number(v.toFixed(core.PRECISION));
                    });
                }

                tpl = _.clone(template);
                tpl.features = _.chain(result).map(function (v) { // Convert to Number and fix precision
                    return Number(v.toFixed(core.PRECISION));
                }).map(function (value, i) { // Format response body
                    if (verbose) {
                        return {
                            'v': value,
                            'type': 'Point', // Required for compliant GeoJSON
                            'coordinates': core.INDEX[req.params.scenario][i]
                        };
                    }

                    return value;
                }).value()

                return res.send(tpl);

            });

        } else {
            return res.send(400, 'Bad Request');

        }

        // Invoke the aggregation pipeline with the arguments and callback function definition
        collection.aggregate.apply(collection, definition) // Updates "result" variable


    } else {
        return res.send(400, 'Bad Request');

    }


};

exports.xy = xy;
