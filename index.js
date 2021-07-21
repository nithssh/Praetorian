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
  if (msg.author.bot) return; // don't process bot messages

  if (msg.content.toLowerCase().startsWith("!verify")) {
    startVerificationProcess(msg.content.split(" ")[1], msg.author.id); // TODO need to validate this user input first
    msg.channel.send(`Started Verifying ${msg.author}`);
  }

  if (msg.content.toLowerCase().startsWith("!code")) {
    let isSuccess = validateCode(msg.content.split(" ")[1], msg.author.id); // TODO need input validation
    if (isSuccess) {
      msg.reply("Successfully verified! Welcome to ...");
      // TODO commit to verifiedTable
      // give discord role
    } else if(isSuccess === undefined) {
      msg.reply("No active verification request. Use the `!verify <email>` command to start one.")
    } else {
      msg.reply("Entered code is invalid, please try again.");
    }
  }
});

client.login(token);
