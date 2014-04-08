requirejs.config({
    appDir: '.',
    baseUrl: '/flux/app/',
    paths: {
        backbone: '/flux/shared/backbone/backbone-min',
        underscore: '/flux/shared/underscore/underscore-min',
        d3: '/flux/shared/d3/d3.min',
    },
    shim: {
        underscore: {
            exports: '_'
        },
        d3: {
            exports: 'd3'
        }
    },
    dir: 'build/',
    modules: [
        {name: 'main'}
    ]
});

require([
    'underscore',
    'd3',
    'utils'
], function (_, d3, utils) {
    var config, panes, svg, noise;

    config = {
        margin: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 10
        }
    };

    ////////////////////////////////////////////////////////////////////////////
    // Drawing /////////////////////////////////////////////////////////////////

    svg = d3.select('#context')
        .append('svg')
        .append('g')
        .attr('transform',
            'translate(' + config.margin.left + ',' + config.margin.top + ')');

    panes = { // Organizes visualization features into "panes"
        ramps: svg.append('g').attr('class', 'ramp')
    };
    
    ////////////////////////////////////////////////////////////////////////////
    // JSON (Load Summary Statistics) //////////////////////////////////////////
    d3.json('/flux/media/stats.json', function (stats) {
        var colors, classes, height, sigmas, sideLength, tendency, yAxis, yScale;

        classes = 11; // There are 11 color classes
        sideLength = 22;
        sigmas = 2;
        height = sideLength * classes; 
        tendency = 'median';

        breakpoints = [
            (stats[tendency] - (sigmas * stats['std'])),
            0,
            (stats[tendency] + (sigmas * stats['std'])),
        ];

        noise = _.map(_.range(11*11), function (v) {
            return _.random(0, classes - 1).toFixed(0)
        });

        // Scales and Axes /////////////////////////////////////////////////////

        yScale = d3.scale.linear()
            .domain([0, classes])
            .range([height, 0]);

        colors = _.keys(utils.brewerColors);
        colors = colors.concat(_.keys(utils.linearColors));

        //FIXME
        _.each(colors.slice(0,7), function (color, iter) {
            var colorScale, data, matrix, pd, py, px, pyAxis, xOffset, yOffset,
                r, j, k, plot, colors;

            if (iter > 5) {
                colors = utils.linearColors;

                // Describes the offset of each graph set (in this _.each() loop)
                xOffset = config.margin.left + (400 + height);
                yOffset = config.margin.top + ((iter - 6) * (60 + height));

                pd = colors[color];

            } else {
                colors = utils.brewerColors;

                // Describes the offset of each graph set (in this _.each() loop)
                xOffset = config.margin.left;
                yOffset = config.margin.top + (iter * (60 + height));

                pd = _.map(colors[color], function (c) {
                    return c.hsl()
                });
            }

            px = d3.scale.linear()
                .domain([0, classes])
                .range([0, height]);

            py = d3.scale.linear()
                .domain([0, 1])
                .range([height, 0]);

            pyAxis = d3.svg.axis()
                .scale(py)
                .orient('bottom')
                .ticks(6)

            // Update the stretch
            colorScale = d3.scale.quantile()
                .domain(breakpoints)
                .range(colors[color]);

            // Get data
            data = colorScale.quantiles();

            // Drawing /////////////////////////////////////////////////////////////

            // Because this element is rotated 90 degrees, the sense of x and y is flipped
            panes.ramps.append('text')
                .text(function () {
                    s = color;
                    s += (iter > 5) ? ' (Adjusted)' : '';
                    return s;
                })
                .attr({
                    'x': -(yOffset + height),
                    'y': xOffset - 10,
                    'class': 'ramp axis label',
                    'transform': 'rotate(-90)'
                });

            // Draw the data cells on top
            panes.ramps.selectAll(color + '-' + iter)
                .data(_.range(classes))
                .enter()
                .append('rect')
                .attr({
                    'x': xOffset,
                    'y': function (d, i) { return yOffset + yScale(i); },
                    'width': sideLength,
                    'height': sideLength,
                    'class': color + '-' + iter,
                    //'fill': function (d) { return colorScale(d); }
                    'fill': function (d, i) { return colors[color][i]; }
                });

            // HSL scatter plot
            plot = panes.ramps.append('g')
                .attr('class', 'plot')

           // The saturation component line
            plot.append('path')
                .datum(pd)
                .attr('d',
                    d3.svg.line()
                    .x(function (d) {
                        if (!_.isFinite(d.s)) return 40 + py(0) + xOffset;
                        return 40 + py(d.s) + xOffset; // 1 = Saturation
                    })
                    .y(function (d, i) { return yOffset + yScale(i) + (sideLength / 2); }))
                .attr({
                    'fill': 'none',
                    'stroke': '#333',
                    'stroke-width': 2
                });

            // The saturation component points
            plot.selectAll(color + '-saturation')
                .data(pd)
                .enter()
                .append('circle')
                .attr({
                    'cx': function (d, i) {
                        if (!_.isFinite(d.s)) return 40 + py(0) + xOffset;
                        return 40 + py(d.s) + xOffset; // 1 = Saturation
                    },
                    'cy': function (d, i) {
                        return yOffset + yScale(i) + (sideLength / 2);
                    },
                    'r': 5,
                    'class': color + '-saturation',
                    'fill': function (d) {
                        if (!_.isFinite(d.s)) return 'transparent';
                        return '#333'
                    },
                    'stroke': '#333'
                });

            // The lightness component line
            plot.append('path')
                .datum(pd)
                .attr('d',
                    d3.svg.line()
                    .x(function (d) {
                        if (!_.isFinite(d.l)) return 40 + py(0) + xOffset;
                        return 40 + py(d.l) + xOffset; // 2 = Lightness
                    })
                    .y(function (d, i) { return yOffset + yScale(i) + (sideLength / 2); }))
                .attr({
                    'fill': 'none',
                    'stroke': '#777',
                    'stroke-width': 2
                });

            // The lightness component points
            plot.selectAll(color + '-lightness')
                .data(pd)
                .enter()
                .append('circle')
                .attr({
                    'cx': function (d, i) {
                        if (!_.isFinite(d.l)) return 40 + py(0) + xOffset;
                        return 40 + py(d.l) + xOffset; // 2 = Lightness
                    },
                    'cy': function (d, i) {
                        return yOffset + yScale(i) + (sideLength / 2);
                    },
                    'r': 5,
                    'class': color + '-lightness',
                    'fill': '#eee',
                    'stroke': function (d) {
                        if (!_.isFinite(d.l)) return 'transparent';
                        return '#777'
                    },
                    'stroke-width': 2
                });

            // Append an axis
            plot.append('g')
                .attr({
                    'class': 'plot x axis',
                    'transform': 'translate(' + (40 + xOffset) + ',' + (yOffset + height + sideLength + config.margin.top) + ')'
                })
                .call(pyAxis);

            plot.selectAll('legend')
                .data(['Saturation', 'Lightness'])
                .enter()
                .append('text')
                .text(function (d) { return d; })
                .attr({
                    'y': yOffset + height + config.margin.top + 60,
                    'x': function (d, i) {
                        return 10 + xOffset + (i * 100);
                    },
                    'class': 'plot axis label',
                    'fill': function (d, i) {
                        return (i === 0) ? '#333' : '#777';
                    }
                })

            plot.selectAll('legend-item')
                .data([0,1])
                .enter()
                .append('circle')
                .text(function (d) { return d; })
                .attr({
                    'cy': yOffset + height + config.margin.top + 60 - 5,
                    'cx': function (d, i) {
                        return xOffset + (i * 100);
                    },
                    'r': 5,
                    'class': 'plot axis label',
                    'fill': function (d, i) {
                        return (i === 0) ? '#333' : 'transparent';
                    },
                    'stroke': function (d, i) {
                        return (i === 0) ? '#333' : '#777';
                    },
                    'stroke-width': 2
                })

            matrix = panes.ramps.append('g')
                .attr({
                    'class': 'matrix',
                    'transform': 'translate(' + (60 + height + xOffset) + ',' + (yOffset + 20) + ')'
                });

            r = 0;
            j = 0;
            k = 0;
            matrix.selectAll('cell')
                .data(_.map(noise, function (d) {
                    return colors[color][d];
                }))
                .enter()
                .append('rect')
                .attr({
                    'x': function (d, i) {
                        if (k >= 11) {
                            k = 0;
                        }

                        k += 1
                        return k * sideLength;
                    },
                    'y': function (d, i) {
                        if (j >= 11) {
                            r += sideLength;
                            j = 0;
                        }

                        j += 1;
                        return r;
                    },
                    'width': sideLength,
                    'height': sideLength,
                    'fill': function (d) {
                        return d;
                    }
                });

        });

    });

});

