define('utils', [ // Dependencies follow
    'underscore',
    'd3'
], function (_, d3) {

    return {

        gradient: { // Cynthia Brewer's diverging color ramps with 3 classes
            'BrBG': [ // Left-hand (lower) limit, mid-value, and right-hand limit (upper limit)
                d3.rgb(1, 102, 94),
                d3.rgb(245, 245, 245),
                d3.rgb(140, 81, 10),
            ],
            'PiYG': [
                d3.rgb(39, 100, 25),
                d3.rgb(247, 247, 247),
                d3.rgb(142, 1, 82)
            ],
            'PRGn': [
                d3.rgb(0, 68, 27),
                d3.rgb(247, 247, 247),
                d3.rgb(64, 0, 75)
            ],
            'PuOr': [
                d3.rgb(45, 0, 75),
                d3.rgb(247, 247, 247),
                d3.rgb(127, 59, 8)
            ],
            'RdYlBu': [
                d3.rgb(49, 54, 149),
                d3.rgb(255, 255, 255),
                d3.rgb(165, 0, 38)
            ],
            'RdGy': [
                d3.rgb(77, 77, 77),
                d3.rgb(255, 255, 255),
                d3.rgb(178, 24, 43)
            ]
        },

        linearColors: { // Our custom ramps derived from Brewer's but with monotonic saturation changes
            'BrBG': [
                d3.hsl(168, 1, 0.118),
                d3.hsl(175, 0.8, 0.23),
                d3.hsl(175, 0.6, 0.4),
                d3.hsl(171, 0.4, 0.653),
                d3.hsl(171, 0.2, 0.849),
                d3.hsl(0, 0, 0.961),
                d3.hsl(44, 0.6, 0.849),
                d3.hsl(42, 0.7, 0.653),
                d3.hsl(35, 0.8, 0.4),
                d3.hsl(33, 0.9, 0.23),
                d3.hsl(33, 1, 0.118)
            ],
            'PiYG': [],
            'PRGn': [],
            'PuOr': [],
            'RdYlBu': [],
            'RdGy': []
        },

        brewerColors: { // Cynthia Brewer's diverging color ramps with 11 classes
            'BrBG': [ 
                d3.rgb(0, 60, 48),
                d3.rgb(1, 102, 94),
                d3.rgb(53, 151, 143),
                d3.rgb(128, 205, 193),
                d3.rgb(199, 234, 229),
                d3.rgb(245, 245, 245),
                d3.rgb(246, 232, 195),
                d3.rgb(223, 194, 125),
                d3.rgb(191, 129, 45),
                d3.rgb(140, 81, 10),
                d3.rgb(84, 48, 5)
            ],
            'PiYG': [
                d3.rgb(39, 100, 25),
                d3.rgb(77, 146, 33),
                d3.rgb(127, 188, 65),
                d3.rgb(184, 225, 134),
                d3.rgb(230, 245, 208),
                d3.rgb(247, 247, 247),
                d3.rgb(253, 224, 239),
                d3.rgb(241, 182, 218),
                d3.rgb(222, 119, 174),
                d3.rgb(197, 27, 125),
                d3.rgb(142, 1, 82)
            ],
            'PRGn': [
                d3.rgb(0, 68, 27),
                d3.rgb(27, 120, 55),
                d3.rgb(90, 174, 97),
                d3.rgb(166, 219, 160),
                d3.rgb(217, 240, 211),
                d3.rgb(247, 247, 247),
                d3.rgb(231, 212, 232),
                d3.rgb(194, 165, 207),
                d3.rgb(153, 112, 171),
                d3.rgb(118, 42, 131),
                d3.rgb(64, 0, 75)
            ],
            'PuOr': [
                d3.rgb(45, 0, 75),
                d3.rgb(84, 39, 136),
                d3.rgb(128, 115, 172),
                d3.rgb(178, 171, 210),
                d3.rgb(216, 218, 235),
                d3.rgb(247, 247, 247),
                d3.rgb(254, 224, 182),
                d3.rgb(253, 184, 99),
                d3.rgb(224, 130, 20),
                d3.rgb(179, 88, 6),
                d3.rgb(127, 59, 8)
            ],
            'RdYlBu': [
                d3.rgb(49, 54, 149),
                d3.rgb(69, 117, 180),
                d3.rgb(116, 173, 209),
                d3.rgb(171, 217, 233),
                d3.rgb(224, 243, 248),
                d3.rgb(255, 255, 191),
                d3.rgb(254, 224, 144),
                d3.rgb(253, 174, 97),
                d3.rgb(244, 109, 67),
                d3.rgb(215, 48, 39),
                d3.rgb(165, 0, 38)
            ],
            'RdGy': [
                d3.rgb(26, 26, 26),
                d3.rgb(77, 77, 77),
                d3.rgb(135, 135, 135),
                d3.rgb(186, 186, 186),
                d3.rgb(224, 224, 224),
                d3.rgb(255, 255, 255),
                d3.rgb(253, 219, 199),
                d3.rgb(244, 165, 130),
                d3.rgb(214, 96, 77),
                d3.rgb(178, 24, 43),
                d3.rgb(103, 0, 31)
            ]
        },

        // Scales //////////////////////////////////////////////////////////////

        /**
            A color scale for continuous, linear surface fluxes; not initialized until
            flux.updateStretch() called with valid stats Object as argument.
         */
        divergingScale: d3.scale.linear().clamp(true).interpolate(d3.interpolateRgb),

        /**
            A color scale for segmented, linear surface fluxes; not initialized until
            flux.updateStretch() called with valid stats Object as argument.
         */
        quantileScale: d3.scale.quantile(),

        /**
            Returns the timestamp indicated in the GET query parameters, if present.
            @return {String}
         */
        getTimeStamp: function () {
            var q, regex;

            q = this.getQuery();
            regex = /^\d{4}-([0]{1}\d{1}|[1]{1}[0-2]{1})-([0-2]{1}\d{1}|[3]{1}[01]{1})T([0-1]{1}\d{1}|[2]{1}[123]{1}):[0-5]{1}\d{1}:[0-5]{1}\d{1}$/;

            // I recommend starting at http://localhost/fluxvis/index.html?time=2004-07-22T06:00:00
            if (_.contains(_.keys(q), 'time')) {
                if (regex.exec(q.time)) {
                    return q.time;
                }
            }
        },

        /**
            Returns the GET query parameters of the URI as an Object.
            @return {Object}
         */
        getQuery: function () {
            var i = 0;

            // Split the URI ?foo=bar&red=blue into ["foo", "bar", "red", "blue"]
            return _.chain(window.location.href.split('?').pop().split('&')).map(function (j) {
                return j.split('=');
            }).flatten().groupBy(function (j, n) {
                // Group adjacent couples together
                if (n % 2 < 1) {
                    i += 1
                }

                return i;
            }).values().object().value();
        },

        /**
            Returns an object which can be used to calculate statistics on the
            the passed numeric Array.
         */
        Stats: function (arr) {
	        arr = arr || []; 
	
	        // http://en.wikipedia.org/wiki/Mean#Arithmetic_mean_.28AM.29
	        this.arithmeticMean = function () {
	            var i, sum = 0; 

	            for (i = 0; i < arr.length; i += 1) {
	                sum += arr[i];
	            }

	            return sum / arr.length;
	        };

            this.mean = this.arithmeticMean;
	
	        // http://en.wikipedia.org/wiki/Mean#Geometric_mean_.28GM.29
	        this.geometricMean = function () {
	            var i, product = 1; 

	            for (i = 0; i < arr.length; i += 1) {
	                product = product * arr[i];
	            }

                return Math.pow(product, (1 / arr.length));
	        };
	
	        // http://en.wikipedia.org/wiki/Mean#Harmonic_mean_.28HM.29
	        this.harmonicMean = function () {
	            var i, sum = 0; 

	            for (i = 0; i < arr.length; i += 1) {
	                sum += (1 / arr[i]);
	            }

	            return arr.length / sum;
	        };
	
	        // http://en.wikipedia.org/wiki/Standard_deviation
	        this.stdDev = function () {
	            var mean = this.arithmeticMean(); 
                var i, sum = 0;

	            for (i = 0; i < arr.length; i += 1) {
	                sum += Math.pow(arr[i] - mean, 2);
	            }

	            return Math.pow(sum / arr.length, 0.5);
	        };
	
	        // http://en.wikipedia.org/wiki/Median
	        this.median = function () {
	            var middleValueId = Math.floor(arr.length / 2);

	            return arr.slice().sort(function (a, b) {
                    return a - b;
                })[middleValueId];
	        };

            this.range = function (stds) {
                var a = arr.slice().sort(function (a, b) {
                    return a - b;
                });

                if (typeof stds === 'number') {
                    return ((this.mean() + (stds * this.stdDev()))
                        - (this.mean() - (stds * this.stdDev())));
                }

                return (a[a.length - 1] - a[0]);
            };
	
	        return this;
        }

    };

}); // eo define


