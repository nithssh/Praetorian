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

import { queryServerPreferences, setServerPreferences, createServerPreferences } from "./backend";
import { ServerPreferences } from "./datamodels";

export class ServerPreferencesCache {
  cache: { [index: string]: ServerPreferences };

  constructor() {
    this.cache = {};
    console.log("Caching online");
  }

  async getServerPreferences(server_id: string): Promise<ServerPreferences> {
    // if preference is cached, return it
    if (server_id in this.cache) {
      return this.cache[server_id];
    } else {
      // else query preference
      let row = await queryServerPreferences(server_id);
      
      if (row == undefined) {
        // create preferences if it doesnt exist
        await createServerPreferences(server_id);
        let createdRow = await queryServerPreferences(server_id);
        this.cache[server_id] = {
          "server_id": server_id,
          "prefix": createdRow.prefix,
          "domain": createdRow.domain,
          "cmd_channel": createdRow.cmd_channel,
          "role_id": createdRow.role_id,
        };
        return this.cache[server_id];
      } else {
        // return the pre-existing data from the DB
        this.cache[server_id] = {
          "server_id": server_id,
          "prefix": row.prefix,
          "domain": row.domain,
          "cmd_channel": row.cmd_channel,
          "role_id": row.role_id,
        };
        return this.cache[server_id];
      }
    }
  }
  
  async setServerPreferences(sp: ServerPreferences) {
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

  async isCmdChannelSetup(server_id: string): Promise<boolean> {
    let sp = await this.getServerPreferences(server_id);
    return sp.cmd_channel != undefined;
  }
};
