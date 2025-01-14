var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

/** Array of random farming related words */
const landwirtschaftArray = {
  de: "Traktor, Ernte, Acker, Bauer, Saat, Pflug, Stall, Heu, Kuh, Schaf, Huhn, Schwein, Mais, Weizen, Raps, Gerste, Hafer, Kartoffel, Tomate, Gurke, Salat, Apfel, Birne, Kirsche, Pflaume, Wein, Traube, Milch, Butter, Käse, Joghurt, Honig, Eier, Wolle, Fleisch, Wiese, Weide, Feld, Boden, Dünger, Kompost, Gülle, Mist, Saatgut, Pflanze, Blume, Baum, Strauch, Busch, Wald, Forst, Teich, See, Fluss, Bach, Regen, Sonne, Wind, Wetter, Klima, Erde, Sand, Lehm, Ton, Humus, Mulch, Erntezeit, Frühling, Sommer, Herbst, Winter, Traktor, Mähdrescher, Pflanzenschutz, Unkraut, Schädling, Insekt, Biene, Schmetterling, Vogel, Fisch, Schnecke, Wurm, Käfer, Spinne, Schaf, Ziege, Pferd, Esel, Hund, Katze, Maus, Ratte, Hase, Kaninchen, Reh, Wildschwein, Fuchs, Dachs, Igel, Marder, Feldmaus, Wühlmaus",
  cz: "Traktor, sklizeň, pole, farmář, semena, pluh, stáj, seno, kráva, ovce, kuře, prase, kukuřice, pšenice, řepka, ječmen, oves, brambory, rajče, okurka, salát, jablko, hruška, třešeň, švestka, Víno, hroznové víno, mléko, máslo, sýr, jogurt, med, vejce, vlna, maso, louka, pastvina, pole, půda, hnojivo, kompost, hnůj, hnůj, semena, rostlina, Květina, strom, keř, keř, les, les, rybník, jezero, řeka, potok, déšť, slunce, vítr, počasí, klima, země, písek, hlína, hlína, humus, mulč, čas sklizně, jaro, léto, podzim , zima, traktor, kombajn, ochrana plodin, plevel, škůdce, hmyz, včela, motýl, pták, ryba, šnek, červ, brouk, pavouk, ovce, koza, kůň, osel, pes, kočka, myš, Krysa, zajíc, králík, jelen, divočák, liška, jezevec, ježek, kuna, polní myš, hraboš",
  en: "tractor, harvest, field, farmer, seed, plough, stable, hay, cow, sheep, chicken, pig, corn, wheat, rapeseed, barley, oats, potato, tomato, cucumber, lettuce, apple, pear, cherry, plum, wine, grape, milk, butter, cheese, yoghurt, honey, eggs, wool, meat, meadow, pasture, field, soil, fertilizer, compost, liquid manure, dung, seed, plant, flower, tree, shrub, bush, forest, forestry, pond, lake, river, stream, rain, sun, wind, weather, climate, earth, sand, loam, clay, humus, mulch, harvest time, spring, summer, autumn, winter, tractor, combine harvester, plant protection, weed, pest, insect, bee, butterfly, bird, fish, snail, worm, beetle, spider, sheep, goat, horse, donkey, dog, cat, mouse, rat, hare, rabbit, deer, wild boar, fox, badger, hedgehog, marten, field mouse, vole",
  es: "Tractor, cosecha, campo, granjero, semillas, arado, establo, heno, vaca, oveja, pollo, cerdo, maíz, trigo, colza, cebada, avena, patata, tomate, pepino, lechuga, manzana, pera, cereza, ciruela, Vino, uva, leche, mantequilla, queso, yogur, miel, huevos, lana, carne, pradera, pasto, campo, suelo, fertilizante, abono, estiércol, estiércol, semillas, plantas, Flor, árbol, arbusto, arbusto, bosque, bosque, estanque, lago, río, arroyo, lluvia, sol, viento, tiempo, clima, tierra, arena, arcilla, arcilla, humus, mantillo, tiempo de cosecha, primavera, verano, otoño , Invierno, tractor, cosechadora, protección de cultivos, malezas, plagas, insectos, abejas, mariposas, pájaros, peces, caracoles, gusanos, escarabajos, arañas, ovejas, cabras, caballos, burros, perros, gatos, ratones, Rata, liebre, conejo, ciervo, jabalí, zorro, tejón, erizo, marta, ratón de campo, campañol",
  fr: "Tracteur, récolte, champ, agriculteur, graines, charrue, écurie, foin, vache, mouton, poulet, porc, maïs, blé, colza, orge, avoine, pomme de terre, tomate, concombre, laitue, pomme, poire, cerise, prune, Vin, raisin, lait, beurre, fromage, yaourt, miel, œufs, laine, viande, prairie, pâturage, champ, terre, engrais, compost, fumier, fumier, graines, plante, Fleur, arbre, arbuste, buisson, forêt, forêt, étang, lac, rivière, ruisseau, pluie, soleil, vent, météo, climat, terre, sable, argile, argile, humus, paillis, période de récolte, printemps, été, automne hiver, tracteur, moissonneuse-batteuse, protection des cultures, mauvaise herbe, ravageur, insecte, abeille, papillon, oiseau, poisson, escargot, ver, coléoptère, araignée, mouton, chèvre, cheval, âne, chien, chat, souris, Rat, lièvre, lapin, cerf, sanglier, renard, blaireau, hérisson, martre, mulot, campagnol",
  nl: "Tractor, oogst, veld, boer, zaden, ploeg, stal, hooi, koe, schaap, kip, varken, maïs, tarwe, koolzaad, gerst, haver, aardappel, tomaat, komkommer, sla, appel, peer, kers, pruim, Wijn, druif, melk, boter, kaas, yoghurt, honing, eieren, wol, vlees, weide, weiland, veld, bodem, kunstmest, compost, mest, mest, zaden, plant, Bloem, boom, struik, struik, bos, bos, vijver, meer, rivier, stroom, regen, zon, wind, weer, klimaat, aarde, zand, klei, klei, humus, mulch, oogsttijd, lente, zomer, herfst De winter, tractor, maaidorser, gewasbescherming, onkruid, ongedierte, insect, bij, vlinder, vogel, vis, slak, worm, kever, spin, schaap, geit, paard, ezel, hond, kat, muis, Rat, haas, konijn, hert, wild zwijn, vos, das, egel, marter, veldmuis, woelmuis",
  ru: "Трактор, урожай, поле, фермер, семена, плуг, конюшня, сено, корова, овца, курица, свинья, кукуруза, пшеница, рапс, ячмень, овес, картофель, помидор, огурец, салат, яблоко, груша, вишня, слива, Вино, виноград, молоко, масло, сыр, йогурт, мед, яйца, шерсть, мясо, луг, пастбище, поле, почва, удобрения, компост, навоз, навоз, семена, растения, Цветок, дерево, кустарник, куст, лес, лес, пруд, озеро, река, ручей, дождь, солнце, ветер, погода, климат, земля, песок, глина, глина, перегной, мульча, время сбора урожая, весна, лето, осень , Зима, трактор, комбайн, защита урожая, сорняк, вредитель, насекомое, пчела, бабочка, птица, рыба, улитка, червь, жук, паук, овца, коза, лошадь, осел, собака, кошка, мышь, Крыса, заяц, кролик, олень, кабан, лиса, барсук, еж, куница, полевая мышь, полевка",
  uk: "Трактор, урожай, поле, фермер, насіння, плуг, стайня, сіно, корова, вівця, курка, свиня, кукурудза, пшениця, ріпак, ячмінь, овес, картопля, помідор, огірок, салат, яблуко, груша, вишня, слива, Вино, виноград, молоко, масло, сир, йогурт, мед, яйця, вовна, м'ясо, луг, пасовище, поле, ґрунт, добриво, компост, гній, гній, насіння, рослина, Квітка, дерево, кущ, кущ, ліс, ліс, ставок, озеро, річка, струмок, дощ, сонце, вітер, погода, клімат, земля, пісок, глина, глина, гумус, мульча, час збору врожаю, весна, літо, осінь , Зима, трактор, комбайн, захист рослин, бур'ян, шкідник, комаха, бджола, метелик, птах, риба, равлик, черв'як, жук, павук, вівця, коза, кінь, осел, собака, кіт, миша, Щур, заєць, кролик, олень, кабан, лисиця, борсук, їжак, куниця, миша польова, полівка",
};

