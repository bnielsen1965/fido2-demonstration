
// application configuration
module.exports = {
  debug: false,

  // web server settings
  webServer: {
    port: 8080,
    address: "0.0.0.0",
    certFile: "./localhost.crt",
    keyFile: "./localhost.key"
  },

  // Fido2Lib settings
  fido2Lib: {
    timeout: 42,
    relyingParty: {
      id: "localhost",
      name: "Local Host",
      // icon: "https://localhost:8080/logo.png"
    },
    origin: "https://localhost:8080",
    userIdSize: 32,
    challengeSize: 128,
    attestation: "none",
    cryptoParams: [-7, -257],
    authenticatorAttachment: "cross-platform",
    authenticatorRequireResidentKey: false,
    authenticatorUserVerification: "preferred", // "required" // if "required" then a pin will be required on the fido2 token
    attestationFactor: "either", // "first" requires authenticator verification, i.e. pin number, "second" requires authenticator user presence verification, i.e. press the button, "either" will accept either verification method
    assertionFactor: "either" // "first" requires authenticator verification, i.e. pin number, "second" requires authenticator user presence verification, i.e. press the button, "either" will accept either verification method
  }
};
