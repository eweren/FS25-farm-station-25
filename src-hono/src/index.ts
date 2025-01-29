import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Bindings, getRandomEntries, getSharedDataFromHeaders, landwirtschaftArray } from './utils';
import { HTTPException } from 'hono/http-exception';
import { initDbConnect } from './db';
import { mods } from './db/schema';

export type Mod = {
  modName: string;
  filename: string;
  titles: [{ [lang: string]: Array<string> }] | null;
  description: [{ [lang: string]: Array<string> }] | null;
  version: string;
  remoteFileName?: string;
  fileHash?: string;
}

export type ModResponse = {
  key: string,
  size: number,
  uploaded: string,
  modInfo: Mod
}

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  '*',
  cors({
    origin: ['http://tauri.localhost', 'http://localhost:1420', "*"],
  })
);

app.use(logger());

app.options('/_mods', (context) => {
  return context.text('OK');
});

app.get('/', async (context) => {
  const { teamId } = await getSharedDataFromHeaders(context, true);
  const options = { prefix: `${teamId}/savegames` };
  const { objects } = await context.env.LS25.list({ ...options, limit: 500, include: ["customMetadata"] });

  if (objects === null) {
    return context.json([], 200);
  }
  return context.json(objects.map((o) => ({ key: o.key, uploaded: o.uploaded, size: o.size, savegameInfo: JSON.parse(o.customMetadata?.savegameInfo ?? "{}") })));
});

app.get('/_playerStatus', async (context) => {
  const { players } = await getSharedDataFromHeaders(context, true);
  return context.json(players);
});

app.get('/_mods', async (context) => {
  await getSharedDataFromHeaders(context, true);
  const db = initDbConnect(context.env.DB);

  // let res = await context.env.LS25.list({ prefix: "_mods", limit: 500, include: ["customMetadata"] });
  // const rawMods = res.objects.map(o => ({ key: o.key, uploaded: o.uploaded.toISOString(), size: o.size, modInfo: JSON.parse(o.customMetadata?.modInfo ?? "{}") }) as ModResponse);

  // while (res.truncated) {
  //   res = await context.env.LS25.list({ prefix: "_mods", limit: 500, include: ["customMetadata"], startAfter: res.objects[res.objects.length - 1].key });
  //   rawMods.push(...res.objects.map(o => ({ key: o.key, uploaded: o.uploaded.toISOString(), size: o.size, modInfo: JSON.parse(o.customMetadata?.modInfo ?? "{}") }) as ModResponse));
  // }

  // console.log(rawMods.filter(m => m.size === 13).length);
  // for (const deleteMod of rawMods.filter(m => m.size === 13)) {
  //   await context.env.LS25.delete(deleteMod.key);
  //   console.log(deleteMod.key, "deleted");
  // }

  // // Delete all mods from the database
  // await db.delete(mods).all();

  // // Insert all mods from the remote server

  // for (let i = 0; i < rawMods.length; i += 20) {
  //   await db.insert(mods).values(rawMods.slice(i, i + 5).map(m => ({
  //     modName: m.modInfo.modName,
  //     fileHash: m.modInfo.fileHash ?? "",
  //     id: m.key.split("___")[0],
  //     title: JSON.stringify(m.modInfo.titles),
  //     description: JSON.stringify(m.modInfo.description),
  //     version: m.modInfo.version,
  //     filename: m.modInfo.filename,
  //     size: m.size,
  //     uploaded: m.uploaded
  //   }))).onConflictDoNothing();
  // }


  // return context.json(rawMods);

  const allModsInDb = (await db.select().from(mods).all()).map(m => ({ key: m.id, uploaded: m.uploaded, size: m.size, modInfo: { ...m, titles: JSON.parse(m.title), description: JSON.parse(m.description) } }) as ModResponse);

  return context.json(allModsInDb);
});