/** Return x random entries of an array. */
function getRandomEntries(array, x) {
  const shuffled = array.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, x);
}

/**
 * The actual server. It's pretty basic. The server is actually just checking if needed headers are present, and returns
 * results based on the HTTP method.
 * 
 * On POST, it will either set the playing status of a player or create or validate a team.
 * 
 * On GET, it will either return the playing players of the team, a list of all savegames or mods or a specific savegame
 * or mod for download (from R2).
 * 
 * On PUT, it will save the given mod or savegame to R2.
 * 
 * On DELETE, it will delete the file at the given path on R2.
 * 
 * On OPTIONS, it will return the CORS headers.
 */
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1).replace(/\%20/g, " ");
    const corsHeaders = {
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "POST,PUT,GET,DELETE",
      "Access-Control-Allow-Origin": "*"
    };

    const headers = request.headers;
    const teamId = headers.get("teamId");
    const lang = headers.get("lang") ?? "en";
    const { iC, p: players } = JSON.parse(await env.LS25DATA.get(teamId) ?? "{}");
    const throwIfUnauthenticated = /* @__PURE__ */ __name(() => {
      console.log("TeamId and InviteCode", teamId, iC);
      if (iC == null) {
        return Response.json({ status: "error" }, {
          status: 401,
          headers: {
            "Content-type": "application/json",
            ...corsHeaders
          }
        });
      }
    }, "throwIfUnauthenticated");
    switch (request.method) {
      case "OPTIONS":
        return new Response("OK", {
          headers: corsHeaders
        });
      case "PUT":
        const res = throwIfUnauthenticated();
        if (res) {
          return res;
        }
        const formData = await request.formData();
        const file = formData.get("file");
        try {
          console.log("Received file");
          const savegameInfo = formData.get("savegameInfo");
          const modInfo = formData.get("modInfo");
          if (savegameInfo) {
            console.log("Putting file");
            const fileId = `${teamId}/savegames/${key.split("/").pop()}`;
            const res2 = await env.LS25.put(fileId, file, {
              customMetadata: { savegameInfo }
            });
            console.log("Putted", res2);
            return Response.json({ status: "success", path: fileId }, {
              headers: {
                "Content-type": "application/json",
                ...corsHeaders
              }
            });
          } else if (modInfo) {
            const res2 = await env.LS25.put(`_mods/${key}___${JSON.parse(modInfo).version}`, file, {
              customMetadata: { modInfo }
            });
            console.log(res2);
            return Response.json({ status: "success" }, {
              headers: {
                "Content-type": "application/json",
                ...corsHeaders
              }
            });
          }
        } catch (err) {
          console.log(err);
          return Response.json({ status: "error" }, {
            headers: {
              "Content-type": "application/json",
              ...corsHeaders
            }
          });
        }
      case "POST":
        if (key === "_playerStatus") {
          const body = await request.json();

          let _players = players.split(",").filter(p => p.trim().length > 0)
          console.log(_players);

          if (body.playing) {
            _players.push(body.name);
            _players = Array.from(new Set(_players));
          } else {
            _players = _players.filter(p => p !== body.name);
          }
          await env.LS25DATA.put(teamId, JSON.stringify({ iC, p: _players.join(",") }));

          return new Response(JSON.stringify(_players) ?? "[]",
            {
              headers: {
                "Content-type": "application/json",
                ...corsHeaders
              }
            });
        }

        const postData = await request.formData();
        try {
          const _teamId = postData.get("teamId");
          const _inviteCode = postData.get("inviteCode");
          const _isCreate = postData.get("isCreate") === "true";
          console.log("teamId", _teamId, typeof _teamId);
          console.log(_inviteCode);
          if (_teamId == null || (_inviteCode == null && !_isCreate)) {
            return Response.json({ status: "false", reason: "no_teamId_or_inviteCode" }, {
              headers: {
                "Content-type": "application/json",
                ...corsHeaders
              }
            });
          }
          if (_teamId.length < 3 || (_inviteCode.length < 3 && !_isCreate)) {
            return Response.json({ status: "false", reason: "teamId_or_inviteCode_too_short" }, {
              headers: {
                "Content-type": "application/json",
                ...corsHeaders
              }
            });
          }
          const { iC } = JSON.parse(await env.LS25DATA.get(_teamId) ?? "{}");
          if (iC != null) {
            if (iC === _inviteCode) {
              return Response.json({ status: "success" }, {
                headers: {
                  "Content-type": "application/json",
                  ...corsHeaders
                }
              });
            }
            if (_isCreate) {
              return Response.json({ status: "false", reason: "teamid_not_available" }, {
                headers: {
                  "Content-type": "application/json",
                  ...corsHeaders
                }
              });
            }
            return Response.json({ status: "false", reason: "wrong_invite_code" }, {
              headers: {
                "Content-type": "application/json",
                ...corsHeaders
              }
            });
          }
          const inviteCode = getRandomEntries(lang in landwirtschaftArray ? landwirtschaftArray[lang] : landwirtschaftArray["en"], 3).join("-");
          const res2 = await env.LS25DATA.put(_teamId, JSON.stringify({ iC: inviteCode }));
          console.log(res2);
          return Response.json({ status: "success", inviteCode }, {
            headers: {
              "Content-type": "application/json",
              ...corsHeaders
            }
          });
        } catch (err) {
          console.log(err);
          return Response.json({ status: "error" }, {
            headers: {
              "Content-type": "application/json",
              ...corsHeaders
            }
          });
        }
      case "GET":
        const unauthRes = throwIfUnauthenticated();
        if (unauthRes) {
          return unauthRes;
        }
        console.log("Get ", key);
        if (key.length === 0) {
          const options = { prefix: `${teamId}/savegames` };
          const { objects } = await env.LS25.list({ ...options, limit: 500, include: ["customMetadata"] });
          if (objects === null) {
            return new Response("No Objects Found", {
              status: 404,
              headers: {
                "Content-type": "application/json",
                ...corsHeaders
              }
            });
          }
          const headers3 = new Headers();
          headers3.set("etag", objects.httpEtag);
          return new Response(JSON.stringify(objects.map((o) => ({ key: o.key, uploaded: o.uploaded, size: o.size, savegameInfo: JSON.parse(o.customMetadata?.savegameInfo ?? "{}") }))), {
            headers: {
              "Content-type": "application/json",
              ...headers3,
              ...corsHeaders
            }
          });
        } else if (key === "_mods") {
          const options = { prefix: "_mods" };
          const { objects } = await env.LS25.list({ ...options, limit: 500, include: ["customMetadata"] });
          if (objects === null) {
            return new Response("No Objects Found", {
              status: 404,
              headers: {
                "Content-type": "application/json",
                ...corsHeaders
              }
            });
          }
          const headers3 = new Headers();
          headers3.set("etag", objects.httpEtag);
          return new Response(JSON.stringify(objects.map((o) => ({ key: o.key, uploaded: o.uploaded, size: o.size, modInfo: JSON.parse(o.customMetadata?.modInfo ?? "{}") }))), {
            headers: {
              "Content-type": "application/json",
              ...headers3,
              ...corsHeaders
            }
          });
        } else if (key === "_playerStatus") {
          return new Response(JSON.stringify(players?.split(",").filter(p => p.trim().length > 0) ?? "[]"),
            {
              headers: {
                "Content-type": "application/json",
                ...corsHeaders
              }
            });
        }
        const path = key.startsWith("savegame") ? `${teamId}/savegames/${key}` : key;
        const object = await env.LS25.get(path);
        if (object === null) {
          return new Response("Object Not Found", {
            status: 404,
            headers: {
              "Content-type": "application/json",
              ...corsHeaders
            }
          });
        }
        const headers2 = new Headers();
        object.writeHttpMetadata(headers2);
        headers2.set("etag", object.httpEtag);
        return new Response(object.body, {
          headers: {
            ...headers2,
            ...corsHeaders
          }
        });
      case "DELETE":
        const throwIfUnauthRes = throwIfUnauthenticated();
        if (throwIfUnauthRes) {
          return throwIfUnauthRes;
        }
        if (!key.includes(teamId)) {
          return Response.json({ status: "error" }, {
            status: 401,
            headers: {
              "Content-type": "application/json",
              ...corsHeaders
            }
          });
        }
        await env.LS25.delete(key);
        return new Response("Deleted!", {
          headers: {
            "Content-type": "application/text",
            ...corsHeaders
          }
        });
      default:
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            Allow: "PUT, GET, POST, DELETE"
          }
        });
    }
  }
};

const logWrapper = {
  async fetch(request, env) {
    const res = await worker_default.fetch(request, env);
    const log = {
      url: request.url,
      method: request.method,
      headers: Array.from(res.headers.entries()).map(e => e.join(": ")).join("; "),
      status: res.status
    }
    console.log(log);
    return res;
  }
}

export {
  logWrapper as default
};
//# sourceMappingURL=worker.js.map
