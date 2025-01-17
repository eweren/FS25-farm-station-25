# Farm Station 25 Backend

This directory contains the Hono backend for Farm Station 25. It is used with Cloudflare Workers to save your savegames and mods in a Cloudflare R2 storage bucket.
The teams you create in the app, are stored in a Cloudflare KV namespace.

## Setup

1. Install the [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler/install-update)
2. Run `wrangler login` and login with your Cloudflare account

## Development

1. Run `wrangler dev` to start the development server
2. Start the frontend with `bun run tauri dev`

## Deployment

1. Run `wrangler publish` to deploy the backend to Cloudflare Workers (this is done automatically when you push to the release branch)

## Configuration

To setup on your own, adjust the wrangler.toml file to your needs to use your own Cloudflare KV and R2. Don't forget to adjust the `baseDomain` in `./src/lib/sync/utils.ts` to point to your own setup.

## License

This sub-project is licensed under the same license as the whole repo. See the [LICENSE](../LICENSE) file for more information.
