D3.js Carbon Flux Visualization(s)
----------------------------------

################
# Installation #
################

The full installation procedure is captured in `setup.sh` which should be run from the command line with `sudo` privileges.

Assuming Node.js and NPM are already installed... From the project root, with Node installed, run the following to install dependencies:

    npm install
    
For more information on dependencies, read `package.json`.
A special case is the dependency manager, `require.js`, which is symbolically-linked in `/app/js/require.js`:

    cd public/app/js
    ln -s ../../node_modules/requirejs/require.js

## MongoDB Installation

The Ubuntu package management tool (i.e. dpkg and apt) ensure package consistency and authenticity by requiring that distributors sign packages with GPG keys. Issue the following command to import the 10gen public GPG Key:

    $ sudo apt-key adv --keyserver keyserver.ubuntu.com --recv 7F0CEB10

Create a /etc/apt/sources.list.d/10gen.list file and include the following line for the 10gen repository.

    $ echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/10gen.list

Now issue the following command to reload your repository:

    $ sudo apt-get update

Issue the following command to install the latest stable version of MongoDB:

    $ sudo apt-get install mongodb-10gen

## Loading Initial Data

Here's an example of how to load CASA data (flux magnitudes):

    $ python fluxpy/mongodb.py flux -p data_casa_gfed_3hrly.mat -s casa_gfed_3hrly

##############
# Deployment #
##############

To start the app server:

    forever start /usr/local/project/flux-d3/app.js

To stop the app server:

    forever stop /usr/local/project/flux-d3/app.js

To make sure the server is restarted when the host server reboots, add the following
line to `/etc/rc.local` before the line `exit 0`:

    (cd /usr/local/project/flux-d3/; /usr/bin/sudo -u {username} /usr/local/bin/forever start /usr/local/project/flux-d3/app.js)

## Building

The require.js optimizer is used to build.

    cd /usr/local/project/flux-d3/node_modules/requirejs/
    wget http://requirejs.org/docs/release/2.1.8/r.js
    node r.js -o /usr/local/project/flux-d3/public/main.build.js

## Apache Configuration

When using the Node.js server, the following Apache configuration can be used for port proxying:

    ############################################################################
    # Reverse proxies for NASA ACOS
    ############################################################################

    <Location /flux>
        ProxyPass http://127.0.0.1:8080/flux
        ProxyPassReverse http://127.0.0.1:8080/flux
        Order allow,deny
        Allow from all
    </Location>

When using the Python API and Apache, wse the following configuration within a `<VirtualHost>` container directive:

    ############################################################################
    # NASA-ACOS Flux Visualization
    ############################################################################

    # Node.JS Modules
    Alias /flux/shared "/usr/local/project/flux-d3/node_modules/"
    <Directory "/usr/local/project/flux-d3/node_modules/">
        Order allow,deny
        Allow from all
    </Directory>

    Alias /flux "/usr/local/project/flux-d3/public/"
    <Directory "/usr/local/project/flux-d3/public/">
        Order allow,deny
        Options Indexes FollowSymLinks
        Allow from all
        IndexOptions FancyIndexing
    </Directory>

#################
# Documentation #
#################

## API ##

    GET /flux/api/casa-gfed/stats.json
    GET /flux/api/casa-gfed.[json|geojson]
        ?time=&timeformat=

## Abstract API Design ##

The flux surface magnitudes might be obtained in this straightforward way:

    GET /flux/api/[scenario]/stats.json
    GET /flux/api/[scenario].json?time=2004-05-01T03:00:00

Derived quantities, such as total, net, or other aggregates, could be obtained through query parameters.
Here, the total flux for each model cell is calculated over a month:

    GET /flux/api/[scenario].json?start=2004-05-01T03:00:00&end=2004-06-01T03:00:00&aggregate=total

Here is the net flux for each model cell in a given day:

    GET /flux/api/[scenario].json?start=2004-05-01T03:00:00&end=2004-05-02T03:00:00&aggregate=net

More complicated inquiries might require aggregation on two time scales.
Here, the request is for the average in each cell of the net daily flux over a month; this is confusing:

    GET /flux/api/[scenario].json?start=2004-05-01T03:00:00&end=2004-05-02T03:00:00&aggregate=average&interval=daily&statistic=net

Need to describe non-geospatial aggregate data?

Now for uncertainy. How do you specify variance at different time scales (e.g. monthly, daily)?
Does it make sense as a resource; for example, the May, 2004 (monthly) and May 1st, 2004 (daily) variances?

    GET /flux/api/[scenario]/variance/2004/05.json
    GET /flux/api/[scenario]/variance/2004/05/01.json

Same considerations with regards to covariance; this request might deliver the entire covariance matrix:

    GET /flux/api/[scenario]/covariance/2004/05.json

Are we interested in anything other than the -mean- covariance? How is that expressed?

To get just the relative covariances, a query parameter should be used:

    GET /flux/api/[scenario]/covariance/2004/05.json?coords=-156.5,68.5
    GET /flux/api/[scenario]/covariance/2004/05.json?coords=POINT(-156.5 68.5)

Most self-descriptive?

    GET /flux/api/[scenario]/covariance/2004/05.json?lng=-156.5&lat=68.5

How do we filter the covariance matrix (get a subset)?

The probability density function is also desirable; here's how to request it for one model cell:

    GET /flux/api/[scenario]/density/

#################
# Miscellaneous #
#################

