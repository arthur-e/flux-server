var core                    = require('../core').core;
var numeric                 = require('numeric');

// Returns summary statistics about the given scenario (collection).
function stats(req, res) {
  var collection = core.DATA['summary_stats'];

  // Fetch the data from mongo and send the JSON response
  collection.find({
        about_collection: req.params.scenario
    }).toArray(function (err, stats){
    if (err) return console.log(err);

    // Send the response as a json object
    res.json(stats[0]); 
  });

};

exports.stats = stats;