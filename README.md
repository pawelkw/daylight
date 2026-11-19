# Daylight milestones

A small web app that counts down to the moments the dark months turn: evenings getting lighter (before the shortest day), the shortest day, lighter mornings, the day there's enough light again, the equinox and the longest day.

It runs entirely on your phone. Your location is used only to work out sunrise and sunset, is rounded to about a kilometre, and is stored on the device. Nothing is sent anywhere, and after the first visit it works offline.

## Install on an iPhone

Open the site in Safari, tap Share, then **Add to Home Screen**.

## Develop

It's plain HTML, CSS and JavaScript with no build step. Serve the folder over HTTP, for example `python3 -m http.server`, and open it in a browser. When you change a file, bump `VERSION` in `sw.js` so installed copies update.
