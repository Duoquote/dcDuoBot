const Discord = require('discord.js');
const client = new Discord.Client();

const fs = require('fs');
const conf = require("./conf.js");
const cmdLang  = require("./cmdLang.js");
const Deluge = require("./delugeBridge.js");

var dcToken;

if (process.env.DC_TOKEN) {
  dcToken = process.env.DC_TOKEN;
} else {
  console.log("Set `DC_TOKEN` environment variable with you token.");
  exit();
}
//
// if (dcToken.delugeServerID) {
//   var deluge = new Deluge();
// }

const sqlite3 = require('sqlite3').verbose();

var db = new sqlite3.Database(conf.sqlite, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) throw err;
  console.log(`Connected to sqlite database at "${conf.sqlite}"`);
});

// Create main database tables.
db.run(`
  CREATE TABLE IF NOT EXISTS servers(
  	'id'	INTEGER PRIMARY KEY AUTOINCREMENT,
  	'dc_id'	TEXT UNIQUE NOT NULL,
  	'lang'	TEXT,
  	'prefix'	TEXT
  );
  `, (err)=>{
    if (err) throw err;
  })

var serverData = {}
function rData(dc_id = null) {
  if (dc_id) {
    db.get(`
      SELECT * FROM servers WHERE dc_id = $dc_id;
      `, {$dc_id: dc_id}, (err, data)=>{
        serverData[data.dc_id] = data
      })
  } else {
    db.all(`
      SELECT * FROM servers;
      `, (err, data)=>{
        data.forEach(server => {
          serverData[server.dc_id] = server
        })
        console.log(serverData);
      })
  }
}

rData();

// reloadServerData();

function parseCmd(cmdIn, prefix) {
  return cmdIn.split(/ +/)
    .reduce((acc, arg, ind)=>{
      if (arg.indexOf(prefix) == 0 && ind == 0) {
        acc["cmd"] = arg.replace(prefix, "");
        return acc;
      } else {
        acc["params"].push(arg);
        return acc;
      }
    }, {
      "params": []
    });
}

client.on('ready', () => {
  console.log(`Bot "${client.user.tag}" is ready!`);
});



client.on('message', msg => {
  if (msg.author.bot) return;

  var prx;
  var lang;
  if (msg.guild.id in serverData) {
    if (serverData[msg.guild.id].prefix) {
      prx = serverData[msg.guild.id].prefix;
    } else {
      prx = conf.prefix;
    }
    if (serverData[msg.guild.id].lang) {
      lang = serverData[msg.guild.id].lang;
    } else {
      lang = conf.lang;
    }
  } else {
    prx = conf.prefix;
    lang = conf.lang;
  }

  if(msg.content.indexOf(prx) !== 0) return;

  var command = parseCmd(msg.content, prx);

  if (command) {

    // Profile command.
    if (command.cmd == "profile" && command.params.length == 0) {
      var user = client.users.get(msg.author.id)
      var avatarURL = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
      var profile = new Discord.RichEmbed()
        .setColor("#ffd754")
        .setTitle(`${user.username}#${user.discriminator}`)
        .setURL(`${avatarURL}?size=1024`)
        .setThumbnail(avatarURL)
        .addField(cmdLang[lang].profile.id, user.id)
        .addField(cmdLang[lang].profile.join, new Date(user.lastMessage.member.joinedTimestamp)
          .toLocaleDateString(lang, {
            dateStyle: "full", timeStyle: "medium"
          }))
        .setFooter(cmdLang[lang].profile.generated, `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.png`)
        .setTimestamp(new Date())
      msg.reply(profile);
    }


    // Set command.
    if (command.cmd == "set") {
      if (!(msg.member.hasPermission(Discord.Permissions.MANAGE_CHANNELS))) {
        msg.reply(cmdLang.set.permission);
        return;
      }
      if (command.params.length == 0) {
        msg.reply(cmdLang[lang].set.help)
        return
      }
      if (command.params[0] == "prefix") {
        if (command.params.length == 1) {
          msg.reply(cmdLang[lang].set.prefix.help)
          return;
        }
        if (command.params[1].length > 2) {
          msg.reply(cmdLang[lang].set.prefix.help)
          return;
        }
        if (command.params[1].match(new RegExp(/^([^\w\s\/]|_){1,2}$/, "g"))) {
          db.run(`
            INSERT INTO servers(
              dc_id,
              prefix
            ) VALUES (
              $dc_id,
              $prefix
            )
            ON CONFLICT(dc_id) DO UPDATE SET
              prefix = $prefix
            WHERE dc_id = $dc_id;
            `, {$dc_id: msg.guild.id, $prefix: command.params[1]}, (err)=>{
            if (err) throw err;
            rData(msg.guild.id);
          })
          msg.reply(cmdLang[lang].set.prefix.set)
        } else {
          msg.reply(cmdLang[lang].set.prefix.help)
        }
      } else if (command.params[0] == "language") {
        if (command.params.length == 1) {
          msg.reply(cmdLang[lang].set.language.help)
          return;
        }
        if (command.params[1].toUpperCase() in cmdLang) {
          db.run(`
            INSERT INTO servers(
              dc_id,
              lang
            ) VALUES (
              $dc_id,
              $lang
            )
            ON CONFLICT(dc_id) DO UPDATE SET
              lang = $lang
            WHERE dc_id = $dc_id;
            `, {$dc_id: msg.guild.id, $lang: command.params[1].toUpperCase()}, (err)=>{
            if (err) throw err;
            rData(msg.guild.id);
            msg.reply(cmdLang[lang].set.language.set)
          })
        } else {
          msg.reply(cmdLang[lang].set.language.help)
        }
      }
    }


    // // Deluge command
    // if (command.cmd == "t") {
    //   if (!dcToken.delugeServerID) {
    //     return;
    //   }
    //   if (!dcToken.delugeServerID.includes(msg.guild.id)) {
    //     return;
    //   }
    //   if (!command.params) {
    //     return;
    //   }
    //   if (command.params[0] == "info") {
    //     var delugeInfo = new Discord.RichEmbed()
    //       .setAuthor("Deluge", "https://upload.wikimedia.org/wikipedia/commons/c/c5/Deluge_icon.png", "https://guvendegirmenci.com")
    //     var torList = deluge.info();
    //     if (torList > 3) {
    //       torList = torList.split(torList.length - 3, torList.length - 1)
    //     }
    //     deluge.info().forEach((info)=>{
    //
    //       delugeInfo.addField(((info.name.length > 45) ? info.name.substr(0, 45) + "...":info.name), `
    //         ID: \`${info.id}\`
    //         > Size: \`${info.size.received} / ${info.size.total}\`
    //         > Status: \`${info.status}\`
    //         ` +
    //         ((info.speed.up) ? `> Down: \`${info.speed.down}\` // Up: \`${info.speed.up}\`\n`:"") +
    //         ((info.time) ? `> Active for __${info.time.active}__ // Seeding for __${info.time.seed}__`:"")
    //       )
    //     })
    //     msg.reply(delugeInfo)
    //   }
    // }
  }
});

process.on("exit", ()=>{
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Close the database connection.');
  });
  // if (dcToken.delugeServerID) {
  //   deluge.kill();
  // }
})

client.login(dcToken);
