const { DB } = require("./db");
const { sendMail } = require("./email");
const db = new DB();

class SessionInfo {
  constructor(email, code, timestamp, discord_id) {
    this.email = email;
    this.discord_id = discord_id;
    this.verificationCode = code;
    this.timestamp = timestamp;
  }
}

class VerifiedEmail {
  constructor(email, timestamp, discord_id) {
    this.email = email;
    this.discord_id = discord_id;
    this.timestamp = timestamp;
  }
}

function startVerificationProcess(email, discord_id) {
  let session = createVerficationSession(email, discord_id);
  db.storeSessionInfo(session);
  sendMail(session.email, session.verificationCode);
}

function validateCode(userCode, discord_id) {
  let dbCode = db.getSessionCode(discord_id);
  if (dbCode === -1) {
    return undefined; // no active verifcation session
  }
  if (userCode === dbCode){
    return true;
  } else {
    return false;
  }
}

function createVerficationSession(email, discord_id) {
  let code = generateCode();
  let timestamp = new Date().getTime();
  let session = new SessionInfo(email, code, timestamp, discord_id);
  return session;
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

module.exports = { startVerificationProcess, validateCode };