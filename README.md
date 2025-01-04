# Farming Simulator 2025 sync kit

This is a sync application that can be used as a replacement for a dedicated server when you want to play Farming Simulator 2025 with your friends.
It is a simple application that allows you to sync the game state between multiple players.

To set it up, you have to follow these steps:

1. Download the latest release from the [releases page]() and extract it to a folder.

2. Run the application

3. Add credentials for your Cloudflare worker (it's free) that is used to sync the game state. Follow the instruction here //todo

4. Share the setup link with your frinds. Your friends habe to download this app as well and can join your game by using the setup link.

5. Start the game and enjoy playing with your friends!


## How it works

The application uses a Cloudflare worker to sync the game state between the players. The worker is a simple JavaScript function that is executed on the Cloudflare edge servers. It is used to upload the game files (mods and savegames) to a Cloudflare R2 bucket (all for free) or download them to the players' machines.

You can choose which savegames you want to sync. When syncing the games state, mods will only be downloaded if they are not already present on the player's machine. This application won't delete any mods from your machine, so no savegame will be broken by using this application.