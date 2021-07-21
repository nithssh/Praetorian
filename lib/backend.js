const { sendMail } = require("./email");
const { DB } = require("./db");
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

function createVerficationSession(email, discord_id) {
  let code = generateCode();
  let timestamp = new Date().getTime();
  let session = new SessionInfo(email, code, timestamp, discord_id);
  return session;
}

function startVerificationProcess(email, discord_id, callback) {
  let session = createVerficationSession(email, discord_id);
  db.storeSessionInfo(session, (status) => {
    if (status == "EmailAlreadyTaken") {
      callback("EmailAlreadyTaken");
    } else if (status == "SessionAlreadyActive") {
      callback("SessionAlreadyActive");
    } else if (status == "SuccessfullyCreated") {
      sendMail(SessionInfo.email, SessionInfo.verificationCode);
      callback("SuccessfullyCreated");
    } else if (status == "SuccessfullyUpdated") {
      sendMail(SessionInfo.email, SessionInfo.verificationCode);
      callback("SuccessfullyUpdated");
    } else {
      console.error("storeSessionInfo returned unexpected value.")
    }
    
  });
}

function validateCode(userCode, discord_id, callback) {
  db.getSessionCode(discord_id, (dbCode) => {
    if (dbCode == "NoActiveSession") {
      callback("NoActiveSession");
    } else if (dbCode == "LastSessionExpired") {
      callback("LastSessionExpired");
    } else if (userCode == dbCode) {
      storeVerifiedEmail(discord_id);
      callback(true);
    } else {
      callback(false);
    }
  });
}

function storeVerifiedEmail(discord_id) {
  db.getSessionInfo(discord_id, function (row) {
    let verifiedProfile = new VerifiedEmail(
      row.email,
      row.timestamp,
      row.discord_id
    );
    db.storeVerifiedUser(verifiedProfile);
  });
}

function generateCode() {
  // TODO change to more complex code
  return randomIntFromInterval(100000, 999999);
}

// Generate random integer, within min and max included range
function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

module.exports = {
  startVerificationProcess,
  validateCode,
};
