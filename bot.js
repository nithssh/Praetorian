const Discord = require("discord.js");
const { startVerificationProcess, validateCode } = require("./lib/backend");
const { isValidCodeCommand, isValidVerifyCommand, isRightDomain } = require("./lib/utilities");
const token = require("./token");

const client = new Discord.Client();

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

/*  Commands:
 *      !help -- prints a help prompt
 *      !verify <email> -- starts verification for the specified email id
 *      !code <code> -- validates the provided code
 */
client.on("message", (msg) => {
  if (msg.author.bot) return;

  if (msg.content.toLowerCase().startsWith("!help")) {
    let embedMessage = new Discord.MessageEmbed()
      .setTitle("Praetorean")
      .setColor('#0099ff')
      .setAuthor('Help Message')
    msg.channel.send(embedMessage);
  }

  if (msg.content.toLowerCase().startsWith("!verify")) {
    if (!isValidVerifyCommand(msg)) {
      msg.reply("Invalid command. Must be !verify <*email*>, where *email* is a valid email address.");
      return;
    }
    if (!isRightDomain(msg.content.split(" ")[1])) {
      msg.reply("The email must be part of the `ssn.edu.in` domain. Please try again with the right email address [example@ssn.edu.in].")
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
        msg.guild.roles.fetch()
          .then((roles) => {
            return roles.cache.find(r => r.name.toLowerCase() == "verified");
          })
          .then((role) => msg.guild.member(msg.author.id).roles.add(role));
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

client.login(token);
