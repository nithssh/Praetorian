const sqlite = require("sqlite3");
const { sendMail } = require("./email");

class DB {
  constructor() {
    this.db = new sqlite.Database("./database.db", (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log("Connected to Database.");
      }
      this.db.run(`CREATE TABLE IF NOT EXISTS ActiveVeriTable (
        email TEXT PRIMARY KEY UNIQUE,
        discord_id INTEGER NOT NULL UNIQUE,
        code INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
        )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS VerifiedTable (
        email TEXT PRIMARY KEY UNIQUE,
        discord_id INTEGER NOT NULL UNIQUE,
        timestamp INTEGER NOT NULL
        )`);
    });
  }

  /*
   * Endpoints:
   *    - Email is already verified
   *    - No current session / session history -> Modifies DB
   *    - Already active and unexpired session
   *    - Previously expired session -> Modifies DB
   */
  // TODO Refactor this function to be less trash
  storeSessionInfo(SessionInfo) {
    this.db.serialize(() => {
      // Check if email is already verified
      this.db.get( `SELECT * FROM VerifiedTable WHERE email=?`, SessionInfo.email, (err, row) => {
          if (row !== undefined) {
            // console.log("This email is already verified.");
            // doEmailAlreadyVerified(SessionInfo)
          } else {
            // Check if there is no session currently
            this.db.get(`SELECT * FROM ActiveVeriTable WHERE email=?`, SessionInfo.email, (err, row) => {
                if (row === undefined) {
                  this.db.run(
                    `INSERT INTO ActiveVeriTable
                    (email, discord_id, code, timestamp) 
                     VALUES (?, ?, ?, ?)
                    `,
                    [
                      SessionInfo.email,
                      SessionInfo.discord_id,
                      SessionInfo.verificationCode,
                      SessionInfo.timestamp,
                    ]
                    );
                    doValidRequest(SessionInfo);
                } else {
                  let recordDate = new Date(row.timestamp);
                  let currentDate = new Date();
                  if (currentDate.getTime() - recordDate.getTime() <= 900000) {
                    // 15 mins
                    // console.log("Session already active and unexpired");
                    // doSessionAlreadyActive(SessionInfo);
                  } else {
                    console.log("previous session Expired");
                    this.db.run(
                      `UPDATE ActiveVeriTable
                        SET code=?,
                            timestamp=?
                        WHERE email=?`,
                      [
                        SessionInfo.code,
                        SessionInfo.timestamp,
                        SessionInfo.email,
                      ]
                    );
                    doValidRequest(SessionInfo);
                  }
                }
              }
            );
          }
        }
      );
    });
  }

  storeVerifiedUser(VerifiedEmail) {
    throw Error("Not implemented.");
  }

  async getSessionCode(discord_id, callback) {
    this.db.get(`SELECT * FROM ActiveVeriTable WHERE discord_id=?`, discord_id, function(err, row) {
      // TODO check if session is expired first
      if (row === undefined) {
        callback(-1);
      } else {
        callback(row.code);
      }
    });
  }

  exit() {
    this.db.close();
  }
}

function doValidRequest(SessionInfo) {
  sendMail(SessionInfo.email, SessionInfo.verificationCode);
}

module.exports = { DB };
