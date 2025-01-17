import { Context } from 'hono';
import { BlankInput } from 'hono/types';
import { HTTPException } from 'hono/http-exception';

export type Bindings = {
  LS25: R2Bucket
  LS25DATA: KVNamespace
}

/** Array of random farming related words */
export const landwirtschaftArray = {
  de: "Traktor, Ernte, Acker, Bauer, Saat, Pflug, Stall, Heu, Kuh, Schaf, Huhn, Schwein, Mais, Weizen, Raps, Gerste, Hafer, Kartoffel, Tomate, Gurke, Salat, Apfel, Birne, Kirsche, Pflaume, Wein, Traube, Milch, Butter, Käse, Joghurt, Honig, Eier, Wolle, Fleisch, Wiese, Weide, Feld, Boden, Dünger, Kompost, Gülle, Mist, Saatgut, Pflanze, Blume, Baum, Strauch, Busch, Wald, Forst, Teich, See, Fluss, Bach, Regen, Sonne, Wind, Wetter, Klima, Erde, Sand, Lehm, Ton, Humus, Mulch, Erntezeit, Frühling, Sommer, Herbst, Winter, Traktor, Mähdrescher, Pflanzenschutz, Unkraut, Schädling, Insekt, Biene, Schmetterling, Vogel, Fisch, Schnecke, Wurm, Käfer, Spinne, Schaf, Ziege, Pferd, Esel, Hund, Katze, Maus, Ratte, Hase, Kaninchen, Reh, Wildschwein, Fuchs, Dachs, Igel, Marder, Feldmaus, Wühlmaus",
  cs: "Traktor, sklizeň, pole, farmář, semena, pluh, stáj, seno, kráva, ovce, kuře, prase, kukuřice, pšenice, řepka, ječmen, oves, brambory, rajče, okurka, salát, jablko, hruška, třešeň, švestka, Víno, hroznové víno, mléko, máslo, sýr, jogurt, med, vejce, vlna, maso, louka, pastvina, pole, půda, hnojivo, kompost, hnůj, hnůj, semena, rostlina, Květina, strom, keř, keř, les, les, rybník, jezero, řeka, potok, déšť, slunce, vítr, počasí, klima, země, písek, hlína, hlína, humus, mulč, čas sklizně, jaro, léto, podzim , zima, traktor, kombajn, ochrana plodin, plevel, škůdce, hmyz, včela, motýl, pták, ryba, šnek, červ, brouk, pavouk, ovce, koza, kůň, osel, pes, kočka, myš, Krysa, zajíc, králík, jelen, divočák, liška, jezevec, ježek, kuna, polní myš, hraboš",
  en: "tractor, harvest, field, farmer, seed, plough, stable, hay, cow, sheep, chicken, pig, corn, wheat, rapeseed, barley, oats, potato, tomato, cucumber, lettuce, apple, pear, cherry, plum, wine, grape, milk, butter, cheese, yoghurt, honey, eggs, wool, meat, meadow, pasture, field, soil, fertilizer, compost, liquid manure, dung, seed, plant, flower, tree, shrub, bush, forest, forestry, pond, lake, river, stream, rain, sun, wind, weather, climate, earth, sand, loam, clay, humus, mulch, harvest time, spring, summer, autumn, winter, tractor, combine harvester, plant protection, weed, pest, insect, bee, butterfly, bird, fish, snail, worm, beetle, spider, sheep, goat, horse, donkey, dog, cat, mouse, rat, hare, rabbit, deer, wild boar, fox, badger, hedgehog, marten, field mouse, vole",
  es: "Tractor, cosecha, campo, granjero, semillas, arado, establo, heno, vaca, oveja, pollo, cerdo, maíz, trigo, colza, cebada, avena, patata, tomate, pepino, lechuga, manzana, pera, cereza, ciruela, Vino, uva, leche, mantequilla, queso, yogur, miel, huevos, lana, carne, pradera, pasto, campo, suelo, fertilizante, abono, estiércol, estiércol, semillas, plantas, Flor, árbol, arbusto, arbusto, bosque, bosque, estanque, lago, río, arroyo, lluvia, sol, viento, tiempo, clima, tierra, arena, arcilla, arcilla, humus, mantillo, tiempo de cosecha, primavera, verano, otoño , Invierno, tractor, cosechadora, protección de cultivos, malezas, plagas, insectos, abejas, mariposas, pájaros, peces, caracoles, gusanos, escarabajos, arañas, ovejas, cabras, caballos, burros, perros, gatos, ratones, Rata, liebre, conejo, ciervo, jabalí, zorro, tejón, erizo, marta, ratón de campo, campañol",
  fr: "Tracteur, récolte, champ, agriculteur, graines, charrue, écurie, foin, vache, mouton, poulet, porc, maïs, blé, colza, orge, avoine, pomme de terre, tomate, concombre, laitue, pomme, poire, cerise, prune, Vin, raisin, lait, beurre, fromage, yaourt, miel, œufs, laine, viande, prairie, pâturage, champ, terre, engrais, compost, fumier, fumier, graines, plante, Fleur, arbre, arbuste, buisson, forêt, forêt, étang, lac, rivière, ruisseau, pluie, soleil, vent, météo, climat, terre, sable, argile, argile, humus, paillis, période de récolte, printemps, été, automne hiver, tracteur, moissonneuse-batteuse, protection des cultures, mauvaise herbe, ravageur, insecte, abeille, papillon, oiseau, poisson, escargot, ver, coléoptère, araignée, mouton, chèvre, cheval, âne, chien, chat, souris, Rat, lièvre, lapin, cerf, sanglier, renard, blaireau, hérisson, martre, mulot, campagnol",
  nl: "Tractor, oogst, veld, boer, zaden, ploeg, stal, hooi, koe, schaap, kip, varken, maïs, tarwe, koolzaad, gerst, haver, aardappel, tomaat, komkommer, sla, appel, peer, kers, pruim, Wijn, druif, melk, boter, kaas, yoghurt, honing, eieren, wol, vlees, weide, weiland, veld, bodem, kunstmest, compost, mest, mest, zaden, plant, Bloem, boom, struik, struik, bos, bos, vijver, meer, rivier, stroom, regen, zon, wind, weer, klimaat, aarde, zand, klei, klei, humus, mulch, oogsttijd, lente, zomer, herfst De winter, tractor, maaidorser, gewasbescherming, onkruid, ongedierte, insect, bij, vlinder, vogel, vis, slak, worm, kever, spin, schaap, geit, paard, ezel, hond, kat, muis, Rat, haas, konijn, hert, wild zwijn, vos, das, egel, marter, veldmuis, woelmuis",
  ru: "Трактор, урожай, поле, фермер, семена, плуг, конюшня, сено, корова, овца, курица, свинья, кукуруза, пшеница, рапс, ячмень, овес, картофель, помидор, огурец, салат, яблоко, груша, вишня, слива, Вино, виноград, молоко, масло, сыр, йогурт, мед, яйца, шерсть, мясо, луг, пастбище, поле, почва, удобрения, компост, навоз, навоз, семена, растения, Цветок, дерево, кустарник, куст, лес, лес, пруд, озеро, река, ручей, дождь, солнце, ветер, погода, климат, земля, песок, глина, глина, перегной, мульча, время сбора урожая, весна, лето, осень , Зима, трактор, комбайн, защита урожая, сорняк, вредитель, насекомое, пчела, бабочка, птица, рыба, улитка, червь, жук, паук, овца, коза, лошадь, осел, собака, кошка, мышь, Крыса, заяц, кролик, олень, кабан, лиса, барсук, еж, куница, полевая мышь, полевка",
  uk: "Трактор, урожай, поле, фермер, насіння, плуг, стайня, сіно, корова, вівця, курка, свиня, кукурудза, пшениця, ріпак, ячмінь, овес, картопля, помідор, огірок, салат, яблуко, груша, вишня, слива, Вино, виноград, молоко, масло, сир, йогурт, мед, яйця, вовна, м'ясо, луг, пасовище, поле, ґрунт, добриво, компост, гній, гній, насіння, рослина, Квітка, дерево, кущ, кущ, ліс, ліс, ставок, озеро, річка, струмок, дощ, сонце, вітер, погода, клімат, земля, пісок, глина, глина, гумус, мульча, час збору врожаю, весна, літо, осінь , Зима, трактор, комбайн, захист рослин, бур'ян, шкідник, комаха, бджола, метелик, птах, риба, равлик, черв'як, жук, павук, вівця, коза, кінь, осел, собака, кіт, миша, Щур, заєць, кролик, олень, кабан, лисиця, борсук, їжак, куниця, миша польова, полівка",
};


/** Return x random entries of an array. */
export function getRandomEntries<T>(array: Array<T>, x: number): Array<T> {
  const shuffled = array.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, x);
}

/**
 * Parses the teamId and lang from the request headers and fetches KV data if present.
 */
export async function getSharedDataFromHeaders(c: Context<{
  Bindings: Bindings;
}, "/", BlankInput>, throwIfUnauthenticated = false) {
  const teamId = c.req.header('teamId');
  const lang = c.req.header('lang') ?? "en";
  const { iC: inviteCode, p: players } = (teamId != null && teamId.length > 0 ? JSON.parse(await c.env.LS25DATA.get(teamId) ?? "{}") : {}) as { iC?: string, p?: string };

  if (throwIfUnauthenticated && (teamId == null || inviteCode == null)) {
    throw new HTTPException(401, { message: 'unauthorized' });
  }

  let _players = (players ?? "").split(",").filter(p => p.trim().length > 0);

  return { teamId: teamId!, lang, inviteCode: inviteCode!, players: _players };
}
