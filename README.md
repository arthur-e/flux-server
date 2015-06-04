The Carbon Data Explorer Web API Server ("flux-server")
=======================================================

* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

Installation
---------------------------------

If you already successfully ran the `CarbonDataExplorer/setup.sh` script,
**IGNORE** this section; installation is already completed.

If Node.js and NPM are not already installed, skip to the next section and then come back.
With Node.js and NPM installed, before anything else, run `setup.sh` with root privileges to install some dependencies globally.

    $ sudo . setup.sh

Then, from the project root run the following to install dependencies:

    $ npm install

For more information on dependencies, read `package.json`.


### Installing Node.js and the Node Package Manager (NPM)

* On Ubuntu Linux 12.04, 12.10 and 13.04:

        $ sudo apt-get install nodejs nodejs-legacy
        $ curl http://npmjs.org/install.sh | sh

* On Ubuntu Linux 13.10 and later:

        $ sudo apt-get install nodejs nodejs-legacy
        $ sudo apt-get install npm


### Installing MongoDB

If MongoDB was not already installed along with the Python API (`flux-python-api`), follow these instructions.

#### On Ubuntu Linux:

The Ubuntu package management tool (i.e. `dpkg` and `apt`) ensure package consistency and authenticity by requiring that distributors sign packages with GPG keys. Issue the following command to import the 10gen public GPG Key:

    $ sudo apt-key adv --keyserver keyserver.ubuntu.com --recv 7F0CEB10

Create a `/etc/apt/sources.list.d/10gen.list` file and include the following line for the 10gen repository.

    $ echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/10gen.list

Now issue the following command to reload your repository:

    $ sudo apt-get update

Issue the following command to install the latest stable version of MongoDB:

    $ sudo apt-get install mongodb-10gen


* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

Code Documentation
---------------------------------

Code documentation can be generated with [docco](http://jashkenas.github.io/docco/). To install `docco`:

    $ sudo npm install docco -g

To generate the documentation:

    $ docco -l classic ./*.js ./api/*.js

To access the generated documentation, point your browser to this directory location:

    file:///usr/local/project/CarbonDataExplorer/flux-server/docs/


* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

Deployment
---------------------------------

The server is expected to be run on a Unix-like system (GNU Linux or Mac OS X) from the directory specified by `PROJ_DIR` in `core.js`; the default is:

    var PROJ_DIR = '/usr/local/project/CarbonDataExplorer/flux-server';

If you want to use this default, simply clone the `flux-server` repo to this location.
If not, clone it or move it somewhere else and change `PROJ_DIR` accordingly.

The server can be run with Node.js from the command line or with `forever`, which wraps Node.js and provides fault-tolerance and automatic restarts; `forever` is recommended over Node.js.

To start the server:

    $ forever start flux-server.js

To stop the server:

    $ forever stop flux-server.js


### Configuring a Port Proxy with Apache

The Node.js server is configured to run on Port 8080.
This can be changed on the last line of `flux-server.js` if necessary (for example, due to a conflict with an existing service running on the port).
To enable the server to handle requests on Port 80, the standard port for HTTP requests, a proxy is needed.
We recommend the Apache server

#### Installing Apache

* On GNU/Linux:

        $ sudo apt-get install apache2 apache2-bin apache2-data apache2-mpm-worker

        # Activate modules that were not activated at installation
        $ sudo a2enmod proxy proxy_http rewrite

### Configuring the Port Proxy

The following Apache configuration can be used for port proxying:

    ############################################################################
    # Reverse proxies for NASA ACOS
    ############################################################################

    <Location /flux>
        ProxyPass http://127.0.0.1:8080/flux
        ProxyPassReverse http://127.0.0.1:8080/flux
        Order allow,deny
        Allow from all
    </Location>

### Automatically Starting the Server

There are two methods to making sure the server is restarted when the host server reboots.
In both examples below, substitute the appropriate username for `{username}` and, if needed, edit the path to the `flux-server` directory.

The easiest way on GNU/Linux is to make a new `crontab` entry:

    @reboot (cd /usr/local/project/flux-server/; /usr/bin/sudo -u {username} /usr/local/bin/forever start /usr/local/project/flux-server/flux-server.js)

However, the crontab entry might not work on all GNU/Linux systems (tested with Ubuntu Linux 12.04 & 14.04).
If the above does not work, add the following line to `/etc/rc.local` before the line `exit 0`:

    (cd /usr/local/project/flux-server/; /usr/bin/sudo -u {username} /usr/local/bin/forever start /usr/local/project/flux-server/flux-server.js)
