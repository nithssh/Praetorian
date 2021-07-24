const sqlite = require("sqlite3");

class DB {
  constructor() {
    this.db = new sqlite.Database("./database.db", (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log("Connected to Database.");
      }
      this.db.run(`CREATE TABLE IF NOT EXISTS ActiveVeriTable (
        email TEXT NOT NULL,
        discord_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        code INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
        )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS VerifiedTable (
        email TEXT NOT NULL,
        discord_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL
        )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS ServerPreferencesTable (
        server_id TEXT PRIMARY KEY UNIQUE,
        prefix TEXT NOT NULL,
        domain TEXT,
        cmd_channel TEXT,
        role_id TEXT
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
  storeSessionInfo(SessionInfo, callback) {
    // Check if user is already verified in the server
    this.db.get(`SELECT * FROM VerifiedTable WHERE discord_id=? AND server_id=?`,
      [
        SessionInfo.discord_id,
        SessionInfo.server_id
      ], (err, row) => {
        if (row !== undefined) {
          callback("ServerMemberAlreadyVerified")
        } else {
          // Check if email is already taken
          this.db.get(`SELECT * FROM VerifiedTable WHERE email=? AND server_id=?`,
            [
              SessionInfo.email,
              SessionInfo.server_id
            ],
            (err, row) => {
              if (row !== undefined) {
                callback("EmailAlreadyTaken");
              } else {
                // Check if there is no session currently
                this.db.get(`SELECT * FROM ActiveVeriTable WHERE email=? AND server_id=?`,
                  [
                    SessionInfo.email,
                    SessionInfo.server_id
                  ], (err, row) => {
                    if (row === undefined) {
                      this.db.run(
                        `INSERT INTO ActiveVeriTable
                        (email, discord_id, server_id, code, timestamp) 
                         VALUES (?, ?, ?, ?, ?)
                        `,
                        [
                          SessionInfo.email,
                          SessionInfo.discord_id,
                          SessionInfo.server_id,
                          SessionInfo.verificationCode,
                          SessionInfo.timestamp,
                        ]
                      );
                      callback("SuccessfullyCreated");
                    } else {
                      let recordDate = new Date(row.timestamp);
                      let currentDate = new Date();
                      if (currentDate.getTime() - recordDate.getTime() <= 900000) {
                        callback("SessionAlreadyActive");
                      } else {
                        this.db.run(
                          `UPDATE ActiveVeriTable SET code=?, timestamp=? WHERE email=? AND server_id=?`,
                          [SessionInfo.code, SessionInfo.timestamp, SessionInfo.email, SessionInfo.server_id]
                        );
                        callback("SuccessfullyUpdated")
                      }
                    }
                  }
                );
              }
            }
          )
        }
      }
    );
  }

  /* Stores the Verified user profile and clears the corresponding SessionInfo*/
  storeVerifiedUser(VerifiedEmail) {
    this.db.parallelize(() => {
      this.db.run(
        `INSERT INTO VerifiedTable
        (email, discord_id, server_id, timestamp) 
         VALUES (?, ?, ?, ?)
        `,
        [
          VerifiedEmail.email,
          VerifiedEmail.discord_id,
          VerifiedEmail.server_id,
          VerifiedEmail.timestamp
        ]
      );
      this.db.run(
        `DELETE FROM ActiveVeriTable
         WHERE email=? AND server_id=?
        `,
        [
          VerifiedEmail.email,
          VerifiedEmail.server_id
        ]
      );
    });
  }

  deleteVerifiedUser(VerifiedEmail) {
    this.db.run(
      `DELETE FROM VerifiedTable
       WHERE server_id=? AND discord_id=?`,
      [
        VerifiedEmail.server_id,
        VerifiedEmail.discord_id
      ]
    );
  }

  getVerifiedUser(discord_id, server_id, callback) {
    this.db.get(`
    SELECT * FROM VerifiedTable
    WHERE discord_id=? AND server_id=?`,
      [
        discord_id,
        server_id
      ],
      (err, row) => {
        callback(row);
      }
    );
  }

  setSeverPreferences(ServerPreferences) {
    this.db.run(`UPDATE ServerPreferencesTable 
                SET domain=?, prefix=?, cmd_channel=?, role_id=?
                WHERE server_id=?`,
      [
        ServerPreferences.domain,
        ServerPreferences.prefix,
        ServerPreferences.cmd_channel,
        ServerPreferences.role_id,
        ServerPreferences.server_id,
      ]);
  }

  getSessionInfo(discord_id, server_id, callback) {
    this.db.get(`SELECT * FROM ActiveVeriTable WHERE discord_id=? AND server_id=?`,
      [
        discord_id,
        server_id
      ],
      function (err, row) {
        callback(row);
      });
  }

  getSessionCode(discord_id, server_id, callback) {
    this.db.get(`SELECT * FROM ActiveVeriTable WHERE discord_id=? AND server_id=?`,
      [
        discord_id,
        server_id
      ],
      function (err, row) {
        if (row === undefined) {
          callback('NoActiveSession');
        } else {
          if (row.timestamp - new Date().getTime > 900000) {
            callback("LastSessionExpired");
          } else {
            callback(row.code);
          }
        }
      });
  }

  getServerPreferences(server_id, callback) {
    this.db.get(`SELECT * FROM ServerPreferencesTable WHERE server_id=?`, server_id, (err, row) => {
      callback(row);
    });
  }

  createServerPreferences(server_id, callbackOptional) {
    this.getServerPreferences(server_id, (serverPreferences) => {
      if (serverPreferences == undefined) {
        this.db.run(`INSERT INTO ServerPreferencesTable
        (server_id, prefix, domain)
        VALUES (?, ?, ?)`,
          [
            server_id,
            "!",
            "gmail.com"
          ],
          () => {
            if (callbackOptional != undefined) {
              callbackOptional();
            }
          }
        );
      }
    });
  }

  exit() {
    this.db.close();
  }
}


module.exports = { DB };
