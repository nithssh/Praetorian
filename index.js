const token = require("./token");
const Discord = require("discord.js");
const { startVerificationProcess, validateCode } = require("./lib/backend");
const client = new Discord.Client();

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

/*  Commands:
 *      !verify <email> -- starts verification for the specified email id
 *      !code <code> -- validates the provided code
 */
client.on("message", (msg) => {
  if (msg.author.bot) return;

  if (msg.content.toLowerCase().startsWith("!verify")) {
    if (!isValidVerifyCommand(msg)) {
      msg.reply("Invalid command. Must be !verify <*email*>, where *email* is a valid email address.");
      return;
    }
    startVerificationProcess(msg.content.split(" ")[1], msg.author.id, (status) => {
      if (status === "EmailAlreadyTaken") {
        msg.reply(`This email is already taken [${msg.content.split(" ")[1]}].`);
      } else if (status === "SessionAlreadyActive") {
        msg.reply(`Verification code already requested within the last 15 mins. Check your email for the code, or try again later.`);
      } else if (status === "SuccessfullyCreated") {
        msg.reply(`Verification email sent to ${msg.content.split(" ")[1]}`);
      } else if (status === "SuccessfullyUpdated") {
        msg.reply(`Verification re-requested successfully. Check your email for the code.`);
      }
    });
  }

  if (msg.content.toLowerCase().startsWith("!code")) {
    if (!isValidCodeCommand(msg)) {
      msg.reply("Invalid command. Must be !code <*code*>, where *code* is a 6-digit number.");
      return;
    }
    validateCode(msg.content.split(" ")[1], msg.author.id, (isSuccess) => {
      if (isSuccess === true) {
        let roleID = msg.guild.roles.cache.find(r => r.name === "Verified");
        msg.guild.member(msg.author.id).roles.add(roleID); // give role
        msg.reply("Successfully verified! Welcome to <Server X>");
      } else if (isSuccess === 'NoActiveSession') {
        msg.reply("No active verification request. Use the `!verify <email>` command to start one.");
      } else if (isSuccess === 'LastSessionExpired') {
        msg.reply("Your last request has expired. Use the `!verify <email>` command again to try again.");
      } else {
        msg.reply("Entered code is invalid, please try again.");
      }
    });
  }
});

function isValidVerifyCommand(message) {
  if (message.content.split(" ").length !== 2) {
    return false;
  }
  if (message.content.split(" ")[0].toLowerCase() != "!verify") {
    return false;
  }
  if (!isValidEmail(message.content.split(" ")[1])) {
    return false;
  }
  return true;
}

function isValidEmail(email) {
  const format = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return format.test(email)
}

function isValidCodeCommand(message) {
  if (message.content.split(" ").length !== 2) {
    return false;
  }
  if (message.content.split(" ")[0].toLowerCase() != "!code") {
    return false;
  }
  if (message.content.split(" ")[1] < 100000 || message.content.split(" ")[1] > 1000000) {
    return false;
  }
  return true;
}

client.login(token);
