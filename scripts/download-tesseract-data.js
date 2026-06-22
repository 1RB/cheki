#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

const OUT_DIR = path.join(__dirname, "..", "public");
const OUT_FILE = path.join(OUT_DIR, "eng.traineddata.gz");
const URL = "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz";

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          return download(response.headers.location, dest).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          return reject(new Error(`Download failed: ${response.statusCode}`));
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

async function main() {
  if (fs.existsSync(OUT_FILE)) {
    const stats = fs.statSync(OUT_FILE);
    if (stats.size > 1000000) {
      console.log("Tesseract trained data already present:", OUT_FILE);
      return;
    }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("Downloading Tesseract trained data...");
  await download(URL, OUT_FILE);
  console.log("Saved:", OUT_FILE, "size:", fs.statSync(OUT_FILE).size);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
