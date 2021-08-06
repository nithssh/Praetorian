import { queryServerPreferences, setServerPreferences, createServerPreferences } from "./backend";
import { ServerPreferences } from "./datamodels";

/* Cache is an object of objects
 * Could be replaced with an in-memory sqlite3 database, but this
 * is suffiecient for current scale.
 * Might be worth switching to class instances over arbitrary objects
 * 
 * cache = {
   "<server_id>": {
     "prefix": "!",
     "domain": "clg.edu.in",
     "cmd_channel" : "121234135145133241234"
   },
   "<server_id>": {
     "prefix": "!",
     "domain": "clg.edu.in",
     "cmd_channel" : "121234135145133241234"
   },
 }
 */

export class ServerPreferencesCache {
  cache: { [index: string]: ServerPreferences };

  constructor() {
    this.cache = {};
    console.log("Caching online");
  }

  getServerPreferences(server_id: string, callback: (preferences: ServerPreferences) => void): void {
    if (server_id in this.cache) {
      callback(this.cache[server_id]);
    } else {
      queryServerPreferences(server_id, (row) => {
        if (row == undefined) {
          createServerPreferences(server_id, () => {
            queryServerPreferences(server_id, (row) => {
              this.cache[server_id] = {
                "server_id": server_id,
                "prefix": row.prefix,
                "domain": row.domain,
                "cmd_channel": row.cmd_channel,
                "role_id": row.role_id,
              };
              callback(this.cache[server_id]);
            });
          })
        } else {
          this.cache[server_id] = {
            "server_id": server_id,
            "prefix": row.prefix,
            "domain": row.domain,
            "cmd_channel": row.cmd_channel,
            "role_id": row.role_id,
          };
          callback(this.cache[server_id]);
        }
      });
    }
  }

  setServerPreferences(sp: ServerPreferences) {
    this.cache[sp.server_id] = {
      "server_id": sp.server_id,
      "prefix": sp.prefix,
      "domain": sp.domain,
      "cmd_channel": sp.cmd_channel,
      "role_id": sp.role_id
    };
    // this.cache[sp.server_id] = sp;
    setServerPreferences(sp);
  }

  isCmdChannelSetup(server_id: string, callback: (isSetup: boolean) => void): void {
    this.getServerPreferences(server_id, (sp) => {
      callback(sp.cmd_channel != undefined);
    });
  }
}