This is what a query looks like; both empty queries and queries with document(s) look the same:

    { db: 
       { domain: null,
         _events: {},
         _maxListeners: 10,
         databaseName: 'fluxvis',
         serverConfig: 
          { domain: null,
            _events: {},
            _maxListeners: 10,
            _callBackStore: [Object],
            _commandsStore: [Object],
            auth: [Object],
            _dbStore: [Object],
            host: 'localhost',
            port: 27017,
            options: [Object],
            internalMaster: true,
            connected: true,
            poolSize: 5,
            disableDriverBSONSizeCheck: false,
            _used: true,
            replicasetInstance: null,
            emitOpen: false,
            ssl: false,
            sslValidate: false,
            sslCA: null,
            sslCert: undefined,
            sslKey: undefined,
            sslPass: undefined,
            _readPreference: [Object],
            socketOptions: [Object],
            logger: [Object],
            eventHandlers: [Object],
            _serverState: 'connected',
            _state: [Object],
            recordQueryStats: false,
            db: [Circular],
            dbInstances: [Object],
            connectionPool: [Object],
            isMasterDoc: [Object] },
         options: 
          { read_preference_tags: null,
            read_preference: 'primary',
            url: 'mongodb://localhost:27017/fluxvis',
            native_parser: true,
            readPreference: [Object],
            safe: false,
            w: 1 },
         _applicationClosed: false,
         slaveOk: false,
         native_parser: true,
         bsonLib: 
          { BSON: [Object],
            Long: [Object],
            ObjectID: [Object],
            DBRef: [Function: DBRef],
            Code: [Function: Code],
            Timestamp: [Object],
            Binary: [Object],
            Double: [Function: Double],
            MaxKey: [Function: MaxKey],
            MinKey: [Function: MinKey],
            Symbol: [Function: Symbol] },
         bson: {},
         bson_deserializer: 
          { BSON: [Object],
            Long: [Object],
            ObjectID: [Object],
            DBRef: [Function: DBRef],
            Code: [Function: Code],
            Timestamp: [Object],
            Binary: [Object],
            Double: [Function: Double],
            MaxKey: [Function: MaxKey],
            MinKey: [Function: MinKey],
            Symbol: [Function: Symbol] },
         bson_serializer: 
          { BSON: [Object],
            Long: [Object],
            ObjectID: [Object],
            DBRef: [Function: DBRef],
            Code: [Function: Code],
            Timestamp: [Object],
            Binary: [Object],
            Double: [Function: Double],
            MaxKey: [Function: MaxKey],
            MinKey: [Function: MinKey],
            Symbol: [Function: Symbol] },
         _state: 'connected',
         pkFactory: 
          { [Function: ObjectID]
            index: 0,
            createPk: [Function: createPk],
            createFromTime: [Function: createFromTime],
            createFromHexString: [Function: createFromHexString] },
         forceServerObjectId: false,
         safe: false,
         notReplied: {},
         isInitializing: true,
         openCalled: true,
         commands: [],
         logger: { error: [Function], log: [Function], debug: [Function] },
         tag: 1375214586165,
         eventHandlers: 
          { error: [],
            parseError: [],
            poolReady: [],
            message: [],
            close: [] },
         serializeFunctions: false,
         raw: false,
         recordQueryStats: false,
         retryMiliSeconds: 1000,
         numberOfRetries: 60,
         readPreference: { _type: 'ReadPreference', mode: 'primary', tags: undefined } },
      collection: 
       { db: 
          { domain: null,
            _events: {},
            _maxListeners: 10,
            databaseName: 'fluxvis',
            serverConfig: [Object],
            options: [Object],
            _applicationClosed: false,
            slaveOk: false,
            native_parser: true,
            bsonLib: [Object],
            bson: {},
            bson_deserializer: [Object],
            bson_serializer: [Object],
            _state: 'connected',
            pkFactory: [Object],
            forceServerObjectId: false,
            safe: false,
            notReplied: {},
            isInitializing: true,
            openCalled: true,
            commands: [],
            logger: [Object],
            tag: 1375214586165,
            eventHandlers: [Object],
            serializeFunctions: false,
            raw: false,
            recordQueryStats: false,
            retryMiliSeconds: 1000,
            numberOfRetries: 60,
            readPreference: [Object] },
         collectionName: 'casa_gfed_3hrly',
         internalHint: null,
         opts: {},
         slaveOk: false,
         serializeFunctions: false,
         raw: false,
         readPreference: 'primary',
         pkFactory: 
          { [Function: ObjectID]
            index: 0,
            createPk: [Function: createPk],
            createFromTime: [Function: createFromTime],
            createFromHexString: [Function: createFromHexString] } },
      selector: { timestamp: Tue Apr 30 2002 23:00:00 GMT-0400 (EDT) },
      fields: undefined,
      skipValue: 0,
      limitValue: 0,
      sortValue: undefined,
      hint: null,
      explainValue: undefined,
      snapshot: undefined,
      timeout: true,
      tailable: undefined,
      awaitdata: undefined,
      numberOfRetries: 5,
      currentNumberOfRetries: 5,
      batchSizeValue: 0,
      raw: false,
      read: 'primary',
      returnKey: undefined,
      maxScan: undefined,
      min: undefined,
      max: undefined,
      showDiskLoc: undefined,
      comment: undefined,
      tailableRetryInterval: 100,
      exhaust: false,
      partial: false,
      slaveOk: false,
      totalNumberOfRecords: 0,
      items: [],
      cursorId: { _bsontype: 'Long', low_: 0, high_: 0 },
      dbName: undefined,
      state: 0,
      queryRun: false,
      getMoreTimer: false,
      collectionName: 'fluxvis.casa_gfed_3hrly' }

