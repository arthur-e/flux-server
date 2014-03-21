var mongo                   = require('mongodb').MongoClient;
var PROJ_DIR                = '/usr/local/project/flux-d3';
var FLUX_PRECISION          = 2; // Floating-point precision for Flux measurements
var FLUX_VARIANCE_PRECISION = 3; // Floating-point precision for Flux measurements
var INDEX                   = {}; // The INDEX contains the ordered arrangement of model cells
var MODEL_CELLS             = 2635 // Number of resolution cells in the model
var REGEX                   = {
                                iso8601: /^\d{4}(-\d{2})?(-\d{2})?(T\d{2}:\d{2})?(:\d{2})?$/,
                                monthly: /^(\d{4})\-(\d{2})$/, // e.g. 2004-05
                                yearly: /^(\d{4})/, // e.g. 2004
                                wktPoint: /^POINT\((-?[\d\.]+)[ +]?(-?[\d\.]+)\)$/
                            };
var AGGREGATES              = {
                                'net': '$sum',
                                'mean': '$avg',
                                'min': '$min',
                                'max': '$max'
                            };
var INTERVALS               = {
                                'daily': '$dayOfYear',
                                'monthly': '$month',
                                'annual': '$year'
                            };
var db = null;
var scenarios   = [];
var metadata    = {};
var data        = {};

var core = 
{
    init: function(app){
        var self = this;

        // See discussion on this design pattern: https://groups.google.com/forum/#!msg/node-mongodb-native/mSGnnuG8C1o/Hiaqvdu1bWoJ
        mongo.connect('mongodb://localhost:27017/fluxvis', function (err, db) {
            var body = null;
            if (err) {return console.dir(err);}
            
            //Grab the list of scenarios stored in mongo
            db.collection('scenarios').find({},{'_id':1}).toArray(function(err,results){

                for (var i = 0; i < results.length; i++) 
                {
                    //Array containing the scenario strings. This is returned by the
                    //scenarios endpoint
                    scenarios.push(results[i]._id);

                    data[results[i]._id] = db.collection(results[i]._id);


                };                


            });

            //Grab the metadata
            db.collection('scenarios').find().toArray(function(err, docs) {
                for (var i = 0; i < docs.length; i++) {
                    metadata[docs[i]._id] = docs[i];                    
                };
            });
            
            //Grab the indices
            db.collection('coord_index').find().toArray(function (err, idx) {
                
                for (var i = 0; i < idx.length; i++) {
                    INDEX[idx[i]._id] = idx[i].i;

                };
            });

        });

        self.PROJ_DIR                = PROJ_DIR;
        self.FLUX_PRECISION          = FLUX_PRECISION;
        self.FLUX_VARIANCE_PRECISION = FLUX_VARIANCE_PRECISION;
        self.INDEX                   = INDEX;
        self.MODEL_CELLS             = MODEL_CELLS;
        self.REGEX                   = REGEX;
        self.AGGREGATES              = AGGREGATES;
        self.INTERVALS               = INTERVALS;
        self.SCENARIOS               = scenarios;
        self.METADATA                = metadata;
        self.DATA                    = data;
        self.DB                      = db;

        self.app = (app) ? app : null;


    },


    

    /**
        Generates a map function (for a map-reduce workflow) that will group values
        on the interval specified.
        @param  interval    {String}    e.g. "daily" || "monthly" || "annual"
        @param  aggregate   {String}    e.g. "positive" || "negative"
        @return             {Function}
     */
    getIntervalMapFunction: function (interval, aggregate) {
        if (aggregate === 'positive') {
            switch (interval) {
                case 'daily':
                    return function () {
                        var k = this._id.getUTCDate();
                        this.values.forEach(function (value) {
                            if (value > 0) emit(k, value);
                        });
                    }
                case 'monthly':
                    return function () {
                        var k = this._id.getMonth() + 1;
                        this.values.forEach(function (value) {
                            if (value > 0) emit(k, value);
                        });
                    }
                case 'annual':
                    return function () {
                        var k = this._id.getYear();
                        this.values.forEach(function (value) {
                            if (value > 0) emit(k, value);
                        });
                    }
            }

        } else {
            switch (interval) {
                case 'daily':
                    return function () {
                        var k = this._id.getUTCDate();
                        this.values.forEach(function (value) {
                            if (value < 0) emit(k, value);
                        });
                    }
                case 'monthly':
                    return function () {
                        var k = this._id.getMonth() + 1;
                        this.values.forEach(function (value) {
                            if (value < 0) emit(k, value);
                        });
                    }
                case 'annual':
                    return function () {
                        var k = this._id.getYear();
                        this.values.forEach(function (value) {
                            if (value < 0) emit(k, value);
                        });
                    }
            }

        }
    },

    /**
        Given a WKT Point string, extracts and returns the coordinates.
        @param  wktPointString  {String}    e.g. "POINT(-83 42)"
        @return                 {Number}    The index of the model resolution cell
     */
    pointCoords: function (wktPointString) {
        if (REGEX.wktPoint.test(wktPointString)) {
            return (function () {
                var r = REGEX.wktPoint.exec(wktPointString);
                return r.slice(1, 3).map(Number);
            }())

        }

    },

    /**
        Extracts and formats a keyword representation of a time unit from a String.
        @param  timeString  {String}
        @return             {Number || String}
     */
    uncertaintyTime: function (timeString) {
        // As of this time, only monthly and annual (yearly) uncertainties are available
        if (REGEX.monthly.test(timeString)) {
            // The month of the year e.g. '5'
            return Number(REGEX.monthly.exec(timeString).pop()).toString();

        } else if (REGEX.yearly.test(timeString)) {
            return 'ann'; // Short for "annual"; multi-year data not known or available

        }

    },


    /**
        Given point coordinates, looks up the index of the corresponding resolution
        cell's coordinates.
        @param  coords  {Array}     e.g. [-83, 42]
        @param  scn     {String}    e.g. "zerozero_orch_shortaft_10twr"
        @return         {Number}    The index of the model resolution cell
     */
    getCellIndex: function (coords, scn) {
        var i;

        //Dirty validation. This could be improved, probably.
        if (!INDEX[scn]) scn = "default";

        //TODO: Add error handling. If there's no matching scenario, or the length
        //      of the scenario index doesn't match the coords length, return an 
        //      error object describing the situation. Send an http response with
        //      the error text, so the user knows why it failed. Probably dump it 
        //      to the log, as well.
        

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
    }
};

exports.core = core;