const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const conf = require('./conf.js');

///////////////////////////////////////////////////////////////////////////////
// This thing is abandoned as I decided to host the bot in heroku platform and
// it would be unsecure to expose deluge server port.
///////////////////////////////////////////////////////////////////////////////


class Deluge {
  constructor () {
    this.deluged = spawn(conf.deluge.deluge_deluged_path);
    this.lastState = this.getLastState();
  }
  resume (id) {
    return spawnSync(conf.deluge.deluge_executable_path, ["resume", id])
  }
  add (url) {
    return spawnSync(conf.deluge.deluge_executable_path, ["add", url])
  }
  info () {
    return this.getLastState(this.TORRENT_STATE);
    //return spawnSync(conf.deluge.deluge_executable_path, ["info"]).stdout.toString();
  }

  // From: https://github.com/deluge-torrent/deluge/blob/ec4772068609b5d89d5a6bfb8f9c1ca1bb35704d/deluge/ui/web/js/deluge-all/UI.js
  // var TORRENT_STATE_TRANSLATION = [
  //     _('All'),
  //     _('Active'),
  //     _('Allocating'),
  //     _('Checking'),
  //     _('Downloading'),
  //     _('Seeding'),
  //     _('Paused'),
  //     _('Checking'),
  //     _('Queued'),
  //     _('Error'),
  // ];
  //console.log(this.TORRENT_STATE);
  getLastState () {
    var infoGet = spawnSync(conf.deluge.deluge_executable_path, ["info"]).stdout.toString().split(/\r\n \r\n/);
    var infoList = [];

    // Parse info command into dictionary.
    infoGet.forEach((info)=>{
      info = [...info.matchAll(new RegExp(/^(?<key>.*?): ?(?<val>.*)/, "gm"))].reduce((acc, e)=>{
        acc[e.groups.key.toLowerCase().replace(/\s/, "_")] = e.groups.val;
        return acc;
      }, {});

      // Parse seeder and peer counts.
      if (info.seeds) {
        var seeder = [...info.seeds.matchAll(new RegExp(/(\d+) \((-*\d+)\)/, "g"))];
        info.seeds = {
          active: parseInt(seeder[0][0]),
          available: parseInt(seeder[0][1])
        }
        info.peer = {
          active: parseInt(seeder[1][0]),
          available: parseInt(seeder[1][1])
        }
      } else {

      }

      if (info.progress) {
        info.progress = parseFloat(info.progress.match(/^\d+\.\d+/)[0]);
      }

      // Parse received and total size information.
      info.size = {...info.size.match(/(?<received>\d+\.\d+.+?)\/(?<total>\d+\.\d+.+?)\s/).groups};

      // Parse elapsed day and HH:MM:SS information.
      if (info.seed_time) {
        info.seed_time = info.seed_time.split(/(?<=\d\d:\d\d:\d\d)\s.*?(?=\d)/);
        info.time = {
          active: info.seed_time[0],
          seed: info.seed_time[1]
        }
      }


      info.status = info.state.split(/\s/)[0].toLowerCase();

      // If the status is `downloading`, add download and upload speed.

      if (info.status == "downloading") {
        // Parse download and upload speed, including KiB, MiB etc. indicators.
        info.speed = {
          down: info.state.match(/Down Speed: (?<speed>.*?\/s)/).groups.speed,
          up: info.state.match(/Up Speed: (?<speed>.*?\/s)/).groups.speed
        }
      } else if (info.status == "seeding") {
        info.speed = {
          down: null,
          up: info.state.match(/Up Speed: (?<speed>.*?\/s)/).groups.speed
        }
      } else {
        info.speed = {
          down: null,
          up: null
        }
      }

      // Remove unnecessary torrent info.
      delete info.seeds;
      delete info.state;
      delete info.tracker_status;
      delete info.seed_time;

      infoList.push(info);
    })
    return infoList;
  }

  kill () {
    this.deluged.kill();
  }
}


module.exports = Deluge
