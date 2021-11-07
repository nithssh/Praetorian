import assert from 'assert';
import { Client, Guild, Message, TextChannel } from 'discord.js';
import * as utilities from '../src/lib/utilities';

const client = new Client();
const guild = new Guild(client, {});
const channel = new TextChannel(guild, {});

describe("Utilties", function () {
  describe('isValidVerifyCommand', function () {
    it("should reject commands not 2 words long", function () {
      const message = new Message(
        client,
        {
          id: "message-id",
          content: "!verify",
        },
        channel
      );
      var isValid: boolean = utilities.isValidVerifyCommand(message);
      assert.equal(isValid, false);
    });

    it("should reject commands not starting with `verify`", function () {
      const message = new Message(
        client,
        {
          id: "message-id",
          content: "!notverify user@example.com", // contains the word verify in it on purpose
        },
        channel
      );
      var isValid: boolean = utilities.isValidVerifyCommand(message);
      assert.equal(isValid, false);
    });

    it("should reject commands with invalid email (format)", function () {
      const message1 = new Message(
        client,
        {
          id: "message-id",
          content: "!verify user@examplecom",
        },
        channel
      );
      const message2 = new Message(
        client,
        {
          id: "message-id",
          content: "!verify userexample.com",
        },
        channel
      );
      var isValid1: boolean = utilities.isValidVerifyCommand(message1);
      var isValid2: boolean = utilities.isValidVerifyCommand(message2)
      assert.equal(isValid1, false);
      assert.equal(isValid2, false);
    });

    it("should accept valid commands", function () {
      const message = new Message(
        client,
        {
          id: "message-id",
          content: "!verify user@example.com",
        },
        channel
      );
      var isValid: boolean = utilities.isValidVerifyCommand(message);
      assert.equal(isValid, true);
    });
  });


  describe("isValidCodeCommand", function () {
    it("should reject commands not 2 words long", function () {
      const message1 = new Message(
        client,
        {
          id: "message-id",
          content: "!code",
        },
        channel
      );
      var isValid1: boolean = utilities.isValidCodeCommand(message1);
      assert.equal(isValid1, false);
    });

    it("should reject commands not starting with `code`", function () {
      const message = new Message(
        client,
        {
          id: "message-id",
          content: "!notcode 123456", // contains the word verify in it on purpose
        },
        channel
      );
      var isValid: boolean = utilities.isValidCodeCommand(message);
      assert.equal(isValid, false);
    });

    it("should reject commands that dont have six digit codes within range", function () {
      const message1 = new Message(
        client,
        {
          id: "message-id",
          content: "!code 12345",
        },
        channel
      );
      const message2 = new Message(
        client,
        {
          id: "message-id",
          content: "!code 1234567",
        },
        channel
      );
      var isValid1: boolean = utilities.isValidCodeCommand(message1);
      var isValid2: boolean = utilities.isValidCodeCommand(message2);
      assert.equal(isValid1, false);
      assert.equal(isValid2, false);
    });

    it("should accept valid commands", function () {
      const message = new Message(
        client,
        {
          id: "message-id",
          content: "!code 123456",
        },
        channel
      );
      var isValid: boolean = utilities.isValidCodeCommand(message);
      assert.equal(isValid, true);
    });
  });
});