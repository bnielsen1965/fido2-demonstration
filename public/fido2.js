

const debugEnabled = false;

//
// UI methods
//


// handler for register button
async function registerUser() {
  clear();
  if (!webAuthnSupport) return appendError("Web browser does not support WebAuthn.");

  // get attestation options from the server for the registering user
  const registrationUser = getUserInputs();
  if (!registrationUser.username.length) return appendError("Username is required.");
  if (!registrationUser.displayName.length) return appendError("Display Name is required.");
  const attestationOptions = await requestAttestationOptions(registrationUser);
  if (!attestationOptions) return appendError("Registration failed, no attestation options from server.");

  // use attestation options to request public key credentials from the fido2 token through the web browser
  const credentials = await attestationOptionsToPublicKeyCredentials(attestationOptions);
  if (!credentials) return appendError("Registration failed, no credentials returned by fido2 token.");

  // use the credentials to request attestation results from the server for the registering user
  const attestationResult = await requestAttestationResult(credentials);
  if (!attestationResult) return appendError("Registration failed, no attestation result returned by server.");
  if (attestationResult.error) return appendError(`Registration error from server. ${attestationResult.error}`);

  // attestation successful, user is registered
  appendMessage(`User ${registrationUser.displayName} registration complete.`);
}


// handler for login button
async function loginUser() {
  clear();
  if (!webAuthnSupport) return appendError("Web browser does not support WebAuthn.");

  // get assertion options from the server for the authenticating user
  const loginUser = getUserInputs();
  if (!loginUser.username.length) return appendError("Username is required.");
  const assertionOptions = await requestAssertionOptions({ username: loginUser.username });
  if (!assertionOptions) return appendError("Login failed, no assertion options from server.");

  // use assertion options to request credentials from the fido2 token through the web browser
  const credentials = await assertionOptionsToPublicKeyCredentials(assertionOptions);
  if (!credentials) return appendError("Login failed, no credentials returned by fido2 token.");

  // use the credentials to request assertion results from the server for the authenticationg user
  const assertionResult = await credentialsToAssertionResult(credentials);
  if (!assertionResult) return appendError("Login failed, no assertion result returned by server.");
  if (assertionResult.error) return appendError(`Login error from server. ${assertionResult.error}`);

  // login successful
  appendMessage(`User ${loginUser.username} successfully authenticated.`);
}


// get user details from form inputs
function getUserInputs () {
  return {
    username: document.getElementById("username").value,
    displayName: document.getElementById("displayname").value
  }
}


// clear message containers in web page
function clear () {
  document.getElementById("error").innerHTML = "";
  document.getElementById("message").innerHTML = "";
}


// append an error message to the web page container
function appendError (error) {
  document.getElementById("error").insertAdjacentHTML("beforeend", `${error}<br>`);
}


// append a message to the web page container
function appendMessage (message) {
  document.getElementById("message").insertAdjacentHTML("beforeend", `${message}<br>`);
}




//
// attestation methods for user registration
//

// request attestation options from server for user registration
async function requestAttestationOptions (registrationUser) {
  debug(`Request attestation options for registration of user: ${JSON.stringify(registrationUser, null, 2)}`);

  let attestationOptions;
  // request attestation options from the server for the registering user
  try {
    let httpResponse = await fetch('/auth/register-begin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationUser)
    });
    attestationOptions = await httpResponse.json();
    if (attestationOptions.error) throw new Error(attestationOptions.error);
  }
  catch (error) {
    return appendError(`Failed to get attestation options from server. ${error.message}`);
  }

  debug(`Recieved attestation options for user registration: ${JSON.stringify(attestationOptions, null, 2)}`);

  return attestationOptions;
}


// use attestation options to create fido2 token public key credentials through browser
async function attestationOptionsToPublicKeyCredentials (attestationOptions) {
  debug(`Generate public key credentials for user registration with attestation options...`);

  let credentialsSettings, credentials;
  // assemble credential settings from attestation options
  try {
    credentialsSettings = {
      publicKey: {
        ...attestationOptions,
        challenge: base64ToBuffer(attestationOptions.challenge), // convert attestation options challenge value from base64 to array buffer
        user: {
          ...attestationOptions.user,
          id: base64ToBuffer(attestationOptions.user.id) // convert attestation options user id value from base64 to array buffer
        }
      }
    };
  }
  catch (error) {
    return appendError(`Failed to assemble credential settings needed to create public key credentials. ${error.message}`);
  }

  // use fido2 token to create public key credentials based on provided settings
  try {
    credentials = await navigator.credentials.create(credentialsSettings);
  }
  catch (error) {
    return appendError(`Failed to create attestation credentials. ${error.message}`);
  }

  debug(`Generated public key credentials for user registration: ${JSON.stringify(credentials, null, 2)}`);

  return credentials;
}


