var request = require('request');

// Returns the response from the provided url
// Basically acts as a proxy for the client since
// making cross domain requests on client side leads to 
// Access-Control-Allow-Origin errors.
function forward (req, res) {
    var url = req.param('url');

    request.get(url, function (err, newres, body) {
        if (!err) {
            if (newres.statusCode == 200) {
                return res.send(body);
            } else {
                return res.send(400, 'Bad Request');
            }
        } else {
            return res.send(400, 'Error trying to retrieve URL');
            
        }   
    });
}

exports.forward = forward;