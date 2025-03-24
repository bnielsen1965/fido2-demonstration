
const Config = require("./config.js");
const https = require("https");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const bodyparser = require("body-parser");
const cookieparser = require("cookie-parser");
const { Fido2Lib } = require('fido2-lib');

const f2l = createFido2Lib(Config);
const app = express();
const server = createWebServer(Config, app);


// sessions in the express app are required to track user details between requests
app.use(session({
  secret: "random string",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}));

// configure express app parsers
app.use(bodyparser.urlencoded({ extended: true }));
app.use(bodyparser.json());
app.use(cookieparser());

// configure express app routes
app.post("/auth/register-begin", postAttestationUser);
app.post("/auth/register-complete", postAttestationResponse);
app.post("/auth/login-begin", postAssertionUser);
app.post("/auth/login-complete", postAssertionResponse);

// configure static content hosting
app.use(express.static("./public"));

// start server listening for requests
server.listen(Config.webServer.port, Config.webServer.address, () => console.log(`Listening on port ${Config.webServer.port}`));




// route handler "/auth/register-begin" to start registration with post of user details
async function postAttestationUser (req, res, next) {
  let attestationOptions;
  try {
    // define a user object for registration
    const user = {
      id: createUserId(Config),
      name: req.body.username,
      displayName: req.body.displayName
    };

    // generate registration attestation options for registration request
    attestationOptions = await f2l.attestationOptions();

    // adjust attestation options before returning in JSON response
    attestationOptions.user = user;
    attestationOptions.challenge = Buffer.from(attestationOptions.challenge).toString("base64");
    attestationOptions.origin = Config.fido2Lib.origin;

    // store registration details in user session
    req.session.challenge = attestationOptions.challenge;
    req.session.username = user.name;
    req.session.displayName = user.displayName;
    req.session.userHandle = user.id;
  } 
  catch (error) {
    return res.status(400).json({ error: `Error generating attestation options. ${error.message}` });
  }

  res.json(attestationOptions);
}


// route handler "/auth/register-complete" to complete registration by testing attestation response
async function postAttestationResponse (req, res, next) {
  let attestationResult;
  // validate attestation response
  try {
    // assemble expectations for validation of attestation response
    const attestationExpectations = {
      challenge: req.session.challenge,
      origin: Config.fido2Lib.origin,
      factor: Config.fido2Lib.attestationFactor
    };
    // assemble the response for validation
    const attestationResponse = {
      ...req.body,
      rawId: base64ToArrayBuffer(req.body.rawId)
    };
    // execute validation
    attestationResult = await f2l.attestationResult(attestationResponse, attestationExpectations);
  }
  catch (error) {
    return res.json({ error: `Error validating attestation response. ${error.message}`});
  }

  // save the user registration
  try {
    const users = getUsers();
    users[req.session.username] = {
      id: req.body.id,
      rawId: req.body.rawId,
      counter: attestationResult.authnrData.get("counter"),
      publicKey: attestationResult.authnrData.get("credentialPublicKeyPem"),
      userHandle: req.session.userHandle
    };
    saveUsers(users);
  }
  catch (error) {
    return res.json({ error: `Error saving user registration. ${error.message}`});
  }
  res.json({ success: true });
}


// route handler "/auth/login-begin" to start authentication of user
async function postAssertionUser (req, res, next) {
  let assertionOptions;
  // generate assertion options for user authentication
  try {
    assertionOptions = await f2l.assertionOptions();
    const user = getUser(req.body.username);
    assertionOptions.allowCredentials = [{
      id: user.rawId,
      type: 'public-key'
    }];
    assertionOptions.origin = Config.fido2Lib.origin;
    assertionOptions.challenge = Buffer.from(assertionOptions.challenge).toString('base64');

    // record login details in user session
    req.session.challenge = assertionOptions.challenge;
    req.session.username = req.body.username;
  }
  catch (error) {
    return res.status(400).json({ error: `Error generating assertion options. ${error.message}` });
  }

  res.json(assertionOptions);
}


// route handler "/auth/login-complete" to complete authentication and validate assertion response
async function postAssertionResponse (req, res, next) {
  let assertionResult;
  // validate assertion response
  try {
    // assemble assertion expectations
    const user = getUserById(req.body.id);
    const assertionExpectations = {
      origin: Config.fido2Lib.origin,
      factor: Config.fido2Lib.assertionFactor,
      challenge: req.session.challenge,
      prevCounter: user.counter,
      publicKey: user.publicKey,
      userHandle: user.userHandle
    };
    // assemble assertion response
    let assertionResponse = {
      ...req.body,
      rawId: base64ToArrayBuffer(req.body.rawId)
    };
    // validate assertion
    assertionResult = await f2l.assertionResult(assertionResponse, assertionExpectations);
  }
  catch (error) {
    return res.status(400).json({ error: `Error validating assertion response. ${error.message}`});
  }

  res.json({ success: true });
}




//
// miscellaneous methods
//

// convert base64 string to array buffer
function base64ToArrayBuffer (base64) {
  let buffer = Buffer.from(base64, "base64");
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}


// create an HTTPS web server
function createWebServer (config, expressApp) {
  let key, cert, server;
  try {
    key = fs.readFileSync(config.webServer.keyFile);
    cert = fs.readFileSync(config.webServer.certFile);
  }
  catch (error) {
    throw new Error(`Error reading web server key and certificate files. ${error.message}`);
  }

  try {
    server = https.createServer({ key, cert }, expressApp);
  }
  catch (error) {
    throw new Error(`Error creating HTTPS web server. ${error.message}`);
  }

  return server;
}


// create Fido2Lib instance
function createFido2Lib (config) {
  let f2l;
  try {
    f2l = new Fido2Lib({
      timeout: config.fido2Lib.timeout,
      rpId: config.fido2Lib.relyingParty.id,
      rpName: config.fido2Lib.relyingParty.name,
      rpIcon: config.fido2Lib.relyingParty.icon,
      challengeSize: config.fido2Lib.challengeSize,
      attestation: config.fido2Lib.attestation,
      cryptoParams: config.fido2Lib.cryptoParams,
      authenticatorAttachment: config.fido2Lib.authenticatorAttachment,
      authenticatorRequireResidentKey: config.fido2Lib.authenticatorRequireResidentKey,
      authenticatorUserVerification: config.fido2Lib.authenticatorUserVerification
    });
  }
  catch (error) {
    throw new Error(`Error creating Fido2Lib instance. ${error.message}`);
  }

  return f2l;
}


// create a user id for new user registration
function createUserId (config) {
  return Buffer.from(crypto.randomBytes(config.fido2Lib.userIdSize)).toString("base64");
}


// get a registered user record from users file
function getUser (username) {
  const users = getUsers();
  const user = users[username];
  if (!user) throw new Error(`No registered user with username ${username}.`);
  return user;
}

// get a registered user record from users file by id
function getUserById (id) {
  const users = getUsers();
  let user;
  Object.keys(users).forEach(username => {
    if (users[username].id == id) user = users[username];
  });
  if (!user) throw new Error(`No user with id ${id}`);
  return user;
}

// get users list from file
function getUsers () {
  let users = {};
  try {
    users = JSON.parse(fs.readFileSync("./users.json").toString());
  }
  catch (error) {}
  return users;
}

// save users list to file
function saveUsers (users) {
  fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));
}
