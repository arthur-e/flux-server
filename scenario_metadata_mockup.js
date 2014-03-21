use fluxvis;

//Array of scenario names
//I added a "default" scenario just to
//capture the index we've been using and
//make sure it's the first in the list,
//but it's a bit of a hack and can be 
//remove if you want.
var scenarios = [
"zerozero_casa_all_10twr",
"zerofull_orch_all_10twr",
"zerozero_orch_all_10twr",
"zerofull_casa_1pm_35twr",
"zerozero_casa_1pm_35twr",
"zerofull_orch_1pm_35twr",
"zerozero_orch_1pm_35twr",
"zerofull_casa_shortaft_35twr",
"zerozero_casa_shortaft_35twr",
"zerofull_orch_shortaft_35twr",
"zerofull_casa_1pm_10twr",
"zerozero_orch_shortaft_35twr",
"zerofull_casa_all_35twr",
"zerozero_casa_all_35twr",
"zerofull_orch_all_35twr",
"zerozero_orch_all_35twr",
"zerozero_casa_1pm_10twr",
"zerofull_orch_1pm_10twr",
"zerozero_orch_1pm_10twr",
"zerofull_casa_shortaft_10twr",
"zerozero_casa_shortaft_10twr",
"zerofull_orch_shortaft_10twr",
"zerozero_orch_shortaft_10twr",
"zerofull_casa_all_10twr"]

var cidx = [];

//Grab the default coordinate index
var cidx = db.coord_index.findOne().i;

//Drop the old collection now that we have the default index
db.scenarios.drop();
//Create the collection again
db.createCollection("scenarios");

//Duplicate the index for each scenario

var tmp = {
  _id : "",
  dates : [
    "2003-12-22T03:00:00",
    "2005-01-01T00:00:00"
  ],
  gridded : true,
  gridres : {
    units : "degrees",
    x : 0.5,
    y : 0.5
  },
  bboxmd5 : "6f3e33c145010bc74c5ccd3ba772f504",
  bbox: [
    -166.5,
    10.5,
    -50.5,
    69.5
  ],
  stats : {
    std : 1.4207932683672087,
    max : 11.880844558999808,
    min : -58.2154307932539,
    median : 0.3698203314372373,
    mean : -0.007135007262604506
  },
  
  spans: [],
  steps: [10800],
  intervals : [
    10800
  ]
  
}

for (var i = 0;i<scenarios.length;i++){ tmp._id=scenarios[i]; db.scenarios.save(tmp);}

