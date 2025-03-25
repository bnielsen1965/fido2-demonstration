# fido2-demonstration

This NodeJS application demonstrates FIDO2 user registration and authentication
through a web page and API hosted by an expressjs server and a client web page 
loaded in a web browser.


# requirements

- The NodeJS executable.
- A web browser that supports WebAuthn.
- A FIDO2 authenticator, i.e. Yubikey, uTrust FIDO2 Security Key, etc.


# install

- Clone the repository and use *npm install* to install the module dependencies.
- Start the web server by executing the NodeJS application, *node index.js*.
- Open the authentication web page in a web browser, *https://localhost:8080*


# demonstration

- Plug in your FIDO2 authenticator.
- Enter a username and display name in the web page.
- Click the Register button and follow the authenticator instructions (enter pin if required, press the authenticator button).
- After successful registration click the Login button and follow the authenticator instructions.

If everything works as expected you should see messages in the web page indicating success.


# configuration

The server configuration is stored in the config.js file.

The default configuration is setup to run the server on localhost. These 
webServer settings can be modified as needed and the self signed 
certificate and key replaced to run the demonstration on a host other 
than localhost.

Edit the fido2Lib settings as needed to test other FIDO2 authentication options.
I.E. The default settings are more lenient and will accept authentication without a pin.


# debugging

The web server debug messages can be enabled by editing the config.js and 
setting the debug field to true.

The web page debug messages can be enabled by editing the public/fido2.js 
file and setting the debugEnabled field to true.


# registration sequence

When a new user registers with the web server they start by sending some user 
details to the server in a request for attestation options from the web server.

The attestation options received from the web server are then used in the web 
browser to assemble credential settings that are then passed to the fido2-lib 
to request credentials from the authenticator.

The authenticator may require entry of an authentication pin number if set and 
will expect the user to press the authenticator button to verify their presence.
Once the authenticator is statisfied it will return the generated credentials 
to the web browser.

An attestation response is assembled by the web browser using the credentials 
provided by the authenticator and the attestation response is sent to the web server.

The web server validates the attestation response and on success stores the user 
details in the user store along with the public key and id from the authenticator 
credentials.

And the server finally responds to the web browser with the attestation success 
status for the registration process.

    +-----------------------+            +----------------+       +--------------------------+          +---------------------+
    |                       |            |                |       |                          |          |                     |
    | authenticator:usb key |            | client:browser |       | relying party:web server |          | user store:database |
    |                       |            |                |       |                          |          |                     |
    +-----------------------+            +----------------+       +--------------------------+          +---------------------+
                                                                                                                              
                |                                |                              |                                   |          
                |                                |                              |                                   |          
                |                                |                              |                                   |          
                |                                | request attestation options  |                                   |          
                |                                |       (user details)         |                                   |          
                |                                |                              |                                   |          
                |                                | ---------------------------> |                                   |          
                |                                |                              |                                   |          
                |                                |                              |                                   |          
                |                                |            response          |                                   |          
                |                                |      (attestation options)   |                                   |          
                |                                |                              |                                   |          
                |                                | <--------------------------- |                                   |          
                |                                |                              |                                   |          
                |        create credentials      |                              |                                   |          
                |      (credential settings)     |                              |                                   |          
                |                                |                              |                                   |          
                | <------------------------------+                              |                                   |          
                |                                |                              |                                   |          
                |                                |                              |                                   |          
                |           response             |                              |                                   |          
                |         (credentials)          |                              |                                   |          
                |                                |                              |                                   |          
                | -----------------------------> |                              |                                   |          
                |                                |                              |                                   |          
                |                                |                              |                                   |          
                |                                |  request attestation result  |                                   |          
                |                                |    (attestation response)    |                                   |          
                |                                |                              |                                   |          
                |                                | ---------------------------> |                                   |          
                |                                |                              |                                   |          
                |                                |                              |             save user             |          
                |                                |                              | (public key, credential id, etc.) |          
                |                                |                              |                                   |          
                |                                |                              | --------------------------------> |          
                |                                |           response           |                                   |          
                |                                |       (success status)       |                                   |          
                |                                |                              |                                   |          
                |                                | <--------------------------- |                                   |          
                |                                |                              |                                   |          
                |                                |                              |                                   |          