app.get('/_mods/:mod', async (context) => {
  await getSharedDataFromHeaders(context, true);

  const mod = context.req.param("mod");

  const object = await context.env.LS25.get(`_mods/${mod}`);
  if (object === null) {
    return context.text("Object Not Found", 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return context.body(object.body, {
    headers
  });
});


app.get('/:teamId/savegames/:savegame', async (context) => {
  const { teamId: tId } = await getSharedDataFromHeaders(context, true);

  const teamId = context.req.param("teamId");

  if (teamId !== tId) {
    return context.json({ status: "error" }, 401);
  }

  const savegame = context.req.param("savegame");
  const path = `${teamId}/savegames/${savegame}`;

  const object = await context.env.LS25.get(path);
  if (object === null) {
    return context.text("Object Not Found", 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return context.body(object.body, {
    headers
  });
});

app.delete('/:teamId/savegames/:key', async (context) => {
  const { teamId: tId } = await getSharedDataFromHeaders(context, true);
  const key = context.req.param("key");
  const teamId = context.req.param("teamId");

  if (key == null || teamId !== tId) {
    return context.json({ status: "error" }, 401);
  }
  await context.env.LS25.delete(key);
  return context.text("Deleted!");
});

app.post('/', async (context) => {
  const { lang } = await getSharedDataFromHeaders(context);


  const postData = await context.req.formData();
  try {
    const _teamId = postData.get("teamId") as string | undefined;
    const _inviteCode = postData.get("inviteCode") as string | undefined;
    const _isCreate = (postData.get("isCreate") as string | undefined) === "true";

    if (_teamId == null || (_inviteCode == null && !_isCreate)) {
      return context.json({ status: "false", reason: "no_teamId_or_inviteCode" });
    }
    if (_teamId.length < 3 || _inviteCode == null || (_inviteCode.length < 3 && !_isCreate)) {
      return context.json({ status: "false", reason: "teamId_or_inviteCode_too_short" });
    }
    const { iC } = JSON.parse(await context.env.LS25DATA.get(_teamId) ?? "{}");
    if (iC != null) {
      if (iC === _inviteCode) {
        return context.json({ status: "success" });
      }
      if (_isCreate) {
        return context.json({ status: "false", reason: "teamid_not_available" });
      }
      return context.json({ status: "false", reason: "wrong_invite_code" });
    }

    const inviteCode = getRandomEntries((lang in landwirtschaftArray ? landwirtschaftArray[lang as keyof typeof landwirtschaftArray] : landwirtschaftArray["en"]).split(", "), 3).join("-");
    const res2 = await context.env.LS25DATA.put(_teamId, JSON.stringify({ iC: inviteCode }));
    return context.json({ status: "success", inviteCode });
  } catch (err) {
    return context.json({ status: "error" });
  }
});

app.post('/_playerStatus', async (context) => {
  const { teamId, inviteCode, players } = await getSharedDataFromHeaders(context, true);

  const body = (await context.req.json()) as { name?: string, playing?: boolean };

  if (body.name == null || body.name.trim() === "") {
    throw new HTTPException(400, { message: 'invalid_name' });
  }

  let _players = players;

  if (body.playing) {
    _players.push(body.name);
    _players = Array.from(new Set(_players));
  } else {
    _players = _players.filter(p => p !== body.name);
  }
  await context.env.LS25DATA.put(teamId, JSON.stringify({ iC: inviteCode, p: _players.join(",") }));

  return context.json(_players);
});

app.put('/:teamId/savegames/:savegame', async (context) => {
  const { teamId: tId } = await getSharedDataFromHeaders(context, true);

  const teamId = context.req.param("teamId");
  const savegame = context.req.param("savegame");

  if (teamId !== tId) {
    return context.json({ status: "error" }, 401);
  }

  const formData = await context.req.formData();
  const file = formData.get('file') as File | undefined;

  if (!file) {
    throw new HTTPException(500, { message: 'no_file_in_request' });
  }

  if (savegame == null || savegame.trim() === "") {
    throw new HTTPException(400, { message: 'invalid_key' });
  }

  const savegameInfo = formData.get("savegameInfo") as string | undefined;

  if (savegameInfo == null) {
    throw new HTTPException(500, { message: 'invalid_savegame_info' });
  }

  try {
    const fileId = `${teamId}/savegames/${savegame}`;
    const res2 = await context.env.LS25.put(fileId, file, {
      customMetadata: { savegameInfo }
    });
    return context.json({ status: "success", path: fileId });

  } catch (err) {
    return context.json({ status: "error" });
  }
});

app.put('/:modId', async (context) => {
  await getSharedDataFromHeaders(context, true);

  const modId = context.req.param("modId");

  const formData = await context.req.formData();
  const file = formData.get('file') as File | undefined;

  if (!file) {
    throw new HTTPException(500, { message: 'no_file_in_request' });
  }

  if (modId == null || modId.trim() === "") {
    throw new HTTPException(400, { message: 'invalid_key' });
  }

  const modInfo = formData.get("modInfo") as string | undefined;

  if (modInfo == null) {
    throw new HTTPException(500, { message: 'invalid_mod_info' });
  }

  try {
    const res2 = await context.env.LS25.put(`_mods/${modId}___${JSON.parse(modInfo).version}`, file, {
      customMetadata: { modInfo }
    });

    const mod = JSON.parse(modInfo) as Mod

    const db = initDbConnect(context.env.DB);
    await db.insert(mods).values({
      modName: mod.modName,
      fileHash: mod.fileHash ?? res2.checksums.toJSON().md5 ?? "",
      id: modId,
      title: JSON.stringify(mod.titles),
      description: JSON.stringify(mod.description),
      version: mod.version,
      filename: file.name,
      size: file.size,
      uploaded: new Date().toISOString()
    }).onConflictDoNothing();
    return context.json({ status: "success" });

  } catch (err) {
    return context.json({ status: "error" });
  }
});

export default app
