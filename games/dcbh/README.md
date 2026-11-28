# Dungeon Crawl Bullet Hell

Steer a Deep Elf Annihilator through three generated arenas. Damnation fires automatically. Walking onto a staircase takes you to the adjoining floor. You can step away and walk back onto it to return.

Run `./run.xsh` to open the game locally. The launcher needs XSH, Python 3, curl and GNU Screen. It reuses the local preview on port 63434. To stop a preview started by the launcher, run `screen -S dcbh-preview -X quit`. The website serves the same static files directly, with no build step. Run `./test.xsh` to check the arenas with Node.js.
