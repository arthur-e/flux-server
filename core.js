// This file contains the application's shared state and a variety of convenience
// functions for handling requests. In particular, this file initializes:
// * The reference list of available scenarios
// * The reference list of metadata for those scenarios: the `metadata` collection in MongoDB
// * A stored index of geographic model cells: the `coord_index` collection in MongoDB

// Load dependencies
var mongo = require('mongodb').MongoClient;
var moment = require('./node_modules/moment/moment');
var _ = require('underscore');

// Global variables
// ----------------
var PROJ_DIR = '/usr/local/project/flux-server';

// Floating-point precision for measurement values
var PRECISION = 2;

// Floating-point precision for measurement variance (and covariance)
var VARIANCE_PRECISION = 3;

// The `INDEX` contains the ordered arrangement of model cells
var INDEX = {};

// These regular expressions are used to validate parts of API requests
var REGEX = {
    iso8601: /^\d{4}(-\d{2})?(-\d{2})?(T\d{2}:\d{2})?(:\d{2})?/,
    monthly: /^(\d{4})\-(\d{2})$/, // e.g. 2004-05
    yearly: /^(\d{4})/, // e.g. 2004
    wktPoint: /^POINT\((-?[\d\.]+)[ +]?(-?[\d\.]+)\)$/
};

// Pre-defined MongoDB queries
// ---------------------------

// This is a keyword lookup that translates between the user-friendly API
// description of aggregation and the MongoDB syntax (e.g., when we say "net"
// we mean the MongoDB `$sum` query of values)
var AGGREGATES = {
    'net': '$sum',
    'mean': '$avg',
    'min': '$min',
    'max': '$max',
    'positive': '$gte',
    'negative': '$lte'
};

// Like `AGGREGATES`, this is a lookup that maps user-friendly API descriptors
// to MongoDB query constructs
var INTERVALS = {
    'daily': {
        day: { '$dayOfYear': '$_id' },
        year: { '$year': '$_id' },
        values: 1
    },
    'weekly': {
        week: { '$week' : '$_id' },
        year: { '$year' : '$_id' },
        values: 1
    },
    'monthly': {
        month: { '$month': '$_id' },
        year: { '$year': '$_id' },
        values: 1
    },
    'annual': {
        year: { '$year': '$_id' },
        values: 1
    }
};

// These variables are initialized when the express app is first loaded (i.e.,
// when the server is started)
var db = null;
var scenarios = [];
var metadata = {};
var data = {};

