var core                    = require('../core').core;
var numeric                 = require('numeric');
var _                       = require('underscore');
/**
    GET Parameters:
        coords          [Optional]  Used with: [None]
        roi             [Optional]  Used with: aggregate, start, end
        geom            [Optional]  Used with: aggregate, start, end
        start           [Optional]  Used with: aggregate, interval, end, geom, roi
        end             [Optional]  Used with: aggregate, interval, start, geom, roi
        aggregate       [Optional]  Used with: interval, start, end, geom, roi
        interval        [Optional]  Used with: aggregate, start, end

        Valid combinations: (coords), (start, end, aggregate, interval),
            (start, end, roi, aggregate), (start, end, geom, aggregate)
 */

function t(req, res) {
    var body, coords, argument, i, idx;

    var collection = core.DATA[req.params.scenario];

    if (collection === undefined) {
        return res.send(404, 'Not Found');
    }

    if (!_.has(req.query, 'start') || !_.has(req.query, 'end')) {
        return res.send(400, 'Bad Request');
    }

    numeric.precision = core.FLUX_PRECISION;

    ////////////////////////////////////////////////////////////////////////////
    // T Data (Time Series) ////////////////////////////////////////////////////

    if (_.has(req.query, 'coords')) {
        coords = core.pointCoords(req.query.coords);
        idx = core.getCellIndex(coords);

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
              'coordinates': coords,
                //'type': 'Point', // Required for compliant GeoJSON
              'properties': []
            }

            items.forEach(function (v, i) {
              body.properties.push({
                'flux': v.values[idx].toFixed(core.FLUX_PRECISION),
                'timestamp': v._id.toISOString().split('.')[0] // Round off excess precision
              });
            });

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

        // roi /////////////////////////////////////////////////////////////////
        if (_.has(req.query, 'roi')) {

            // roi parameter constraints
            if (!_.contains(['continent'], req.query.roi)) {
                return res.send(400, 'Bad Request');
            }

            // positive || negative ////////////////////////////////////////////
            if (_.contains(['positive', 'negative'], req.query.aggregate)) {

                collection.find({
                    '_id': {
                        '$gte': new Date(req.query.start),
                        '$lte': new Date(req.query.end)
                    }
                }).sort([['_id', 1]]).toArray(function (err, results) {
                    if (err !== null) console.log(err);

                    // Update the documents in the results
                    results = _.map(results, function (doc) {

                        // Sum the values, filtered to positive or negative only
                        doc.value = numeric.sum(_.map(doc.values, function (v) {
                            if (req.query.aggregate === 'positive') {
                                return (v > 0) ? v : 0;

                            } else {
                                return (v < 0) ? v : 0;

                            }

                        })).toFixed(core.FLUX_PRECISION);

                        // We've renamed the "values" field to "value"
                        delete doc.values;

                        return doc;
                    });

                    return res.send({
                        series: results
                    });
                });

            // net || mean || min || max ///////////////////////////////////////
            } else {

                // Need to define property names dependent on the query given
                var aggregate = {};

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
                }, {'$unwind': '$values'}, {
                    '$group': {
                        '_id': '$_id',
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
                    if (err !== null) console.log(err);

                    // Remove the milliseconds and UTC identifier
                    results = _.map(results, function (doc) {
                        doc._id = doc._id.toISOString().split('.').shift()
                        return doc;
                    });

                    return res.send({
                        series: results // aggregate outputs with "result" attribute
                    });
                });

            }

        // geom ////////////////////////////////////////////////////////////////
        } else if (_.has(req.query, 'geom')) {

            return res.send(501, 'Not Implemented'); //TODO


        // start && end ////////////////////////////////////////////////////////
        } else {

            // interval parameter constraints
            if (_.has(req.query, 'interval')) {
                if (!_.contains(['daily', 'monthly', 'annual'], req.query.interval)) {
                    return res.send(400, 'Bad Request');
                }
            }
        
            // start && end parameter constraints
            if (!core.REGEX.iso8601.test(req.query.start) || !core.REGEX.iso8601.test(req.query.end)) {
                return res.send(400, 'Bad Request');
            }

            // positive || negative ////////////////////////////////////////////
            if (_.contains(['positive', 'negative'], req.query.aggregate)) {

                //New implementation using the aggregation framework. Response time averages around 4.3 seconds. 
                collection.aggregate(
                {
                   $match: 
                    {
                        _id:
                        {
                            $gte: new Date(req.query.start), $lte: new Date(req.query.end)
                        }
                    }
                }, 

                {
                    $unwind: '$values'
                }, 

                {
                    $match: {values: {$gt: 0}}
                }, 

                {
                    $group: 
                    {
                        _id: {$month: '$_id'}, 
                        values: {'$sum': '$values'}
                    }
                }, 

                {
                    $sort: {_id: 1}
                }, 

                {
                    $project: {value: '$values'}
                }, 
                function (err, results) {
                    if (err !== null) console.log(err);

                    return res.send({
                        series: results // mapReduce outputs with "results" attribute
                    });
                });


            // net || mean || min || max ///////////////////////////////////////
            } else {

                // Need to define property names dependent on the query given
                var aggregate = {};
                var interval = {};

                // Creates object interval e.g. {'$dayOfYear': '$_id'}
                Object.defineProperty(interval, core.INTERVALS[req.query.interval], {
                    enumerable: true,
                    value: '$_id'
                });

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
                }, {'$unwind': '$values'}, {
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
                    if (err !== null) console.log(err);

                    return res.send({
                        series: results // aggregate outputs with "result" attribute
                    });
                });

            }

        }

    }

};

exports.t = t;