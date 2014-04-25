var core = require('../core').core;
var numeric = require('numeric');
var _ = require('underscore');

/**
    GET Parameters:
        time            [Optional]  Used with: covarianceAt
        covarianceAt    [Optional]  Used with: time
        source          [Optional]  Used with: start, end, target
        target          [Optional]  Used with: start, end, source
        start           [Optional]  Used with: end, source, target
        end             [Optional]  Used with: start, source, target

        Valid combinations: (time), (time, covarianceAt), (start, end),
            (start, end, source, target), (source, target)
 */
function uncert (req, res) {
    var argument, collection, coords, idx, start, end, source, target;

    collection = core.DATA[req.params.scenario];

    if (collection === undefined) {
        return res.send(404, 'Not Found');
    }

    numeric.precision = core.VARIANCE_PRECISION;

    // time ////////////////////////////////////////////////////////////////////
    if (_.has(req.query, 'time')) {

        argument = core.uncertaintyTime(req.query.time);

        if (!argument) return es.send(400, 'Bad Request');

        // covarianceAt ////////////////////////////////////////////////////////
        if (_.has(req.query, 'covarianceAt')) {
            coords = core.pointCoords(req.query.covarianceAt);
            idx = core.getCellIndex(coords);

            result = collection.find({
                '_id': String(argument) + '.' + String(idx)
            }).toArray(function (err, docs) {
                if (err) return console.log(err);
                if (docs.length === 0) return res.send(404, 'Not Found');

                body = {
                    'timestamp': argument,
                    'properties': {
                        'covarianceAt': {
                            'coordinates': coords
                        }
                    },
                    'features': []
                }

                docs[0].v.forEach(function (v, i) {
                    body.features.push({
                        'covariance': v.toFixed(core.VARIANCE_PRECISION),
                        'coordinates': core.INDEX[req.params.scenario][i]
                    });
                });

                // Send the response as a JSON object
                return res.send(body);

            });

        } else {

            collection.find({ // e.g. matches "ann.141" or "5.141"
                '_id': {'$regex': RegExp('^' + argument + '\\.\\d+$')}
            }).toArray(function (err, docs) {
                var i;

                if (err) return console.log(err);
                if (docs.length === 0) return res.send(404, 'Not Found');

                body = {
                    'timestamp': argument,
                    'features': []
                }

                docs.forEach(function (doc) {
                    var i = Number(doc._id.split('.').pop());

                    // For a covariance matrix: Insert Array at the proper index
                    //  and trim it according to its position--generates a
                    //  lower-triangular matrix
                    // Set outside the loop:
                    // body.values.length = core.INDEX[req.params.scenario].length;
                    //
                    // Then:
                    // body.values[i] = doc.v.slice(0, i + 1);

                    body.features.push({
                        'variance': doc.v[i].toFixed(core.VARIANCE_PRECISION),
                        'coordinates': core.INDEX[req.params.scenario][i]
                    });

                });

                // Send the response as a JSON object
                return res.send(body);
            });

        }

    } else if (_.has(req.query, 'source') || _.has(req.query, 'start')) {

        if (_.has(req.query, 'source')) {
            if (!_.has(req.query, 'target')) {
                return res.send(400, 'Bad Request');
            }

            // source, target, start, end //////////////////////////////////////
            if (_.has(req.query, 'start')) {
                if (!_.has(req.query, 'end')) return res.send(400, 'Bad Request');

                start = core.uncertaintyTime(req.query.start);
                end = core.uncertaintyTime(req.query.end);

                if (!start || !end || start === 'ann' || end === 'ann') return es.send(400, 'Bad Request');

                source = core.pointCoords(req.query.source);
                target = core.pointCoords(req.query.target);

                if (!source || !target) return es.send(400, 'Bad Request');

                return res.send(501, 'Not Implemented'); //TODO

            // source, target //////////////////////////////////////////////////
            } else {
                return res.send(501, 'Not Implemented'); //TODO

            }

        // start, end //////////////////////////////////////////////////////////
        } else if (_.has(req.query, 'start')) {

            if (!_.has(req.query, 'end')) return res.send(400, 'Bad Request');

            return res.send(501, 'Not Implemented'); //TODO

        }

    } else {
        return res.send(400, 'Bad Request');

    }

};



exports.uncert = uncert;
