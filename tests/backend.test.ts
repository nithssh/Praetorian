import assert from 'assert';
import * as backend from '../src/lib/backend';
import * as database from '../src/lib/database';
import { VerifiedProfile } from '../src/lib/datamodels';

const db = new database.DB();

describe('Backend', function () {
  this.timeout(10000); // allow for longer tests
  const email = 'praetorian.discord@gmail.com'; // needs to be a valid email
  const discord_id = '123456';
  const server_id = '654321';

  // cleanup in case the previous run failed in the middle
  before(async function () {
    await db.deleteSessionsByEmail(email, server_id);
    let verified = new VerifiedProfile(email, discord_id, server_id, '');
    await db.deleteVerifiedUser(verified);
  });

  afterEach(async function () {
    await db.deleteSessionsByEmail(email, server_id);
    let verified = new VerifiedProfile(email, discord_id, server_id, '');
    await db.deleteVerifiedUser(verified);
  });

  describe('#startVerificationProcess', function () {
    it('should return SuccessfullyCreated, for first time verifiers', async function () {
      let status = await backend.startVerificationProcess(email, discord_id, server_id);

      assert.equal(status, backend.StartVerificationResult.SuccessfullyCreated);
    });

    it("Should return SessionReset, when session is re-requested", async function() {
      await backend.startVerificationProcess(email, discord_id, server_id);

      let status = await backend.startVerificationProcess(email, discord_id, server_id);

      assert.strictEqual(status, backend.StartVerificationResult.SessionReset);     
    });

    it('should return SuccessfullyUpdated, when starting verification process again AFTER 15 mins', async function () {
      let newTimeStamp = new Date().getTime() - 900000; // 15 mins in the past
      // insert expired session into database first
      await db.exec(
        `INSERT INTO ActiveVeriTable
        (email, discord_id, server_id, code, timestamp)
        VALUES (?, ?, ?, ?, ?)`,
        [email, discord_id, server_id, '123456', newTimeStamp.toString()]
      );

      let status = await backend.startVerificationProcess(email, discord_id, server_id);

      assert.equal(status, backend.StartVerificationResult.SuccessfullyUpdated);
    });

    it("should return EmailAlreadyTaken, when given email is already verified.", async function () {
      // insert the email as verified into database first.
      await db.exec(
        `INSERT INTO VerifiedTable
        (email, discord_id, server_id, timestamp)
        VALUES (?, ?, ?, ?)`,
        [email, '987654', server_id, ''] // same email, different discord_id
      );

      let status = await backend.startVerificationProcess(email, discord_id, server_id);

      assert.equal(status, backend.StartVerificationResult.EmailAlreadyTaken);
    });

    it("should return ServerMemberAlreadyVerified, when discord user is already verified.", async function () {
      let verified = new VerifiedProfile(email, discord_id, server_id, Date.now().toString());
      await db.setVerifiedUser(verified);

      let status = await backend.startVerificationProcess(email, discord_id, server_id);

      assert.equal(status, backend.StartVerificationResult.ServerMemberAlreadyVerified);
    });
  });

  describe('#validateCode', function () {
    const code = '567890';
    it('should return ValidationSuccess on correct code', async function () {
      await db.exec(
        `INSERT INTO ActiveVeriTable
        (email, discord_id, server_id, code, timestamp)
        VALUES (?, ?, ?, ?, ?)`,
        [email, discord_id, server_id, code, Date.now().toString()]
      );

      let status = await backend.validateCode(code, discord_id, server_id);

      assert.equal(status, backend.ValidateCodeResult.ValidationSuccess);
    });

    it('should return ValidationFail on wrong code', async function () {
      await db.exec(
        `INSERT INTO ActiveVeriTable
        (email, discord_id, server_id, code, timestamp)
        VALUES (?, ?, ?, ?, ?)`,
        [email, discord_id, server_id, '111111', Date.now().toString()]
      );

      let status = await backend.validateCode(code, discord_id, server_id);

      assert.equal(status, backend.ValidateCodeResult.ValidationFailed);
    });

    it('should return NoActiveSession on non-existent entries', async function () {
      let status = await backend.validateCode(code, discord_id, server_id);

      assert.equal(status, database.GetSessionCodeResult.NoActiveSession);
    });

    it('should return LastSessionExpired on expired entries', async function () {
      let newTimeStamp = Date.now() - 900000; // 15 mins in the past
      // insert expired session into database first
      await db.exec(
        `INSERT INTO ActiveVeriTable
        (email, discord_id, server_id, code, timestamp)
        VALUES (?, ?, ?, ?, ?)`,
        [email, discord_id, server_id, code, newTimeStamp.toString()]
      );

      let status = await backend.validateCode(code, discord_id, server_id);
      assert.equal(status, database.GetSessionCodeResult.LastSessionExpired);
    });
  });
});
