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
        return res.send(404, 'Aggregate queries are not yet implemented');
        
    } else if (_.has(req.query, 'geom')) {
        var indices = [];
        
        // Get coordinate array from WKT Polygon specification
        coords = core.polyCoords(req.query.geom);
        
        // Create an empty collection;
        var tmp = 'geomNew'; // TODO: temporary variable specifying geometry table- needs to correspond to the selected collection

        var geom_coll = core.DB.collection(tmp);

        //////////////////////////////////////////////
        // Get/create spatial grid from coord array


        // Below is leftover from original implementation
        // -deprecated b/c geom_tables should be built when data is loaded (via mediators)
        // -...unless I can find a non-messy way of creating on-the-fly as needed (it do not already exist)
        
//         //Remove an existing temporary collection
//         core.DB.collection(tmp, function (err, coll) {
//             coll.remove({}, function (err, removed) {
//                 if (err) {return res.send(404, 'Failed to remove existing collection');}
//             });
// 
//         });



//         geom_coll.insert(core.INDEX[req.params.scenario].map(function (x, i) {
//                 return {'ll': x, 'idx': i};
//             }),
//             {safe: true},
//             function(err, result) {
//                 if (err) {return res.send(404, 'Error converting index to geometry row');}
//             });
// 
//         geom_coll.ensureIndex({'ll':'2dsphere'}, function(err, result) {
//             if (err) {return res.send(404, 'Failed to create index on geometry collection');}
//         });
        

        //var geom_coll = core.createGeomCollectionFromCoordIndex(core.INDEX,core.DB, res);

        // Get array of cells that intersect w/ the provided geometry
        geom_coll.find({
            'll' : {
                '$geoIntersects': {
                    '$geometry': {
                        'type': 'Polygon',
                        'coordinates': coords
                    }
                }
            }
        }).toArray(function (err, points) {
            if (err) {return res.send(404, err); }
            
            if (points.length === 0) {
                return res.send(404, 'No results for geom query');
            } else if (!points[0].hasOwnProperty('ll')) {
                return res.send(404, 'Geom results do not have "ll" property');
            };

            var i;
            for (i = 0; i < points.length; i+=1) {
                indices.push(points[i].idx);
            };

            if (indices === undefined) {
                return res.send(404, 'Indices undefined');
            }
            
            // Now get filter the data by date
            collection.find({
                '_id': {
                    '$gte': new Date(req.query.start),
                    '$lte': new Date(req.query.end)
                }
            }).sort({'_id': 1}).toArray(function (err, items) {
                if (err) {return console.log(err); }

                if (items.length === 0) {
                    return res.send(404, 'No data found within requested time period');
                } else if (!items[0].hasOwnProperty('values')) {
                    return res.send(404, 'Query results do not have "values" property');
                }

                var mean = [],
                    max = [],
                    min = [],
                    std = [],
                    n = [];

                // And aggregate by geom
                items.forEach(function (item) {
                    var vals = indices.map(function (idx) {
                        return Number(item.values[idx]);
                    });

                    mean.push(Number(core.getAverage(vals).toFixed(core.PRECISION)));
                    std.push(Number(core.getStandardDeviation(vals).toFixed(core.PRECISION)));
                    min.push(Number(Math.min.apply(null, vals).toFixed(core.PRECISION)));
                    max.push(Number(Math.max.apply(null, vals).toFixed(core.PRECISION)));
                    n.push(vals.length);
                });

                body = {
                    seriesMean: mean,
                    seriesMin: min,
                    seriesMax: max,
                    seriesSTD: std,
                    seriesN: n,
                    properties: {
                        start: req.query.start,
                        end: req.query.end,
                        geom: coords
                    }
                }

                // Send the response as a json object
                res.send(body);
            });
        });

    } else {
        return res.send(400, 'Bad Request');

    }

};

exports.roi = roi;


