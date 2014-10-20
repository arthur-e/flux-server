var mongo = require('mongodb').MongoClient;
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

    
    // Creates a Mongo DB collection from a coord index
    //
    //  @param coordArray       {Array} e.g. [[-83, 40],[-84,40]]
    // 
    createGeomCollectionFromCoordIndex: function (i, mydb, res) {
        var tmp = '_geom';

        // Remove an existing temporary collection
        mydb.collection(tmp, function (err, collection) {
            collection.remove({}, function (err, removed) {});

        });

        // Create an empty collection;
        var collection = mydb.collection(tmp);
        collection.ensureIndex({'loc':'2dsphere'}, function(err, result) {});

        // Insert geom data from the coordinate array
        collection.insert(Object.keys(i).map(function (x) {return {'loc': i[x]}; }),
            {safe: true},
            function(err, result) {});

        return collection;

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
            return v.split(' ').map(Number);

        })];

//         if (REGEX.wktPoint.test(wktPointString)) {
//             return (function () {
//                 var r = REGEX.wktPoint.exec(wktPointString);
//                 return r.slice(1, 3).map(Number);
//             }())
// 
//         }

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

    getAverage: function (data) {
        var sum = data.reduce(function (sum, value) {
            return sum + value;
        }, 0);
        return sum / data.length;
    },

    getStandardDeviation: function (values) {
        var avg = this.getAverage(values);

        var squareDiffs = values.map(function (value){
            return Math.pow((value - avg), 2);
        });

        return Math.sqrt(this.getAverage(squareDiffs));
    }

};

exports.core = core;
