define('colorRamp', [ // Dependencies follow
    'underscore',
    'd3'
], function (_, d3) {

    return {

        /**
            Initializes the object with the proper state and methods.
            @param  options {Object}    Defaults and configuration options
            @param  cb      {Function}  An optional callback function
            @param  scope   {Object}    The scope for the callback function
            @return         {Object}    Function returns itself
         */
        initialize: function (options, cb, scope) {
        
            /**
                Capture default configuration options.
             */
            _.extend(this, options);

            /**
                Flag indicating whether or not run-once configuration steps have been
                taken; such steps only needed first time color ramp is drawn.
             */
            this.configured = false;

            /**
                The width of the color ramp element.
             */
            this.width = window.innerWidth * 0.02;

            /**
                The height of the color ramp element.
             */
            this.height = window.innerHeight * 0.3;

            /**
                Define inner margins based on SVG margins.
             */
            this.margin = _.defaults((options.margin || {}), {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            });
            this.margin.left += 50;

            /**
                An object holding the axes.
             */
            this.axis = {};

            /**
                An object holding the scales.
             */
            this.scale = {};

            /**
                Test and remember if this should be a segmented color ramp.
             */
            this.isSegmented = this.controller.stretch.hasOwnProperty('quantiles');

            if (typeof cb === 'function') {
                cb.call(scope || this);
            }

            return this;
        },

        /**
            Draws the color ramp (or redraws it from new data).
         */
        draw: function () {
            // Update the stretch
            this.scale.color = this.controller.stretch;

            if (this.isSegmented) {
                data = this.scale.color.quantiles();
                rampHeight = rampWidth = this.height / data.length;

            } else {
                // Approximate a linear gradient with many, many data points
                data = this.scale.color.ticks(200);
                rampWidth = this.height * 0.075; // Should be about 22px
                rampHeight = this.height / data.length;
            }

            // Sort the data
            if (data[0] > data[data.length - 1]) {
                data.reverse();
            }

            ////////////////////////////////////////////////////////////////////
            // Scales and Axes /////////////////////////////////////////////////

            this.scale.y = d3.scale.linear()
            .domain([0, data.length])
            .range([this.height, 0]);

            this.axis.y = d3.svg.axis()
            .scale(this.scale.y)
            .orient('left')
            .tickFormat(function (x, i) {
                var s = Number(data[x]).toFixed(1).toString();
                return (s === 'NaN') ? '' : s;
            });

            ////////////////////////////////////////////////////////////////////
            // Drawing /////////////////////////////////////////////////////////

            if (!this.configured) { // Run-once configuration
                // Because this element is rotated 90 degrees, the sense of x and y is flipped
                this.pane.append('text')
                .text('Flux (umol/m²)')
                .attr({
                    'x': -(this.height),
                    'y': this.margin.left - 50,
                    'class': 'ramp axis label',
                    'transform': 'rotate(-90)'
                });

                // Configure y-axis
                this.pane.append('g')
                .attr({
                    'class': 'ramp x axis',
                    'transform': 'translate(' + this.margin.left + ',' + (this.margin.top + this.scale.y(data.length - 1)) + ')'
                })
                .call(this.axis.y);

                this.configured = true;
            }
            
            // Draw the data cells on top
            this.pane.selectAll('.interval')
            .data(data)
            .enter()
            .append('rect')
            .attr({
                'x': this.margin.left + 1,

                'y': _.bind(function (d, i) {
                    return this.margin.top + this.scale.y(i)
                }, this),

                'width': rampWidth,

                'height': (this.isSegmented) ? rampHeight : rampHeight + 1,

                'class': 'ramp interval',

                'fill': _.bind(function (d) {   
                    return this.scale.color(d);
                }, this)
            });

        },

        /**
            Sets the color fill of the Flux drawing elements; can be used to refresh
            this attribute, particularly when the color scale changes.
            @param  sel     {SVGElement}    A D3 selection; optional
         */
        update: function (sel, sigmas, tendency) {
            var data, wasSegmented;

            // Copy old property and update it
            wasSegmented = !!this.isSegmented;
            this.isSegmented = this.controller.stretch.hasOwnProperty('quantiles');

            // Test again; is it segmented?
            if ((this.isSegmented && !wasSegmented) || (!this.isSegemented && wasSegmented)) {

                this.draw(true); // Redraw

            } else {

                sel = sel || this.pane.selectAll('.interval');

                data = sel.data();

                sel.attr({
                    'fill': _.bind(function (d) {   
                        return this.scale.color(d);
                    }, this)
                });

            }

        }

    };

}); // eo define