// use credentials created from attestation options to request an attestation result from the server
async function requestAttestationResult (credentials) {
  let attestationResponse, attestationResult;
  // assemble credentials returned by browser into an attestation response for the server
  try {
    attestationResponse = {
      id: credentials.id, // the credentials id is already base64 encoded, note that this encoding may not be compatible with browser
      rawId: bufferToBase64(credentials.rawId), // base64 encode credentials rawId buffer, note that this id should be used by the browser as it can be safely decoded
      response: {
        attestationObject: bufferToBase64(credentials.response.attestationObject), // base64 encode attestation object buffer
        clientDataJSON: bufferToBase64(credentials.response.clientDataJSON) // base64 encode client data JSON buffer
      }
    };
  }
  catch (error) {
    return appendError(`Failed to assemble attestation response from credentials. ${error.message}`);
  }

  debug(`Request result from attestation response for user registration: ${JSON.stringify(attestationResponse, null, 2)}`);

  // use credentials from fido2 token to validate attestation from server
  try {
    let httpResponse = await fetch('/auth/register-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attestationResponse)
    });
    attestationResult = await httpResponse.json();
    if (attestationResult.error) throw new Error(attestationResult.error);
  }
  catch (error) {
    return appendError(`Failed to get attestation result from server. ${error.message}`);
  }

  debug(`Successful attestation result for user registration: ${JSON.stringify(attestationResult, null, 2)}.`);

  return attestationResult;
}




//
// assertion methods for user authentication

// request assertion options from server for authenticating user
async function requestAssertionOptions (loginUser) {
  debug(`Request assertion options for authentication of user: ${JSON.stringify(loginUser, null, 2)}`);

  let assertionOptions;
  try {
    let httpResponse = await fetch('/auth/login-begin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginUser)
    });
    assertionOptions = await httpResponse.json();
    if (assertionOptions.error) throw new Error(assertionOptions.error);
  }
  catch (error) {
    return appendError(`Failed to get assertion options from server. ${error.message}`);
  }

  debug(`Recieved assertion options for user authentication: ${JSON.stringify(assertionOptions, null, 2)}`);

  return assertionOptions;
}

// use assertion options to create public key credentials through browser
async function assertionOptionsToPublicKeyCredentials (assertionOptions) {
  let credentialsSettings, credentials;
  try {
    credentialsSettings = {
      publicKey: {
        ...assertionOptions,
        challenge: base64ToBuffer(assertionOptions.challenge),
        allowCredentials: assertionOptions.allowCredentials.map(cred => {
          return {
            ...cred,
            id: base64ToBuffer(cred.id) // convert base64 encoded id to array buffer
          }
        })
      }
    };

    debug(`Generate public key credentials for user authentication using credential settings: ${JSON.stringify(credentialsSettings, null, 2)}`);

    credentials = await navigator.credentials.get(credentialsSettings);
  }
  catch (error) {
    return appendError(`Failed to create assertion credentials. ${error.message}`);
  }

  debug(`Generated public key credentials for user authentication: ${JSON.stringify(credentials, null, 2)}`);

  return credentials;
}

// use credentials created from assertion options to request an assertion result from the server
async function credentialsToAssertionResult (credentials) {
  let assertionResponse, assertionResult;
  // assemble credentials returned by browser into an assertion response for the server
  try {
    assertionResponse = {
      id: credentials.id,
      rawId: bufferToBase64(credentials.rawId),
      response: {
        authenticatorData: bufferToBase64(
          credentials.response.authenticatorData
        ),
        clientDataJSON: bufferToBase64(
          credentials.response.clientDataJSON
        ),
        signature: bufferToBase64(
          credentials.response.signature
        )
      }
    };
  }
  catch (error) {
    return appendError(`Failed to assemble assertion response from credentials. ${error.message}`);
  }

  debug(`Request result from assertion response for user authentication: ${JSON.stringify(assertionResponse, null, 2)}`);

  try {
    let httpResponse = await fetch('/auth/login-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assertionResponse)
    });
    assertionResult = await httpResponse.json();
    if (assertionResult.error) throw new Error(assertionResult.error);
  }
  catch (error) {
    return appendError(`Failed to get assertion result from server. ${error.message}`);
  }

  debug(`Successful asertion result for user authentication: ${JSON.stringify(assertionResult, null, 2)}.`);

  return assertionResult;
}




//
// encode / decode methods
//

// convert a buffer object to a base64 encoded string
function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

// convert a base64 encoded string to a array buffer object
function base64ToBuffer(base64) {
  return stringToBuffer(atob(base64));
}

// convert string to an array buffer object
function stringToBuffer (str) {
  return Uint8Array.from(str, c => c.charCodeAt(0));
}




//
// miscellaneous methods
//

// validate that browser has webauthn support for public key credentials
function checkWebAuthnSupport () {
  if (!window.PublicKeyCredential) {
    appendError("WebAuthn not supported.");
    return false;
  }
  else {
    appendMessage("WebAuthn support found.");
    return true;
  }
}


// log debug messages
function debug (msg) {
  if (debugEnabled) appendMessage(`<pre>${msg}</pre>`);
}