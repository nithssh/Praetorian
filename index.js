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
    // start validation process
    startVerificationProcess(msg.content.split(" ")[1], msg.author.id); // TODO need to validate this user input first
    msg.channel.send(`Started Verifying ${msg.author}`);
  }

  if (msg.content.toLowerCase().startsWith("!code")) {
    // invoke the code validation
    let isSuccess = validateCode(msg.content.split(" ")[1]); // TODO need input validation
  }
});

client.login(token);
