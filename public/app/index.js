requirejs.config({
    appDir: '.',
    baseUrl: '/flux/app/',
    paths: {
        underscore: '/flux/shared/underscore/underscore-min',
        d3: '/flux/shared/d3/d3.min',
    },
    shim: {
        underscore: {
            exports: '_'
        },
        d3: {
            exports: 'd3'
        },
    },
    dir: 'build/',
    modules: [
        {name: 'index'}
    ]
});

require([
    'underscore',
    'd3',
    'utils',
], function (_, d3, utils) {
    var j, k, r, bannerH, cellW, cellH, colorScale, data, svg, svgW, svgH,
        selection, scales;

    bannerH = 80; // Set to #banner height
    svgW = screen.availWidth;
    svgH = d3.select('#banner').offsetHeight;
    cellW = 10;
    cellH = cellW;

    scales = [
        utils.brewerColors.BrBG,
        utils.brewerColors.PiYG,
        utils.brewerColors.PRGn,
        utils.brewerColors.PuOr,
        utils.brewerColors.RdYlBu,
        utils.brewerColors.RdGy
    ];

    colorScale = d3.scale.quantile()
        .domain([0.0, 0.5, 1.0])
        .range(scales[_.random(0, 5)])

    // Calculate how many squares it will take to fill the space
    data = _.map(_.range((svgW*bannerH)/(cellW*cellH)), function (v) {
        return Math.random().toFixed(3);
    });

    svg = d3.select('#banner')
        .append('svg')
        .attr({
            'width': svgW,
            'height': svgH
        })
        .append('g');

    r = 0;
    j = 0;
    k = -1;
    selection = svg.selectAll('.cell')
        .data(data)
        .enter()
        .append('rect')
        .attr({
            'class': 'cell',
            'x': function (d, i) {
                if (k * cellW >= svgW) {
                    k = -1;
                }

                k += 1
                return k * cellW;
            },
            'y': function (d, i) {
                if (j * cellW >= svgW) {
                    r += cellH;
                    j = 0;
                }

                j += 1;
                return r;
            },
            'width': 10,
            'height': 10,
            'fill': function (d) {
                return colorScale(d);
            }
        });

    svg.on('mouseover', function () {
        updateStretch();
    });

    svg.on('mouseout', function () {
        updateStretch();
    });

    function updateStretch () {
        colorScale.range(scales[_.random(0, 5)]);
        selection.transition('linear')
            .duration(500)
            .attr('fill', function (d) {
                return colorScale(d);
            });
    };
});


