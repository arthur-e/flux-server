###################
# Metadata Schema #
###################

Last updated: March 21, 2014.

########################################
## Required Parameters for Web Client ##

```
{
    "_id": String,

    "dates": [String],          // Array of dates denoting the start and end
                                // and any time the interval or range changes
                                // between the start and end

    "gridded": Boolean,         // Indicates the data are on a grid

    "gridres": {                // Grid resolution, if data are gridded

        "units": ("degrees"|"meters"),

        "x": Number,            // Grid resolution in the x-direction

        "y": Number             // Grid resolution in the y-direction

    },

    "bboxmd5": String,          // MD5 Hash

    "bbox": [Number() minx, miny, maxx, maxy],

    "stats": {                  // Summary statistics for the population
        "std": Number,
        "max": Number,
        "min": Number,
        "median": Number,
        "mean": Number
    },

    "spans": [Number],          // Array of lengths of time in seconds that
                                // each observation spans; there is more than
                                // one in this list of the span changes at a
                                // corresponding data in the "dates" Array

    "steps": [Number],          // Array of lengths of time in seconds
                                // between each observation

    "uncertainty": {            // Indicates that uncertainty data exist

        "embedded": Boolean,    // They are alongside the data values?

        "uri": String           // Or they are available at this URI

    }
}
```

########################################
## Optional Parameters for Python API ##

All of these parameters can be configured on the fly; none are required provided
the data model (TransformationInterface) is compatible.

```
{
    "columns": [String],        // Array of well-known column identifiers, in order
                                // e.g. "x", "y", "value", "error"

    "geometry": {               // Implies data are not on a structured grid

        // Specifies that each document is a FeatureCollection and stored as
        // one document; otherwise, each row is stored as a separate document
        // (a separate simple feature)
        "is_collection": Boolean,

        "type": ("Point"|"LineString"|"Polygon")

    },

    "header": [String],         // Array of human-readable column headers, in order

    "parameters": [String],     // Array of well-known variable names e.g.
                                // "values", "value", "errors" or "error"

    "span": Number,             // The length of time, in seconds, that an
                                // observation spans

    "step": Number,             // The length of time, in seconds, between each
                                // observation to be imported

    "timestamp": String,        // An ISO 8601 timestamp for the first observation

    "units": [String],          // Array of units for each field, in order

    "var_name": String          // The name of the variable in the hierarchical
                                // file which stores the data


}
```

#################################
## Complete List of Parameters ##

```
{
    "_id": String,

    "columns": [String],        // Array of well-known column identifiers, in order
                                // e.g. "x", "y", "value", "error"

    "dates": [String],          // Array of dates denoting the start and end
                                // and any time the interval or range changes
                                // between the start and end

    "geometry": {               // Implies data are not on a structured grid

        // Specifies that each document is a FeatureCollection and stored as
        // one document; otherwise, each row is stored as a separate document
        // (a separate simple feature)
        "is_collection": Boolean,

        "type": ("Point"|"LineString"|"Polygon")

    },

    "gridded": Boolean,         // Indicates the data are on a grid

    "gridres": {                // Grid resolution, if data are gridded

        "units": ("degrees"|"meters"),

        "x": Number,            // Grid resolution in the x-direction

        "y": Number             // Grid resolution in the y-direction

    },

    "bboxmd5": String,          // MD5 Hash

    "bbox": [Number() minx, miny, maxx, maxy],

    "header": [String],         // Array of human-readable column headers, in order

    "parameters": [String],     // Array of well-known variable names e.g.
                                // "values", "value", "errors" or "error"

    "stats": {                  // Summary statistics for the population
        "std": Number,
        "max": Number,
        "min": Number,
        "median": Number,
        "mean": Number
    },

    "span": Number,             // The length of time, in seconds, that an
                                // observation spans

    "spans": [Number],          // Array of lengths of time in seconds that
                                // each observation spans; there is more than
                                // one in this list of the span changes at a
                                // corresponding data in the "dates" Array

    "step": Number,             // The length of time, in seconds, between each
                                // observation to be imported

    "steps": [Number],          // Array of lengths of time in seconds
                                // between each observation

    "timestamp": String,        // An ISO 8601 timestamp for the first observation

    "uncertainty": {            // Indicates that uncertainty data exist

        "embedded": Boolean,    // They are alongside the data values?

        "uri": String           // Or they are available at this URI

    },

    "units": [String],          // Array of units for each field, in order

    "var_name": String          // The name of the variable in the hierarchical
                                // file which stores the data
}
```
