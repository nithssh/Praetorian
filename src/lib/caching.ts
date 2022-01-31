/* Cache is an object of objects
 * Could be replaced with an in-memory sqlite3 database, but this
 * is suffiecient for current scale.
*/

import { queryServerPreferences, setServerPreferences, createServerPreferences } from "./backend";
import { ServerPreferences } from "./datamodels";

export class ServerPreferencesCacher {
  private cache: { [index: string]: ServerPreferences };

  constructor() {
    this.cache = {};
    // console.log("Caching online");
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
          "domains": createdRow.domain,
          "cmd_channel": createdRow.cmd_channel,
          "role_id": createdRow.role_id,
        };
        return this.cache[server_id];
      } else {
        // return the pre-existing data from the DB
        this.cache[server_id] = {
          "server_id": server_id,
          "prefix": row.prefix,
          "domains": row.domain,
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
      "domains": sp.domains,
      "cmd_channel": sp.cmd_channel,
      "role_id": sp.role_id
    };
    // this.cache[sp.server_id] = sp;
    setServerPreferences(sp); // this is not recurrsing, its calling the DB function
  }

  async isCmdChannelSetup(server_id: string): Promise<boolean> {
    let sp = await this.getServerPreferences(server_id);
    return sp.cmd_channel != undefined;
  }
};
