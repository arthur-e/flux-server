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

function scenario(req, res) {

    var scenario = req.params.scenario;


}


function scenario_list(req, res) {

    var scenario = req.params.scenario;
    

}