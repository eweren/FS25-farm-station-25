
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);
    const corsHeaders = {
      'Access-Control-Allow-Headers': '*', // What headers are allowed. * is wildcard. Instead of using '*', you can specify a list of specific headers that are allowed, such as: Access-Control-Allow-Headers: X-Requested-With, Content-Type, Accept, Authorization.
      'Access-Control-Allow-Methods': 'POST,PUT,GET,DELETE', // Allowed methods. Others could be GET, PUT, DELETE etc.
      'Access-Control-Allow-Origin': '*', // This is URLs that are allowed to access the server. * is the wildcard character meaning any URL can.
    }

    const headers = request.headers;

    const teamId = headers.get("teamId") || "asd";

    const r2Data = await env.LS25DATA.get(teamId);

    const throwIfUnauthenticated = () => {
      console.log(teamId, r2Data)
      if (r2Data == null) {
        return Response.json({ status: "error" }, {
          status: 401,
          headers: {
            'Content-type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    switch (request.method) {
      case "OPTIONS":
        return new Response("OK", {
          headers: corsHeaders
        });
      // add or override a savegame in the team directory
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
            const res = await env.LS25.put(`${teamId}/savegames/${key}`, file, {
              customMetadata: { savegameInfo }
            });
            console.log("Putted", res);
            return Response.json({ status: "success" }, {
              headers: {
                'Content-type': 'application/json',
                ...corsHeaders
              }
            });
          } else if (modInfo) {
            const res = await env.LS25.put(`_mods/${key}___${JSON.parse(modInfo).version}`, file, {
              customMetadata: { modInfo }
            });
            console.log(res);
            return Response.json({ status: "success" }, {
              headers: {
                'Content-type': 'application/json',
                ...corsHeaders
              }
            });

          }
        } catch (err) {
          console.log(err);
          return Response.json({ status: "error" }, {
            headers: {
              'Content-type': 'application/json',
              ...corsHeaders
            }
          });
        }
      // create or validate the teamId with an inviteCode
      case "POST":
        const postData = await request.formData();
        try {
          const _teamId = postData.get("teamId");
          const _inviteCode = postData.get("inviteCode");

          console.log("teamId", _teamId, typeof _teamId);
          console.log(_inviteCode);
          if (_teamId == null || _inviteCode == null) {
            return Response.json({ status: "false", reason: "no_teamId_or_inviteCode" }, {
              headers: {
                'Content-type': 'application/json',
                ...corsHeaders
              }
            });
          }
          if (_teamId.length < 3 || _inviteCode.length < 3) {
            return Response.json({ status: "false", reason: "teamId_or_inviteCode_too_short" }, {
              headers: {
                'Content-type': 'application/json',
                ...corsHeaders
              }
            });
          }
          const kv = await env.LS25DATA.get(_teamId);
          if (kv != null) {
            if (kv === _inviteCode) {
              return Response.json({ status: "success" }, {
                headers: {
                  'Content-type': 'application/json',
                  ...corsHeaders
                }
              });
            }
            return Response.json({ status: "false", reason: "teamid_not_available_or_wrong_password" }, {
              headers: {
                'Content-type': 'application/json',
                ...corsHeaders
              }
            });
          }

          const res = await env.LS25DATA.put(_teamId, _inviteCode);
          console.log(res);
          return Response.json({ status: "success" }, {
            headers: {
              'Content-type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (err) {
          console.log(err);
          return Response.json({ status: "error" }, {
            headers: {
              'Content-type': 'application/json',
              ...corsHeaders
            }
          });
        }
      // get a list of all savegames of the team or of all mods or download a specific savegame or mod
      case "GET":
        const unauthRes = throwIfUnauthenticated();
        if (unauthRes) {
          return unauthRes;
        }
        if (key.length === 0) {
          const options = { prefix: `${teamId}/savegames`, };
          const { objects } = await env.LS25.list({ ...options, limit: 500, include: ["customMetadata"] });
          if (objects === null) {
            return new Response("No Objects Found", {
              status: 404, headers: {
                'Content-type': 'application/json',
                ...corsHeaders
              }
            })
          }

          const headers = new Headers();
          headers.set("etag", objects.httpEtag);

          return new Response(JSON.stringify(objects.map(o => ({ key: o.key, uploaded: o.uploaded, size: o.size, savegameInfo: JSON.parse(o.customMetadata?.savegameInfo ?? "{}") }))), {
            headers: {
              'Content-type': 'application/json',
              ...headers,
              ...corsHeaders
            },
          });
        } else if (key === "_mods") {
          const options = { prefix: "_mods", };
          const { objects } = await env.LS25.list({ ...options, limit: 500, include: ["customMetadata"] });
          if (objects === null) {
            return new Response("No Objects Found", {
              status: 404, headers: {
                'Content-type': 'application/json',
                ...corsHeaders
              }
            })
          }

          const headers = new Headers();
          headers.set("etag", objects.httpEtag);

          return new Response(JSON.stringify(objects.map(o => ({ key: o.key, uploaded: o.uploaded, size: o.size, modInfo: JSON.parse(o.customMetadata?.modInfo ?? "{}") }))), {
            headers: {
              'Content-type': 'application/json',
              ...headers,
              ...corsHeaders
            },
          });
        }
        const path = key.startsWith("savegame") ? `${teamId}/savegames/${key}` : key;
        const object = await env.LS25.get(path);

        if (object === null) {
          return new Response("Object Not Found", {
            status: 404, headers: {
              'Content-type': 'application/json',
              ...corsHeaders
            }
          });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);

        return new Response(object.body, {
          headers: {
            ...headers,
            ...corsHeaders
          },
        });
      case "DELETE":
        const throwIfUnauthRes = throwIfUnauthenticated();
        if (throwIfUnauthRes) {
          return throwIfUnauthRes;
        }
        await env.LS25.delete(key);
        return new Response("Deleted!", {
          headers: {
            'Content-type': 'application/text',
            ...corsHeaders
          }
        });

      default:
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            Allow: "PUT, GET, POST, DELETE",
          },
        });
    }
  },
};