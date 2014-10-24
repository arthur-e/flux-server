var mongo = require('mongodb').MongoClient;
var moment = require('./node_modules/moment/moment');
var _ = require('underscore');
var PROJ_DIR = '/usr/local/project/flux-server';
var PRECISION = 2; // Floating-point precision for Flux measurements
var VARIANCE_PRECISION = 3; // Floating-point precision for Flux measurements
var INDEX = {}; // The INDEX contains the ordered arrangement of model cells
var REGEX = {
    iso8601: /^\d{4}(-\d{2})?(-\d{2})?(T\d{2}:\d{2})?(:\d{2})?/,
    monthly: /^(\d{4})\-(\d{2})$/, // e.g. 2004-05
    yearly: /^(\d{4})/, // e.g. 2004
    wktPoint: /^POINT\((-?[\d\.]+)[ +]?(-?[\d\.]+)\)$/
};
var AGGREGATES = {
    'net': '$sum',
    'mean': '$avg',
    'min': '$min',
    'max': '$max',
    'positive': '$gte',
    'negative': '$lte'
};
var INTERVALS = {
    'daily': {
        day: { '$dayOfYear': '$_id' },
        year: { '$year': '$_id' },
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
var db = null;
var scenarios = [];
var metadata = {};
var data = {};

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
                    //Array containing the scenario strings. This is returned by the
                    //scenarios endpoint
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
    
    // Retrieves an existing geometry collection for the requested scenario,
    // creates one if it does not exist, and passes the result to a
    // callback function.
    //
    //  @param  req             {Object}        HTTP get request
    //  @param  res             {Object}        HTTP response object
    //  @param  callback        {Function}      Callback function

    checkGeometryCollection: function (req, res, callback) {
        var n = '_geom_' + req.params.scenario; 
        
        this.DB.collectionNames(n, function(err, items) {
            if (err) {
                res.send(404, 'MongoDB error: could not get collection names');
            }
            
            // If geometry collection does not exist, create it
            if (items.length === 0) {
                var geom_coll = core.getGeomCollection(req.params.scenario);
                
                // Build geometry collection from the cooresponding coord_index document
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
    
    getIntervalUnit: function(interval) {
        switch (interval) {
            case 'hourly':
            unit = 'hour';
            break;

            case 'daily':
            unit = 'day';
            break;

            case 'monthly':
            unit = 'month';
            break;
        }
        
        return unit;
    },
    
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

    //  Given a WKT Point string, extracts and returns the coordinates:
    //
    //     @param  wktPointString  {String}  e.g. "POINT(-83 42)"
    //     @return                 {Array}   An array of the lat/long, e.g. [-83 42]

    pointCoords: function (wktPointString) {
        if (REGEX.wktPoint.test(wktPointString)) {
            return (function () {
                var r = REGEX.wktPoint.exec(wktPointString);
                return r.slice(1, 3).map(Number);
            }());

        }

    },

    //  Given a WKT Polygon string, extracts and returns the coordinates:
    //  TODO: this is going to be ugly. Make better with REGEX like above
    //  NOTE: does not currently support MULTIPOLYGON type
    //
    //     @param  wktPolygonString  {String}  e.g. "POLYGON((-83 42, -84 31,...))"
    //     @return                   {Array}   An array of lat/long arrays,
    //                                         e.g. [[-83 42],[-84 31],...]

    polyCoords: function (wktPolyString) {
        var c = wktPolyString.replace('POLYGON((', '').replace('))', '').split(',');

        return [c.map(function (v) {
            return v.split('+').map(Number);

        })];

    },

    //  Runs polygon geometry query and posts HTTP response as JSON object
    //
    //     @param  req  {Array}
    //     @param  res
    
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
            
            // Now get filter the data by date
            collection.find({
                '_id': {
                    '$gte': new Date(req.query.start),
                    '$lte': new Date(req.query.end)
                }
            }).sort({'_id': 1}).toArray(function (err, itemsAll) {
                if (err) {return console.log(err); }

                if (itemsAll.length === 0) {
                    return res.send(404, 'No data found within requested time period');
                } else if (!itemsAll[0].hasOwnProperty('values')) {
                    return res.send(404, 'Query results do not have "values" property');
                }

                // Filter by geometry
                items = [];
                itemsAll.forEach(function (item) {
                    var vals = indices.map(function (idx) {
                        return Number(item.values[idx]);
                    });
                    items.push({'_id': item._id,
                                'values': vals});
                });
                
                // Aggregate by time

                if (!_.has(req.query, 'interval')) {
                    ds = {};
                    items.forEach(function (item) {
                        t = moment.utc(item._id).format('YYYYMMDD');
                        
                        if (!_.has(ds, t)) {
                            ds[t] =  {'sums': item.values,
                                    'n': 1}
                        } else {
                            ds[t]['n'] += 1
                            ds[t].sums = ds[t].sums.map(function (x, i) {return x + item.values[i]});
                        } 
                    });

                    items = Object.keys(ds).sort().map(function (k) {
                        return ds[k].sums.map(function (s) {
                            return s / ds[k].n;                        
                        });
                    });
                } else {
                    items = items.map( function (item) {
                        return item.values;
                    });
                    
                }
                
                // And aggregate by geom
                var mean = [],
                    max = [],
                    min = [],
                    std = [],
                    n = [];


                items.forEach(function (vals) {
//                     var vals = indices.map(function (idx) {
//                         return Number(item.values[idx]);
//                     });

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
    },
    
    
    // Extracts and formats a keyword representation of a time unit from a String:
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

    // Just gets mean from an array of numbers
    //
    //  @param  data    {Array}       e.g. [3,4,-9]
    //  @return         {Number}
    
    getAverage: function (data) {
        var sum = data.reduce(function (sum, value) {
            return sum + value;
        }, 0);
        return sum / data.length;
    },
    
    // Given point coordinates, looks up the index of the corresponding resolution
    // cell's coordinates.
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
    
    // Returns the geometry collection corresponding to a 
    // scenario collection
    //
    //  @param  {String}              e.g. 'casa_gfed_2004'
    //  @return {MongoDB collection}
    
    getGeomCollection: function(scenario) {
        return this.DB.collection('_geom_' + scenario); 
    },

    // Just gets standard deviation from an array of numbers
    //
    //  @param  data    {Array}       e.g. [3,4,-9]
    //  @return         {Number}
    
    getStandardDeviation: function (values) {
        var avg = this.getAverage(values);

        var squareDiffs = values.map(function (value){
            return Math.pow((value - avg), 2);
        });

        return Math.sqrt(this.getAverage(squareDiffs));
    }

};

exports.core = core;