// This is an object we export later that has a number of convenience functions
// as well as the most-important `init()` function which initializes the shared
// application state when the express app (the server) is first started
var core = {
    init: function (app) {
        var self = this;

        // [See discussion](https://groups.google.com/forum/#!msg/node-mongodb-native/mSGnnuG8C1o/Hiaqvdu1bWoJ) on this design pattern.
        mongo.connect('mongodb://localhost:27017/fluxvis', function (err, db) {
            var body = null;
            if (err) {
                return console.dir(err);
            }
            
            // Grab the list of scenarios stored in mongo
            db.collection('metadata').find({}, {
                '_id':1
            }).toArray(function (err, results) {
                var i;
                for (i = 0; i < results.length; i+=1){
                    // Array containing the scenario strings. This is returned by the
                    // scenarios endpoint
                    scenarios.push(results[i]._id);

                    data[results[i]._id] = db.collection(results[i]._id);

                };
            });

            // Grab the metadata
            db.collection('metadata').find().toArray(function (err, docs) {
                var i;
                for (i = 0; i < docs.length; i+=1) {
                    metadata[docs[i]._id] = docs[i];                    
                };
            });
            
            // Grab the indices
            db.collection('coord_index').find().toArray(function (err, idx) {
                var i;
                for (i = 0; i < idx.length; i+=1) {
                    INDEX[idx[i]._id] = idx[i].i;
                };
            });
            
            self.DB = db;

        });

        self.PROJ_DIR           = PROJ_DIR;
        self.PRECISION          = PRECISION;
        self.VARIANCE_PRECISION = VARIANCE_PRECISION;
        self.INDEX              = INDEX;
        self.REGEX              = REGEX;
        self.AGGREGATES         = AGGREGATES;
        self.INTERVALS          = INTERVALS;
        self.SCENARIOS          = scenarios;
        self.METADATA           = metadata;
        self.DATA               = data;

        self.app = (app) ? app : null;

    },

    // Convenience functions
    // ---------------------
    
    // `checkGeometryCollection()` retrieves an existing geometry
    // collection for the requested scenario, creates one if it does not exist,
    // and passes the result to a callback function.
    checkGeometryCollection: function (req, res, callback) {
        // Variable representing the name of the MongoDB geometry collection
        // for the specified scenario
        var n = '_geom_' + req.params.scenario; 
        
        this.DB.collectionNames(n, function(err, items) {
            if (err) {
                res.send(404, 'MongoDB error: could not get collection names');
            }
            
            // If geometry collection does not exist, create it
            if (items.length === 0) {
                var geom_coll = core.getGeomCollection(req.params.scenario);
                
                // Build geometry collection from the cooresponding
                // `coord_index` document
                geom_coll.insert(core.INDEX[req.params.scenario].map(function (x, i) {
                        return {'ll': x, 'idx': i};
                    }),
                    {safe: true},
                    function(err, result) {
                        if (err) {return res.send(404, 'Error converting index to geometry row');}
                        
                        // Add geometry index to faciliate spatial queries
                        geom_coll.ensureIndex({'ll':'2dsphere'}, function(err, result) {
                            if (err) {
                                return res.send(404, 'Failed to create index on geometry collection');
                            }
                            callback(req, res);
                        });
                    });
            
            // Otherwise just throw the callback
            } else {
                callback(req, res);
            }
        });
    },
    
    // `getIntervalUnit()` translates between user-friendly API time descriptors
    // and MongoDB time descriptors
    getIntervalUnit: function(interval) {
        switch (interval) {
            case 'hourly':
            unit = 'hour';
            break;

            case 'daily':
            unit = 'day';
            break;
            
            case 'weekly':
            unit = 'week';
            break;

            case 'monthly':
            unit = 'month';
            break;
            
            case 'quarterly':
            unit = 'quarter';
            break;
            
            case 'yearly':
            unit = 'year';
            break;
        }
        
        return unit;
    },

    // `getSubOp()` returns a reducer (function) based on the type of
    // aggregation operation requested
    getSubOp: function(aggregate) {
        switch (aggregate) {
            case 'positive':
            subop = function (s) {
                return _.reduce(s, function (memo, v) {
                    return (v > 0) ? memo + v : memo;
                }, 0);
            };
            break;

            case 'negative':
            subop = function (s) {
                return _.reduce(s, function (memo, v) {
                    return (v < 0) ? memo + v : memo;
                }, 0);
            };
            break;

            case 'net':
            subop = function (s) {
                return _.reduce(s, function (memo, v) {
                    return memo + v;
                }, 0);
            };
            break;

            case 'mean':
            subop = function (s) {
                return _.reduce(s, function (memo, v) {
                    return (memo + v) * 0.5;
                }, 0);
            };
            break;

            case 'min':
            subop = _.min;
            break;

            case 'max':
            subop = _.max;
            break;
        }
        
        return subop;
    },

    // `pointCoords()` is a function that, given a WKT Point string,
    // extracts and returns the coordinates
    pointCoords: function (wktPointString) {
        if (REGEX.wktPoint.test(wktPointString)) {
            return (function () {
                var r = REGEX.wktPoint.exec(wktPointString);
                return r.slice(1, 3).map(Number);
            }());

        }

    },

    // `polyCoords()` is a function that, given a WKT Polygon string,
    // extracts and returns the coordinates; does not support MultiPolygons
    polyCoords: function (wktPolyString) {

        // TODO: could improve with RegExp like above
        var c = wktPolyString.replace('POLYGON((', '').replace('))', '').split(',');
        
        return [c.reduce(function(accum, current) {
                    // This .reduce removes adjacent duplicates; they will cause DB errors
                    if (accum[accum.length-1] != current) {
                        accum.push(current);
                    }
                    return accum;
                }, [])
                .map(function (v) {
                    // This map splits the coordinates into arrays
                    return v.split('+').map(Number);
                })];
},

    // `runGeomQuery()` runs a polygon geometry query and posts HTTP response
    // as a JSON object
    runGeomQuery: function(req, res) {
        var indices = [];
        var geom_coll =  core.getGeomCollection(req.params.scenario); 
        var collection = core.DATA[req.params.scenario];

        // Get coordinate array from WKT Polygon specification
        coords = core.polyCoords(req.query.geom);
            
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
            
            // We need separate functions for gridded/non-gridded data:
            // * For gridded data, the '_id' field represents date/time
            // * For non-gridded data, the 'timestamp' field represents date/time

            // Here, we assume that if the 'timestamp' property exists, it's
            // non-gridded
            var gridded = core.METADATA[req.params.scenario]['gridded'];
            var query = {};
            var dt_start = new Date(req.query.start);
            var dt_end = new Date(req.query.end);
            
            if (gridded) {
                query['_id'] = {
                    '$gte': dt_start,
                    '$lte': dt_end
                };
            }
           
            collection.find(query).toArray(function (err, itemsAll) {
                if (err) {return console.log(err); }

                if (itemsAll.length === 0) {
                    return res.send(404, 'No results found');
                } else if (gridded && !itemsAll[0].hasOwnProperty('values')) {
                    return res.send(404, 'Query results for gridded data do not have "values" property');
                } else if (!gridded &&
                           !itemsAll[0].hasOwnProperty('properties') &&
                           !itemsAll[0]['properties'].hasOwnProperty('value')) {
                    return res.send(404, 'Query results for non-gridded data do not have [properties][value]');
                }

                // Filter by geometry
                items = [];
                if (gridded) {
                    itemsAll.forEach(function (item) {
                        var vals = indices.map(function (idx) {
                            return Number(item.values[idx]);
                        });
                        
                        items.push({'_id': item['_id'],
                                    'values': vals});
                    });
                } else {
                    var tmp = indices.map(function (idx) {
                        return {'_id' : itemsAll[idx].timestamp,
                                'value' : Number(itemsAll[idx].properties.value)
                        };
                    });

                    // Filter by date for non-gridded data
                    tmp_d = {};
                    tmp.forEach(function (item) {
                        if (item._id >= dt_start && item._id <= dt_end) {
                            if (!_.has(tmp_d, item._id)) {
                                tmp_d[item._id] = [];
                            }
                            tmp_d[item._id].push(item.value);
                        }
                    });

                    items = Object.keys(tmp_d).sort().map(function (d) {
                        return {'_id' : d, 'values': tmp_d[d]};
                    });
                }
                
                // Aggregate by time via 'interval' parameter
                var times = [];
                var sortByDateTimeAsc = function (l, r)  {
                    var lhs = moment.utc(new Date(l));
                    var rhs = moment.utc(new Date(r));
                    return lhs > rhs ? 1 : lhs < rhs ? -1 : 0;
                }
                
                if (_.has(req.query, 'interval')) {
                    ds = {};
                    items.forEach(function (item) {
                        t = moment.utc(item._id).startOf(core.getIntervalUnit(req.query.interval));
                        if (!_.has(ds, t)) {
                            ds[t] =  {'sums': item.values,
                                      'n': 1}
                        } else {
                            ds[t]['n'] += 1
                            ds[t].sums = ds[t].sums.map(function (x, i) {return x + item.values[i]});
                        } 
                    });

                    items = Object.keys(ds).sort(sortByDateTimeAsc).map(function (k) {
                        return ds[k].sums.map(function (s) {
                            return s / ds[k].n;  // aggregate is implemented here                      
                        });                    
                    });
                    times = Object.keys(ds).sort(sortByDateTimeAsc);
                    
                } else {
                    items = items.map(function (item) {
                        return item.values;
                    });
                    times = items.map(function (item) {
                        return item._id;
                    });
                    
                }
                
                // And spatially aggregate by `geom`
                var mean = [],
                    max = [],
                    min = [],
                    std = [],
                    n = [],
                    allVals = [],
                    allN = 0;

                items.forEach(function (vals) {
                    mean.push(Number(core.getAverage(vals).toFixed(core.PRECISION)));
                    std.push(Number(core.getStandardDeviation(vals).toFixed(core.PRECISION)));
                    min.push(Number(Math.min.apply(null, vals).toFixed(core.PRECISION)));
                    max.push(Number(Math.max.apply(null, vals).toFixed(core.PRECISION)));
                    n.push(vals.length);
                    allVals = allVals.concat(vals);
                });
                
                allN = n.reduce(function(a, b) {
                    return a + b;
                }, 0)
                
                body = {
                    seriesMean: mean,
                    seriesMin: min,
                    seriesMax: max,
                    seriesSTD: std,
                    seriesN: n,
                    seriesT: times,
                    properties: {
                        start: req.query.start,
                        end: req.query.end,
                        geom: coords,
                        interval: req.query.interval,
                        allMean: Number(core.getAverage(allVals).toFixed(core.PRECISION)),
                        allMax: Number(Math.max.apply(null, allVals).toFixed(core.PRECISION)),
                        allMin: Number(Math.min.apply(null, allVals).toFixed(core.PRECISION)),
                        allSTD: Number(core.getStandardDeviation(allVals).toFixed(core.PRECISION)),
                        allN: allVals.length
                    }
                }

                // Send the response as a JSON object
                res.send(body);
            });
        });
    },
    
    
    // `uncertaintyTime()` extracts and formats a keyword representation
    // of a time unit from a `String`
    // 
    //     @param  timeString  {String}
    //     @return             {Number || String}

    uncertaintyTime: function (timeString) {
        // As of this time, only monthly and annual (yearly) uncertainties are available
        if (REGEX.monthly.test(timeString)) {
            // The month of the year e.g. '5'
            return Number(REGEX.monthly.exec(timeString).pop()).toString();

        } else if (REGEX.yearly.test(timeString)) {
            return 'ann'; // Short for "annual"; multi-year data not known or available

        }

    },

    // `getAverage()` calculates the mean from an array of numbers
    //
    //      @param  data    {Array}       e.g. [3,4,-9]
    //      @return         {Number}
    
    getAverage: function (data) {
        var sum = data.reduce(function (sum, value) {
            return sum + value;
        }, 0);
        return sum / data.length;
    },
    
    // `getCellIndex()`, given point coordinates, looks up the index of the
    // corresponding resolution cell's coordinates
    //
    //     @param  coords  {Array}     e.g. [-83, 42]
    //     @param  scn     {String}    e.g. "zerozero_orch_shortaft_10twr"
    //     @return         {Number}    The index of the model resolution cell

    getCellIndex: function (coords, scn) {
        var i, idx;

        // Dirty validation. This could be improved, probably.
        if (INDEX[scn] === undefined) {
            return;
        }

        // Find the corresponding index of the grid cell
        i = 0;
        while (i < INDEX[scn].length) {
            if (INDEX[scn][i][0] === coords[0] && INDEX[scn][i][1] === coords[1]) {
                idx = i;
                break;
            }
            i += 1;
        }

        return idx;
    },
    
    // `getGeomCollection()` returns the geometry collection corresponding to a 
    // scenario collection
    getGeomCollection: function(scenario) {
        return this.DB.collection('_geom_' + scenario); 
    },

    // `getStandardDeviation()` calculates the standard deviation from an
    // `Array` of numbers
    getStandardDeviation: function (values) {
        var avg = this.getAverage(values);

        var squareDiffs = values.map(function (value){
            return Math.pow((value - avg), 2);
        });

        return Math.sqrt(this.getAverage(squareDiffs));
    }

};

exports.core = core;
