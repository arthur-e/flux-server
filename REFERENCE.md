# Document Schemas

There are three (3) different kinds of documents in API responses:

* Map document
* Matrix
* Time series

**Map documents** describe a geographic representation of the underlying data.
**Matrices** describe an arbitrary but non-geographic data structure.
**Time series** describe multiple data points at different steps in time.

`ISODate()` data type refers to an ISO-8*** standard timestamp; for example:

    2003-12-26T12:00:00

## Map Documents

Map documents returned include **flux magnitudes** and **variance maps**.

### Flux Magnitudes

    {
        "timestamp": ISODate(),
        "features": [
            {
                "flux": Number(),
                "coordinates": [
                    Number(),
                    Number()
                ]
            },
            ...
        ]
    }

### Flux Variance

Flux variances (like covariances) can include a `Number()` or an `ISODate()` instance for the `timestamp` key, as the actual resolution of the uncertainty data can be quite coarse.

    {
        "timestamp": ISODate() || Number(),
        "features": [
            {
                "variance": Number(),
                "coordinates": [
                    Number(),
                    Number()
                ]
            },
            ...
        ]
    }

A map of covariances associated with a resolution cell specified by `covaranceAt` are represented as:

    {
        "timestamp": ISODate() || Number(),
        "properties": {
            "covarianceAt": {
                "coordinates": [ Number(), Number() ]
            }
        },
        "features": [
            {
                "covariance": Number(),
                "coordinates": [
                    Number(),
                    Number()
                ]
            },
            ...
        ]
    }

## Matrices

The matrix is used to respresent **covariance data**.

### Flux Covariances

    {
        "timestamp": ISODate() || Number(),
        "values": [
            [ Number() ],
            [ Number(), Number() ],
            [ Number(), Number(), Number() ],
            ...
        ]
    }

## Time Series

Time series can be used to represent almost any parameter:

    {
        "coordinates": [ Number(), Number() ],
        "series": [
            {
                "value": Number(),
                "_id": ISODate()
            },
            ...
        ]
    }

# GET Requests

## Entry Points

    GET /flux/api/grid.json
    GET /flux/api/[scenario]/xy.json
    GET /flux/api/[scenario]/t.json
    GET /flux/api/[scenario]/t.csv
    GET /flux/api/[scenario]/stats.json
    GET /flux/api/[scenario]/uncertainty.json

## Use Cases

### Summary Statistics

    GET /flux/api/[scenario]/stats.json

################################################################################
### Getting a Map (XY Data) ####################################################

#### Getting a Map at a Specified Time

    GET /flux/api/[scenario]/xy.json?time=2004-05-01T03:00:00

#### Aggregation in Time

The `aggregate` keyword is used to specify the kind of aggregate data desired.
Here is an example of aggregation in time; aggregating total positive flux over a specified period.

    GET /flux/api/[scenario]/xy.json?start=2004-05-01T03:00:00&end=2004-06-01T03:00:00&aggregate=positive

And here is a map of net flux over a month for each model cell:

    GET /flux/api/[scenario]/xy.json?start=2004-05-01T03:00:00&end=2004-05-02T03:00:00&aggregate=net

################################################################################
### Getting a Time Series ######################################################

As with the XY endpoint, the `aggregate` keyword is used to specify the kind of aggregate data desired.
The `start` and `end` keywords are required in aggregation, but should not be used with the `coords` parameter.

#### Getting a Time Series at a Specified Point

    GET /flux/api/[scenario]/t.json?coords=POINT(-50.5 69.5)
    GET /flux/api/[scenario]/t.csv

#### Aggregation in Space

There are two ways of specifying the spatial extent of aggregation.
The `roi` parameter or the `geom` parameter may be used.

    GET /flux/api/[scenario]/t.json?roi=contintent&aggregate=net&start=2004-05-01&end=2004-06-01
    GET /flux/api/[scenario]/t.json?geom=POINT(-50.5 69.5)&aggregate=net&start=2004-05-01&end=2004-06-01

#### Aggregation in Time

The `interval` parameter can be used to aggregate in time.
Here is a time series of net daily flux across the entire dataset (net daily flux of North America) for each day of the month:
There is an implied `roi=continent` keyword-value pair in these requests, as fluxes are aggregated **across the entire spatial extent of the dataset in time aggregation.**

    GET /flux/api/[scenario]/t.json?start=2004-01-01T00:00:00&end=2004-01-31T00:00:00&aggregate=net&interval=daily

#### Aggregation in Both Time and Space

**This is not supported.** However, if it was, it would be implemented like this:

    GET /flux/api/[scenario]/t.json?start=2004-01-01&end=2004-01-31&aggregate=net&interval=daily&geom=POINT(-50.5 69.6)

################################################################################
### Uncertainty Data: Covariance ###############################################

To get a map of the covariances associated with a particular model cell, use the `covarianceAt` parameter:

    GET /flux/api/[scenario]/uncertainty.json?time=2004-05&covarianceAt=POINT(-50.5 69.5)

A time series of covariance data can be obtained by specifying the associated cells and a range of time:

    GET /flux/api/[scenario]/uncertainty.json?start=2004-05&end=2004-06&source=POINT(-50.5 69.5)&target=POINT(-45.5 69.5)

################################################################################
### Uncertainty Data: Variance #################################################

The variances can be obtained for specified timesteps with the `time` parameter:

    GET /flux/api/[scenario]/uncertainty.json?time=2004-05

A time series of variances can be obtained by setting the `source` and `target` parameters to the same value (the same resolution cell):

    GET /flux/api/[scenario]/uncertainty.json?start=2004-05&end=2004-06&source=POINT(-50.5 69.5)&target=POINT(-50.5 69.5)


