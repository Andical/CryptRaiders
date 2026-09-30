/* ===========================================================================
 *  Crypt Raiders Online — arranque de la ACTIVIDAD DE DISCORD
 * ---------------------------------------------------------------------------
 *  UNA SOLA BUILD WEB sirve para los dos sitios: itch/navegador y Discord. Este fichero detecta dónde
 *  está corriendo y, SOLO dentro de Discord, carga el SDK y hace el saludo (`ready()`). En itch no se
 *  descarga ni un byte del SDK (son 156 KB que allí no pintan nada).
 *
 *  POR QUÉ EXISTE Y POR QUÉ NO SE TOCA index.html:
 *  Godot REESCRIBE index.html en cada exportación. La integración anterior vivía ahí y se perdió en
 *  algún build (quedó `discord-sdk.js` con un comentario y nada que lo cargara). Ahora el <script> se
 *  inyecta desde `html/head_include` del preset Web, que sí va en git, y la lógica vive aquí.
 *
 *  QUÉ EXPONE AL JUEGO (lo lee `scripts/core/DiscordBridge.gd` con JavaScriptBridge):
 *    window.CRO_DISCORD      → {en_discord, listo, app_id, instance_id, channel_id, guild_id, plataforma, error}
 *    window.CRO_ABRIR_ENLACE → abre un enlace externo de la forma correcta en cada entorno
 *
 *  LO QUE AÚN NO HACE (hace falta servidor): identificar al jugador con su cuenta de Discord. Eso es
 *  OAuth: `authorize` → canjear el código por un token EN EL SERVIDOR (lleva el client secret) →
 *  `authenticate`. Se hará al migrar go-server; hasta entonces el jugador entra con su cuenta del juego.
 * =========================================================================== */

(function () {
	"use strict";

	const params = new URLSearchParams(location.search);

	// Dentro de Discord la actividad se sirve desde <APP_ID>.discordsays.com y siempre llegan estos
	// parámetros. Se comprueban las dos cosas: el dominio es lo fiable, el `frame_id` cubre pruebas locales.
	const enDiscord = location.hostname.endsWith(".discordsays.com") || params.has("frame_id");

	// El ID de la aplicación es el subdominio: así no hay que escribirlo en ningún sitio (ni que se quede
	// desfasado si algún día cambia la app de Discord).
	const appId = enDiscord ? location.hostname.split(".")[0] : "";

	window.CRO_DISCORD = {
		en_discord: enDiscord,
		listo: false,
		app_id: appId,
		instance_id: params.get("instance_id") || "",
		channel_id: params.get("channel_id") || "",
		guild_id: params.get("guild_id") || "",
		plataforma: params.get("platform") || "",
		error: "",
	};

	// Abrir un enlace externo (Discord, itch, la web del juego).
	//  - En Discord: `window.open` está bloqueado; hay que pedírselo al SDK, que enseña su propio aviso
	//    de "vas a salir de Discord". Si el SDK no llegó a cargar, se intenta igualmente window.open.
	//  - Fuera de Discord (itch, navegador): una pestaña nueva de toda la vida.
	window.CRO_ABRIR_ENLACE = function (url) {
		const sdk = window.__cro_discord_sdk;
		if (sdk && window.CRO_DISCORD.listo) {
			sdk.commands.openExternalLink({ url: url }).catch(function () {
				window.open(url, "_blank", "noopener");
			});
			return;
		}
		window.open(url, "_blank", "noopener");
	};

	if (!enDiscord) {
		return; // itch o navegador normal: no se carga el SDK.
	}

	// El SDK es un módulo ES y se importa DINÁMICAMENTE: así solo se descarga dentro de Discord.
	// ⛔ Nunca desde una CDN: la actividad solo puede pedir su propio origen o dominios declarados en el
	// URL Mapping de la app. Por eso el fichero está copiado al lado (ver su cabecera).
	import("./discord-embedded-app-sdk.js")
		.then(function (mod) {
			const sdk = new mod.DiscordSDK(appId);
			// `ready()` es el saludo con el cliente de Discord: hasta que no se completa, los comandos
			// del SDK no funcionan. El juego NO espera a esto para arrancar.
			return sdk.ready().then(function () {
				window.__cro_discord_sdk = sdk;
				window.CRO_DISCORD.listo = true;
				window.CRO_DISCORD.instance_id = sdk.instanceId || window.CRO_DISCORD.instance_id;
				window.CRO_DISCORD.channel_id = sdk.channelId || window.CRO_DISCORD.channel_id;
				window.CRO_DISCORD.guild_id = sdk.guildId || window.CRO_DISCORD.guild_id;
				console.log("[Discord] Actividad lista (app " + appId + ")");
			});
		})
		.catch(function (e) {
			// Que falle el SDK NO puede impedir jugar: se anota y se sigue.
			window.CRO_DISCORD.error = String(e && e.message ? e.message : e);
			console.warn("[Discord] No se pudo iniciar el SDK:", e);
		});
})();
