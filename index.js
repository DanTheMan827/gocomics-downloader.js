const https = require("https");
const fs = require("fs");

function padDate(input) {
  return ("0" + input).slice(-2);
}

/**
 *
 * @param {string} url
 * @param {string} filename
 * @return {Promise<void>}
 */
function downloadFile(url, filename) {
  return new Promise(function(resolve, reject) {
    https
      .get(url, res => {
        const file = fs.createWriteStream(filename);

        res.pipe(file);

        res.on("end", () => {
          resolve();
        });
      })
      .on("error", reject);
  });
}

/**
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
function getPage(url) {
  return new Promise(function(resolve, reject) {
    https
      .get(url, res => {
        let data = "";

        if (res.statusCode == 302) {
          resolve(null);
          return;
        }

        res.on("data", chunk => {
          data += chunk;
        });

        res.on("end", () => {
          resolve(data);
        });
      })
      .on("error", reject);
  });
}

/**
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
function getContentType(url) {
  return new Promise(function(resolve, reject) {
    https
      .get(url, { method: "HEAD" }, res => {
        resolve(res.headers["content-type"]);
      })
      .on("error", reject);
  });
}

/**
 *
 * @param {string} name
 * @returns {Date}
 */
async function getOldestDate(name) {
  let regex = new RegExp(`/${name}/(\\d{4})/(\\d{2})/(\\d{2})`, "g");
  let data = await getPage(`https://www.gocomics.com/${name}/`);
  var match;
  var oldestDate = new Date();

  while ((match = regex.exec(data))) {
    var date = new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3])
    );

    if (date < oldestDate) {
      oldestDate = date;
    }
  }

  return oldestDate;
}

/**
 *
 * @param {string} name
 * @returns {Date}
 */
async function getNewestDate(name) {
  let regex = new RegExp(`/${name}/(\\d{4})/(\\d{2})/(\\d{2})`, "g");
  let data = await getPage(`https://www.gocomics.com/${name}/`);
  var match;
  var newestDate = 0;

  while ((match = regex.exec(data))) {
    var date = new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3])
    );

    if (date > newestDate) {
      newestDate = date;
    }
  }

  return newestDate == 0 ? null : newestDate;
}

/**
 *
 * @param {string} name
 * @param {Date} date
 * @returns {Promise<string[]>}
 */
async function getImageUrl(name, date) {
  let url = `https://www.gocomics.com/${name}/${date.getFullYear()}/${padDate(
    date.getMonth() + 1
  )}/${padDate(date.getDate())}`;
  console.log(url);
  let data = await getPage(url);
  if (!data) {
    return null;
  }
  let regex = /class="item-comic-image".*?data-srcset="(https?:[^ ]+)/;
  let match = data.match(regex);

  if (match) {
    var contentType = await getContentType(match[1]);
    var extension = "";
    var filename = `${date.getFullYear()}-${padDate(
      date.getMonth() + 1
    )}-${padDate(date.getDate())}`;

    switch (contentType) {
      case "image/gif":
        extension = "gif";
        break;

      case "image/png":
        extension = "png";
        break;

      case "image/jpeg":
        extension = "jpg";
        break;

      case "image/jpg":
        extension = "jpg";
        break;
    }
    return [match[1], `${filename}.${extension}`];
  }

  console.log(url, match);

  return null;
}

/**
 *
 * @param {string} path
 * @returns {Date}
 */
function findLatestDownload(path) {
  let files = fs.readdirSync(path);
  var newestDate = 0;

  for (var i = 0; i < files.length; i++) {
    let regex = /^(\d{4})-(\d{2})-(\d{2})(?:\.[^\.]+)?$/;
    var match;

    if ((match = files[i].match(regex))) {
      var date = new Date(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3])
      );

      if (date > newestDate) {
        newestDate = date;
      }
    }
  }

  return newestDate == 0 ? null : newestDate;
}

async function Main() {
  let comic = "getfuzzy";
  let downloadPath = `downloads/${comic}`;

  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }
  var oldest = findLatestDownload(downloadPath);

  if (oldest == null) {
    oldest = await getOldestDate(comic);
  } else {
    oldest = new Date(oldest.setDate(oldest.getDate() + 1));
  }
  var newest = await getNewestDate(comic);

  var loop = new Date(oldest);

  while (loop <= newest) {
    var image = await getImageUrl(comic, loop);
    if (!image) {
      loop = new Date(loop.setDate(loop.getDate() + 1));
      continue;
    }
    const downloadFilename = `${downloadPath}/${image[1]}`;
    if (image && !fs.existsSync(downloadFilename)) {
      try {
        await downloadFile(image[0], downloadFilename);
      } catch (e) {
        if (fs.existsSync(downloadFilename)) {
          fs.unlinkSync(downloadFilename);
        }
        console.error(e);
        return;
      }
    }

    if (!image) {
      console.log(loop);
    }

    loop = new Date(loop.setDate(loop.getDate() + 1));
  }
}

Main().then(console.log);
