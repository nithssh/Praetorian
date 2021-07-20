// generate verification code
// call the db module code
// call the email module code

class SessionInfo {
  constructor(email, code, timestamp) {
    this.email = email;
    this.verificationCode = code;
    this.timestamp = timestamp;
  }
}

class VerifiedEmail {
  constructor(email, timestamp) {
    this.email = email;
    this.timestamp = timestamp;
  }
}

function generateCode() {
  // simple 6 digit numeric code for now
  // TODO change to more complex code
  return randomIntFromInterval(100000, 999999);
}

// Generate random integer, within min and max included range.
function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
