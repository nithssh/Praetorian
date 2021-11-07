// import assert from 'assert';
// import * as cache from '../src/lib/caching';
// import * as database from '../src/lib/database';
// import { ServerPreferences } from '../src/lib/datamodels';

// const db = new database.DB();
// const spc = new cache.ServerPreferencesCacher();

// function arePreferencesEqual(obj1: ServerPreferences, obj2: any): boolean {
//   if (obj1.cmd_channel !== obj2.cmd_channel)
//     return false;
//   if (obj1.domain !== obj2.domain)
//     return false;
//   if (obj1.prefix !== obj2.prefix)
//     return false;
//   if (obj1.role_id !== obj2.role_id)
//     return false;
//   if (obj1.server_id !== obj2.server_id)
//     return false;

//   return true;
// }

// describe('Caching', function () {
//   const serverId = '987654';
//   before(function () {

//   });

//   afterEach(function () {

//   });

//   describe("should create preference if it doesn't exist and return that", async function () {
//     let initalValue = db.get(`SELECT * FROM SeverPreferencesTable WHERE server_id=?`, [serverId]);
//     assert.equal(initalValue, undefined);
//     let sp = await spc.getServerPreferences(serverId);
//     let finalValue = db.get(`SELECT * FROM SeverPreferencesTable WHERE server_id=?`, [serverId]);
//     assert.notStrictEqual(finalValue, undefined);
//     assert.equal(arePreferencesEqual(sp, finalValue), true);
//   });

//   describe("")
// });