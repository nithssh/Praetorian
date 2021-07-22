class SessionInfo {
  constructor(email, discord_id, server_id, code, timestamp) {
    this.email = email;
    this.discord_id = discord_id;
    this.server_id = server_id;
    this.verificationCode = code;
    this.timestamp = timestamp;
  }
}

class VerifiedEmail {
  constructor(email, discord_id, server_id, timestamp) {
    this.email = email;
    this.discord_id = discord_id;
    this.server_id = server_id;
    this.timestamp = timestamp;
  }
}

// class ServerPreferences {
//   constructor() {

//   }
// }

module.exports = { SessionInfo, VerifiedEmail }