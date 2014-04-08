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
        zoom: '/flux/app/js/planet/d3.geo.zoom'
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
        {name: 'xco2'}
    ]
});

require([
    'underscore',
    'd3',
    'topojson',
    'moment',
    'utils'
], function (_, d3, topojson, moment, utils) {
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
    
    _.extend( {
        controller: controller
    });

    var width = 750, height = 750, canvas, context, stretch;



   canvas = d3.select('#context').append("canvas").attr({'class':'dataCanvas', 'width':width, 'height':height});
    context = canvas.node().getContext("2d");
    var datapath = d3.geo.path().projection(projection).context(context);
    var xco2_data = [];

    projection = orthographicProjection(width, height);

    path = d3.geo.path().projection(projection);
      
    


    var removeValues = function() {
        d3.selectAll(".cell").remove();
            

    }
    
     
    var drawValues = function () {

        //console.dir(xco2_data);
        d3.select("svg").selectAll(".cell")
            .data(xco2_data)
        .enter().append("path")   
            .attr("class", "cell foreground")
            .style("fill",function(d){
                //var value = (d === undefined) ? undefined : d[this.fluxField];

                    return stretch(parseFloat(d.properties.value));
            })
            .style("stroke","none")
            .on('mouseover', function (d) { // Pop out the moused-over point (make it bigger)

             

             // d3.select('.coords')
             // .text("Longitude: " + parseFloat(d.geometry.coordinates[0][0]).toFixed(2)+" Latitude: " + parseFloat(d.geometry.coordinates[0][1]).toFixed(2));
              
              d3.select('.tipdata')
              .text(parseFloat(d.properties.value).toFixed(5).toString());

              


          });

        planet.selectAll("path").attr("d", path); 

    }




    ////////////////////////////////////////////////////////////////////////////
    // Helper Functions ////////////////////////////////////////////////////////
    
    //  Added from d3.geo.zoom.js -- Dirty hack for testing //////////
    
    var radians = Math.PI / 180,
    degrees = 180 / Math.PI;

    // TODO make incremental rotate optional

    d3.geo.zoom = function() {
      var projection,
          zoomPoint,
          event = d3.dispatch("zoomstart", "zoom", "zoomend"),
          zoom = d3.behavior.zoom()
            .on("zoomstart", function() {
              var mouse0 = d3.mouse(this),
                  rotate = quaternionFromEuler(projection.rotate()),
                  point = position(projection, mouse0);
              if (point) zoomPoint = point;
              removeValues();

              zoomOn.call(zoom, "zoom", function() {

                    projection.scale(d3.event.scale);
                    var mouse1 = d3.mouse(this),
                        between = rotateBetween(zoomPoint, position(projection, mouse1));
                    projection.rotate(eulerFromQuaternion(rotate = between
                        ? multiply(rotate, between)
                        : multiply(bank(projection, mouse0, mouse1), rotate)));
                    mouse0 = mouse1;
                    event.zoom.apply(this, arguments);
                  });
              event.zoomstart.apply(this, arguments);
            })
            .on("zoomend", function() {
              zoomOn.call(zoom, "zoom", null);
              drawValues();
              event.zoomend.apply(this, arguments);
            }),
          zoomOn = zoom.on;

      zoom.projection = function(_) {
        return arguments.length ? zoom.scale((projection = _).scale()) : projection;
      };

      return d3.rebind(zoom, event, "on");
    };

    function bank(projection, p0, p1) {
      var t = projection.translate(),
          angle = Math.atan2(p0[1] - t[1], p0[0] - t[0]) - Math.atan2(p1[1] - t[1], p1[0] - t[0]);
      return [Math.cos(angle / 2), 0, 0, Math.sin(angle / 2)];
    }

    function position(projection, point) {
      var t = projection.translate(),
          spherical = projection.invert(point);
      return spherical && isFinite(spherical[0]) && isFinite(spherical[1]) && cartesian(spherical);
    }

    function quaternionFromEuler(euler) {
      var λ = .5 * euler[0] * radians,
          φ = .5 * euler[1] * radians,
          γ = .5 * euler[2] * radians,
          sinλ = Math.sin(λ), cosλ = Math.cos(λ),
          sinφ = Math.sin(φ), cosφ = Math.cos(φ),
          sinγ = Math.sin(γ), cosγ = Math.cos(γ);
      return [
        cosλ * cosφ * cosγ + sinλ * sinφ * sinγ,
        sinλ * cosφ * cosγ - cosλ * sinφ * sinγ,
        cosλ * sinφ * cosγ + sinλ * cosφ * sinγ,
        cosλ * cosφ * sinγ - sinλ * sinφ * cosγ
      ];
    }

    function multiply(a, b) {
      var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
          b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
      return [
        a0 * b0 - a1 * b1 - a2 * b2 - a3 * b3,
        a0 * b1 + a1 * b0 + a2 * b3 - a3 * b2,
        a0 * b2 - a1 * b3 + a2 * b0 + a3 * b1,
        a0 * b3 + a1 * b2 - a2 * b1 + a3 * b0
      ];
    }

    function rotateBetween(a, b) {
      if (!a || !b) return;
      var axis = cross(a, b),
          norm = Math.sqrt(dot(axis, axis)),
          halfγ = .5 * Math.acos(Math.max(-1, Math.min(1, dot(a, b)))),
          k = Math.sin(halfγ) / norm;
      return norm && [Math.cos(halfγ), axis[2] * k, -axis[1] * k, axis[0] * k];
    }

    function eulerFromQuaternion(q) {
      return [
        Math.atan2(2 * (q[0] * q[1] + q[2] * q[3]), 1 - 2 * (q[1] * q[1] + q[2] * q[2])) * degrees,
        Math.asin(Math.max(-1, Math.min(1, 2 * (q[0] * q[2] - q[3] * q[1])))) * degrees,
        Math.atan2(2 * (q[0] * q[3] + q[1] * q[2]), 1 - 2 * (q[2] * q[2] + q[3] * q[3])) * degrees
      ];
    }

    function cartesian(spherical) {
      var λ = spherical[0] * radians,
          φ = spherical[1] * radians,
          cosφ = Math.cos(φ);
      return [
        cosφ * Math.cos(λ),
        cosφ * Math.sin(λ),
        Math.sin(φ)
      ];
    }

    function dot(a, b) {
      for (var i = 0, n = a.length, s = 0; i < n; ++i) s += a[i] * b[i];
      return s;
    }

    function cross(a, b) {
      return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
    }
    
    /////////////// End of d3.geo hack ////////////////////////


    function drawMap(svg, path, mousePoint) {

        var projection = path.projection();
        svg.append("path")
          .datum({type: "Sphere"})
          .attr("class", "background")
          .attr("d", path);

        svg.append("path")
          .datum(d3.geo.graticule())
          .attr("class", "graticule")
          .attr("d", path);

        svg.append("path")
          .datum({type: "Sphere"})
          .attr("class", "foreground")
          .attr("d", path);

        d3.selectAll("svg")
        .on("mousedown.grab", function() {
           
            context.clearRect(0, 0, width, height);
            var path = d3.select(this).classed("zooming", true);
            var w = d3.select(window).on("mouseup.grab", function() {
                  path.classed("zooming", false);
                  w.on("mouseup.grab", null);
                  
                });
          });

      
    }



    function orthographicProjection(width, height) {

        return d3.geo.orthographic()
          .precision(.5)
          .clipAngle(90)
          .clipExtent([[1, 1], [width - 1, height - 1]])
          .translate([width / 2, height / 2])
          .scale(width / 2 - 10)
          .rotate([0, -30]);
    }
    

    var loader = d3.dispatch("world"), id = -1;


    var planet = d3.select("#planet").append("svg")
      .attr("width", width)
      .attr("height", height)
      .call(drawMap, path, true);
    planet
      .call(d3.geo.zoom().projection(projection)
        .on("zoom", redrawPlanet));

    loader.on("world.redraw", redrawPlanet);

    function redrawPlanet() { 
        //context.clearRect(0, 0, width, height);
        
        planet.selectAll("path").attr("d", path); 
        
        
    }



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

    d3.json("/flux/media/world-110m.json", function(error, world){

        d3.select("svg").insert("path", ".foreground")
          .datum(topojson.feature(world, world.objects.land))
          .attr("class", "land");
        d3.select("svg").insert("path", ".foreground")
          .datum(topojson.mesh(world, world.objects.countries))
          .attr("class", "mesh");
        loader.world();

    });
 
    d3.json("/flux/media/out.json", function(error, grid){

        
        xco2_data = topojson.feature(grid, grid.objects.cells).features;
        
        var min = 99999, max = 0;
        for (var i = 0; i < xco2_data.length; i++) {
            var val = parseFloat(xco2_data[i].properties.value);
            if (val < min) min = val;
            if (val > max) max = val;
            
        };
        
        var mid = (min + max) / 2;
        stretch = utils.quantileScale
            .domain([
                min,
                mid, // Mid-value
                max
            ])
            .range(utils.brewerColors.RdYlBu);


        drawValues();


        
        loader.world();

    });
    


});
