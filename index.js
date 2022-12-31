const { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client: DiscordClient, EmbedBuilder, IntentsBitField } = require('discord.js')
const iFl = IntentsBitField.Flags
const client = new DiscordClient({
  intents: [
    iFl.GuildBans,
    iFl.GuildMembers,
    iFl.GuildMessageTyping,
    iFl.GuildMessages,
    iFl.MessageContent,
    iFl.DirectMessages,
    iFl.GuildMessageTyping,
    iFl.DirectMessageTyping
  ]
})
const mongoose = require('mongoose')
const json5 = require('json5')
const perspectiveapi = require("perspective-api-client");
const fs = require('fs-extra')
const path = require('path')
const UsernameGenerator = require('username-generator');
const crypto = require('node:crypto')
const axios = require('axios')

const config = json5.parse(fs.readFileSync(path.join(__dirname, 'config.json5')))

const perspective = new perspectiveapi({ apiKey: config['googleToken'] });
mongoose.set('strictQuery', false);
mongoose.connect(config.mongoose || 'mongodb://localhost:27017/CorinIsGod')

const serverShema = new mongoose.Schema({
  discordID: Number,
  acceptedToS: { type: Boolean, default: false },
  userSafety: {
    spamChannels: [{
      id: Number,
    }]
  }
})
const servers = mongoose.model('servers', serverShema)

const userShema = new mongoose.Schema({
  discordID: Number,
  acceptedToS: { type: Boolean, default: false },
  resume: {
    username: {
      givenOne: Boolean,
      given: String
    },
    pfp: {
      testResults: Boolean,
      lastReport: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'reports'
      }
    }
  }
})
const users = mongoose.model('users', userShema)

client.on('messageCreate', async (message) => {
  if (message.author.bot) return console.log(`B - ${message.author.username} : ${message.cleanContent}`)
  console.log(`U - ${message.author.username} : ${message.cleanContent}`)
  /// get server configuration.
  let server = servers.findOne({ 'discordID': message.guild.id })
  if (server == null) {
    server = new servers({
      id: message.guild.id,
    })
    let Gchannel = message.guild.systemChannel
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('server_tos')
          .setLabel('Accept ToS')
          .setStyle(ButtonStyle.Success),
      )
      .addComponents[
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL('https://sites.google.com/view/udwnuxeh4m63b74sx27gwxlo4apa2/accueil')
    ]
    await Gchannel.send({
      content: `En utilisant nos services, vous acceptez les termes et conditions qui régissent l'utilisation de notre plateforme. Pour plus de détails sur ces termes et conditions, veuillez consulter la version complète disponible sur notre site web. Ces termes et conditions incluent notre droit de juger et de punir toute infraction à nos règles, ainsi que notre interdiction de tout propos offensant ou violents dans certains salons. Nous nous réservons le droit de modifier ces termes et conditions à tout moment.

En utilisant nos services, vous acceptez ces termes et conditions et reconnaissez que vous êtes lié par leur contenu. Si vous n'êtes pas d'accord avec ces termes et conditions, veuillez ne pas utiliser nos services.`,
      components: [row]
    })
    server.save()
  }
  if (!server.acceptedToS) return
  /// END get server configuration.
  /// get the user record
  let user = users.fundOne({ 'discordID': message.author.id })
  if (user == null) {
    // check username 
    let res = await perspective.analyze(message.author.username, {
      attributes: ['TOXICITY', 'SEVERE_TOXICITY', 'IDENTITY_ATTACK', 'INSULT', 'PROFANITY', 'THREAT', 'SEXUALLY_EXPLICIT', 'FLIRTATION'],
    })
    user = new users({
      discordID: message.member.id,
      acceptedToS: false,
      resume: {
        username: {
          given: null,
          givenOne: false
        },
        pfp: {
          lastReport
        }
      }
    })
    if (checkValuesUsername(res)) {
      let username = UsernameGenerator.generateUsername();
      message.member.setNickname(username)
      user.resume.username
    }
    //check pfp

    // send accept ToC
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('user_tos_' + message.author.id)
          .setLabel('Accept ToS')
          .setStyle(ButtonStyle.Success),
      )
      .addComponents[
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL('https://sites.google.com/view/udwnuxeh4m63b74sx27gwxlo4apa2/accueil')
    ]
    await Gchannel.send({
      content: `<@${message.author.id}>
En utilisant nos services, vous acceptez les termes et conditions qui régissent l'utilisation de notre plateforme. Pour plus de détails sur ces termes et conditions, veuillez consulter la version complète disponible sur notre site web. Ces termes et conditions incluent notre droit de juger et de punir toute infraction à nos règles, ainsi que notre interdiction de tout propos offensant ou violents dans certains salons. Nous nous réservons le droit de modifier ces termes et conditions à tout moment.

En utilisant nos services, vous acceptez ces termes et conditions et reconnaissez que vous êtes lié par leur contenu. Si vous n'êtes pas d'accord avec ces termes et conditions, veuillez ne pas utiliser nos services.`,
      components: [row]
    })
  }
  /// END get the user record

  // check message 
  let context = (await message.channel.messages.fetch({limit: 25})).map(message => message.content)
  context.pop();
  let messageP = perspective.analyze(message.content, {
    attributes: ['TOXICITY', 'SEVERE_TOXICITY', 'IDENTITY_ATTACK', 'INSULT', 'PROFANITY', 'THREAT'],
    context
  })
})

client.on('interactionCreate', async (i) => {
  if (i.isButton()) {
    if (i.customId.startsWith('user_tos_')) {
      if (i.member.id != i.customId.replace('user_tos_', '')) return i.reply({
        content: `Seul l'utilisateur concerné peut accepter les termes et conditions en représentant le serveur.

Only the concerned user can accept the terms and conditions while representing the server.`,
        ephemeral: true
      })
      let user = users.findOne({ 'discordID': i.member.id })
      user.acceptedToS = true
      user.save()
      i.message.channel.send('Vous avez accepté les termes et conditions. Merci de nous faire confiance.')
      i.message.delete()
    } else if (i.customId === 'server_tos') {
      if (i.member.id != i.message.guild.ownerId) return i.reply({
        content: `Seul le propriétaire de ce serveur peu accepter les termes et conditions tout en représantant le serveur. 

Only the owner of this server can accept the terms and conditions while representing the server.`,
        ephemeral: true
      })
      let server = servers.findOne({ 'discordID': i.message.guild.id })
      server.acceptedToS = true
      server.save()
      i.message.channel.send('Vous avez accepté les termes et conditions. Merci de nous faire confiance.')
      i.message.delete()
    }
  }
})

function checkValuesUsername(json, threathold = 0.7) {
  for (const key in json) {
    if (json[key] > threathold) {
      return true
    }
  }
  return false;
}
function checkValues(json, threathold = 0.7) {
  let data = {
    is: false,
    by: [],
    origin: json
  }
  for (const key in json) {
    if (json[key] > threathold) {
      data.is = true,
        data.by.push(key)
    }
  }
  return data
}
client.on('ready', () => {
  console.log(`Using ${client.user.username}`)
})

client.login(config.discordToken)