const { sendMail } = require("./email");
const { SessionInfo, VerifiedEmail } = require("./datamodels");
const { DB } = require("./db");
const db = new DB();

function createVerficationSession(email, discord_id, server_id) {
  let code = generateCode();
  let timestamp = new Date().getTime();
  let session = new SessionInfo(email, discord_id, server_id, code, timestamp);
  return session;
}

function startVerificationProcess(email, discord_id, server_id, callback) {
  let session = createVerficationSession(email, discord_id, server_id);
  db.storeSessionInfo(session, (status) => {
    if (status == "EmailAlreadyTaken") {
      callback("EmailAlreadyTaken");
    } else if (status == "SessionAlreadyActive") {
      callback("SessionAlreadyActive");
    } else if (status == "SuccessfullyCreated") {
      sendMail(session.email, session.verificationCode);
      callback("SuccessfullyCreated");
    } else if (status == "SuccessfullyUpdated") {
      sendMail(session.email, session.verificationCode);
      callback("SuccessfullyUpdated");
    } else if (status == "ServerMemberAlreadyVerified") {
      callback("ServerMemberAlreadyVerified");
    } else {
      console.error("storeSessionInfo returned unexpected value.")
    }
  });
}

function validateCode(userCode, discord_id, server_id, callback) {
  db.getSessionCode(discord_id, server_id, (dbCode) => {
    if (dbCode == "NoActiveSession") {
      callback("NoActiveSession");
    } else if (dbCode == "LastSessionExpired") {
      callback("LastSessionExpired");
    } else if (userCode == dbCode) {
      storeVerifiedEmail(discord_id, server_id);
      callback(true);
    } else {
      callback(false);
    }
  });
}

function storeVerifiedEmail(discord_id, server_id) {
  db.getSessionInfo(discord_id, server_id, function (row) {
    let verifiedProfile = new VerifiedEmail(
      row.email,
      row.discord_id,
      row.server_id,
      row.timestamp,
    );
    db.storeVerifiedUser(verifiedProfile);
  });
}

function queryServerPreferences(server_id, callback) {
  db.getServerPreferences(server_id, (row) => {
    callback(row);
  });
}

function setServerPreferences(ServerPreferences) {
  db.setSeverPreferences(ServerPreferences);
}

function createServerPreferences(server_id) {
  db.createServerPreferences(server_id);
}

function generateCode() {
  // maybe change to a more complex code.
  return randomIntFromInterval(100000, 999999);
}

// Generate random integer, within min and max included range
function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

module.exports = {
  startVerificationProcess,
  validateCode,
  queryServerPreferences,
  createServerPreferences,
  setServerPreferences  
};
