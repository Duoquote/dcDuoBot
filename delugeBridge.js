const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const conf = require('./conf.js');

class Deluge {
  constructor () {
    this.deluged = spawn(conf.deluge.deluge_deluged_path);
    this.lastState = this.getLastState();
    console.log(this.lastState);
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
  getLastState() {
    var info = spawnSync(conf.deluge.deluge_executable_path, ["info"]).stdout.toString();

    // Parse info command into dictionary.
    info = [...info.matchAll(new RegExp(/^(?<key>.*?): ?(?<val>.*)/, "gm"))].reduce((acc, e)=>{
      acc[e.groups.key.toLowerCase().replace(/\s/, "_")] = e.groups.val;
      return acc;
    }, {});
    info.status = info.state.split(/\s/)[0].toLowerCase();

    // Parse seeder and peer counts.
    var seeder = info.seeds.match(/(?<seeders>\d+)\s\(\d+\).*?(?<peers>\d+).*(?<avail>\d+\.\d+)/).groups;
    info.seed = parseInt(seeder.seeders);
    info.peer = parseInt(seeder.peers);
    info.progress = parseFloat(info.progress.match(/^\d+\.\d+/)[0]);

    // Parse received and total size information.
    info.size = {...info.size.match(/(?<received>\d+\.\d+.+?)\/(?<total>\d+\.\d+.+?)\s/).groups};

    // Parse elapsed day and HH:MM:SS information.
    info.seed_time = info.seed_time.match(/.*(?<days>\d+).*?(?<h>\d{2}):(?<m>\d{2}):(?<s>\d{2})/).groups;

    // Turn time into seconds.
    var time = 0;
    time += parseInt(info.seed_time.days) * 24 * 60 * 60;
    time += parseInt(info.seed_time.h) * 60 * 60;
    time += parseInt(info.seed_time.m) * 60;
    time += parseInt(info.seed_time.s);
    info.seed_time = time;

    // If the status is `downloading`, add download and upload speed.
    if (info.status == "downloading") {
      // Parse download and upload speed, including KiB, MiB etc. indicators.
      var rate = info.state.match(/(?<down>\d+\.\d+).*(?<up>\d+\.\d+)/)
      info.speed = {
        down: parseFloat(rate.groups.down),
        up: parseFloat(rate.groups.up)
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

    return info;
  }

  kill () {
    this.deluged.kill();
  }
}

var deluge = new Deluge();
//deluge.add("magnet:?xt=urn:btih:f6d71eeeff4b9117f4fc070ccc67634cc317185c&dn=ParanormalHK-PLAZA&tr=udp://9.rarbg.me:2720/announce&tr=udp://9.rarbg.to:2800/announce&tr=udp://tracker.opentrackr.org:1337/announce&tr=udp://tracker.leechers-paradise.org:6969/announce&tr=udp://tracker.internetwarriors.net:1337/announce")
deluge.resume("f6d71eeeff4b9117f4fc070ccc67634cc317185c");
// setInterval(()=>{
//   console.log(deluge.info());
// }, 3000)

// Move to main file


process.on("exit", ()=>{
  deluge.kill();
})

//module.exports = Deluge
