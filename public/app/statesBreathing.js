//TODO Assign color or scale to forest area
//TODO High response in northeast may be due to higher variability in data--fewer data points for smaller states
requirejs.config({
    appDir: '.',
    baseUrl: '/flux/app/',
    paths: {
        d3: '/flux/shared/d3/d3.min',
        moment: '/flux/shared/moment/moment.min',
        queue: '/flux/shared/queue-async/queue.min',
        topojson: '/flux/shared/topojson/topojson.min',
        underscore: '/flux/shared/underscore/underscore-min',
        backbone: '/flux/shared/backbone/backbone-min',
    },
    shim: {
        backbone: {
            deps: ['underscore'],
            exports: 'Backbone'
        },
        d3: { exports: 'd3' },
        queue: { exports: 'queue' },
        topojson: { exports: 'topojson' },
        underscore: { exports: '_' }
    },
    dir: 'build/',
    modules: [
        {name: 'statesBreathing'}
    ]
});

require([
    'underscore',
    'd3',
    'queue',
    'topojson',
    'moment',
    'utils',
    'colorRamp'
], function (_, d3, queue, topojson, moment, utils, colorRamp) {
    var controller, csvFile, formatString, panes, projection, svg, timing, easing;

    ////////////////////////////////////////////////////////////////////////////
    // Controller //////////////////////////////////////////////////////////////

    controller = {

        /**
            The first time slice that should be rendered.
            @constant
         */
        initialTime: '2004-01-01T03:00:00', //'2003-12-22T03:00:00',

        /**
            Time series information; "the big picture."
         */
        series: {
            startTime: undefined,
            endTime: undefined,
            interval: 1000,
            timeDelta: 1, // Temporal resolution is daily (24 hours)
            timeDeltaUnit: 'month',
            timeDeltaUnits: 'months',
            offset: 1 // Viewing 24-hour steps in time by default
        },

        /**
            The base URL for the flux API.
            @constant
         */
        baseUrl: '/flux/api/casa_gfed_3hrly/xy', //FIXME

        /**
            Property name that identifies the flux measurement in the JSON
            document.
            @constant
         */
        fluxField: 'flux',

        /**
            Describes the floating-point precision of the flux measurements.
            @constant
         */
        fluxPrecision: 2,

        /**
            SVG element margins.
            @constant
         */
        margin: {
            top: 0,
            right: 0,
            bottom: 50, // To conserve space at top of map (pushes map up)
            left: 0
        }

    };
    
    ////////////////////////////////////////////////////////////////////////////
    // Extensions //////////////////////////////////////////////////////////////
    
    _.extend(colorRamp, {
        controller: controller
    });

    /**
        The map projection (d3.geo.<projection>).
        @constant
     */
    projection = d3.geo.albers()
        .scale(window.innerWidth)
        .translate([
            window.innerWidth / 2,
            window.innerHeight / 2.2
        ]);

    ////////////////////////////////////////////////////////////////////////////
    // Drawing /////////////////////////////////////////////////////////////////
    
    svg = d3.select('#context')
        .append('svg')    
        .attr({
            title: 'Carbon Flux Visualization',
            version: 1.1,
            xmlns: 'http://www.w3.org/2000/svg'
        })
        .append('g')
        .attr('transform', 'translate(' + controller.margin.left + ',' + controller.margin.top + ')');

    panes = { // Organizes visualization features into "panes"
        states: svg.append('g').attr('class', 'pane geography'),
        boundaries: svg.append('g').attr('class', 'pane boundary'),
        annotation: svg.append('g').attr('class', 'pane annotation'),
        ramp: svg.append('g').attr('class', 'pane ramp')
    };
    
    ////////////////////////////////////////////////////////////////////////////
    // Listeners ///////////////////////////////////////////////////////////////
    
    d3.select('.hideit').on('click', function () {
        console.log('hideit!');
        d3.select('.popup').attr('class', 'overlay popup hidden');
    });

    d3.select('.showit').on('click', function () {
        console.log('showit!');
        foo = d3.select('.popup.hidden').attr('class', 'overlay popup');
    });

    ////////////////////////////////////////////////////////////////////////////
    // GeoJSON and CSV /////////////////////////////////////////////////////////

    // Assume monthly fluxes
    csvFile = '/flux/media/monthly_fluxes_by_us_state.csv';
    formatString = 'MMMM';

    (function () {
        var query = utils.getQuery();
        
        timing = 1000;
        easing = 'cubic-out';

        if (_.has(query, 'interval')) {

             if (query.interval === 'daily') {
                csvFile = '/flux/media/daily_fluxes_by_us_state.csv';
                formatString = 'MMM D';
                controller.series.timeDeltaUnit = 'day';
                controller.series.timeDeltaUnits = 'days';
                timing = 750;
                easing = 'linear';
            }
        }
    }());

    //TODO Try converting `table` from D3's Object representation to something e.g. {'MI': [0, 1, 2...]}
    queue()
        .defer(d3.json, '/flux/media/us_states.topo.json')
        .defer(d3.csv, csvFile)
        .await(function (error, states, table) {
            var path, stats, selection, t, tFinal, when;

            if (error) throw error;

            // The table (collection of Objects) is turned into an Array of Arrays
            fluxes = _.map(table, function (each) {
                return _.chain(each).omit(each, 'id').toArray().map(Number).value();
            });

            // These are population statistics
            stats = utils.Stats(_.flatten(fluxes));

            controller.stretch = utils.quantileScale
                .domain([
                    stats.mean() - (1 * stats.stdDev()), // Lower bound
                    stats.mean(), // Mid-value
                    stats.mean() + (1 * stats.stdDev())  // Upper bound
                ])
                .range(utils.brewerColors.BrBG);

            path = d3.geo.path().projection(projection);

            // Annotation
//            panes.annotation.append('text')
//            .text(moment.utc(controller.initialTime).format('YYYY'))
//            .attr({
//                'x': controller.margin.left,
//                'y': (function () {
//                    var el, h;

//                    el = d3.select('svg')[0][0];
//                    h = el.scrollHeight || el.offsetHeight || el.clientHeight;
//                    
//                    return h - (controller.margin.top + (window.innerWidth * 0.05) + 20);
//                }()),
//                'style': (function () {
//                    return 'font-size: ' + (window.innerWidth * 0.15).toString() + 'px';
//                }()),
//                'class': 'year'
//            });

            ////////////////////////////////////////////////////////////////////
            // Drawing /////////////////////////////////////////////////////////

            panes.annotation.append('text')
            .text(moment.utc(controller.initialTime).format(formatString).toUpperCase())
            .attr({
                'x': controller.margin.left,
                'y': (controller.margin.top + (window.innerHeight * 0.08)),
                'stroke': '#eee',
                'stroke-width': 2,
                'style': (function () {
                    return 'font-size: ' + (window.innerHeight * 0.08).toString() + 'px';
                }()),
                'class': 'date'
            });

            // State polygons
            selection = panes.states.selectAll('.state')
                .data(topojson.feature(states, states.objects.us_states).features)
                .enter()
                .append('path')
                .attr({
                    'd': path,
                    'class': 'state',
                    'fill': function (d) {
                        return controller.stretch(Number(_.findWhere(table, {
                            id: d.id
                        })['t0']));
                    }
                });

            // State boundaries
            panes.boundaries.append('path')
                .datum(topojson.mesh(states, states.objects.us_states, function (a, b) {
                    return a === b || a !== b; // This returns both outer (a === b) and inner (a !== b) boundaries
                }))
                .attr({
                    'd': path,
                    'class': 'state-boundary',
                    'fill': 'transparent',
                    'stroke': '#999',
                    'stroke-width': 1
                });
                
            // Color Ramp //////////////////////////////////////////////////////
            
            colorRamp.initialize({
                pane: panes.ramp,
                margin: {
                    left: controller.margin.left + 25
                }
            });

            colorRamp.draw();
            
            panes.ramp.attr('transform', 'translate(0,' + (colorRamp.height).toString() + ')');
            
            ////////////////////////////////////////////////////////////////////
            // Animation ///////////////////////////////////////////////////////

            t = 0; // Counter for time steps
            tFinal = _.map(_.keys(table[0]), function (key) {
                return RegExp('t\\d+').test(key);
            }).length - 2;
            when = moment.utc(controller.initialTime);

            // Start the animation
            controller.animation = window.setInterval(function () {
                var key;

                // Wrap around when the animation is over
                if (t < tFinal) {
                    key = 't' + (t += 1).toString();
                    when.add(controller.series.timeDelta,
                        controller.series.timeDeltaUnits)

                } else {
                    key = 't' + (t = 0).toString();
                    when = moment.utc(controller.initialTime);
                }

                // For logging the 't0' timesteps (after 48 states)
                controller.trace = _.after(48, function () {
                    console.log(key);
                });

                selection.transition()
                    .duration(timing)
                    .ease(easing)
                    .attr({
                        'fill': function (d) {
                            //controller.trace();//FIXME

                            return controller.stretch(Number(_.findWhere(table, {id: d.id})[key]));
                        },

                        'transform': function (d) {
                            var centroid, scale, n, x, y;

                            centroid = path.centroid(d);
                            x = centroid[0];
                            y = centroid[1];
                            n = Number(_.findWhere(table, {id: d.id})[key]);

                            scale = 1 + ((n - stats.mean()) / stats.range(1));
                            scale = (scale < 0) ? 0 : scale;

                            return 'translate(' + x + ',' + y + ')'
                                + 'scale(' + (scale || 0).toString() + ')'
                                + 'translate(' + -x + ',' + -y + ')';
                        }
                    }) // delay for 750ms; then do nothing (stops animation)
                    .each('start', function () {
                        d3.selectAll('.date')
                            .text(when.format(formatString).toUpperCase())
                    });

            }, timing); // 1500 ms (1.5 second)
    });
    
    // Set the "centered" position of the overlay dialog
    d3.select('.overlay').attr('style', (function () {
        str = 'left:';
        str += ((window.innerWidth - window.innerWidth*0.4) / 2).toFixed(0).toString() + 'px;';
        str += 'top:';
        str += ((window.innerHeight - window.innerWidth*0.3) / 3).toFixed(0).toString() + 'px;';
        return str;
    }()));

});
