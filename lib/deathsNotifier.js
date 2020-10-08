module.exports = function PartyDeathsNotifier(mod) {
	mod.game.initialize("me");
	mod.game.initialize("party");
	
	let placedMarkers = new Set();

	// eslint-disable-next-line no-undef
	const getUniqId = (event) => (BigInt(event.serverId) << 32n) | BigInt(event.playerId);

	const sendDespawnDropItem = (gameId) => {
		mod.send("S_DESPAWN_DROPITEM", 4, {
			"gameId": gameId
		});
	};

	const sendSpawnDropItem = (gameId, loc, itemId, expiry = 99999) => {
		mod.send("S_SPAWN_DROPITEM", mod.majorPatchVersion >= 99 ? 9 : 8, {
			"gameId": gameId,
			"loc": loc,
			"item": itemId,
			"amount": 1,
			"expiry": expiry
		});
	};

	const getItem = (gameClass) => {
		switch (gameClass) {
		case 1:
		case 10:
			return mod.settings.beamsStyle.tank;
		case 6:
		case 7:
			return mod.settings.beamsStyle.healer;
		default:
			return mod.settings.beamsStyle.default;
		}
	};

	const tryRemoveHighlight = (event) => {
		const uniqId = getUniqId(event);
		if (!placedMarkers.has(uniqId)) return;
		sendDespawnDropItem(uniqId);
		placedMarkers.delete(uniqId);
	};

	const tryHighlightTarget = (event) => {
		if(!mod.settings.enabled) return;
		const itemId = getItem(mod.settings.classBasedBeams ? event.class : -1);
		const uniqId = getUniqId(event);

		tryRemoveHighlight(event);

		let itemPlacementLoc = event.loc.clone();
		itemPlacementLoc.z = itemPlacementLoc.z - 35;
		sendSpawnDropItem(uniqId, itemPlacementLoc, itemId);
		placedMarkers.add(uniqId);
	};

	const cleanup = () => {
		placedMarkers.forEach(key => { sendDespawnDropItem(key); });
		placedMarkers.clear();
	};

	mod.game.on("enter_game", cleanup);
	mod.game.on("leave_game", cleanup);
	mod.game.on("enter_loading_screen", cleanup);

	mod.game.party.on("leave", cleanup);
	mod.game.party.on("member_kick", event => { tryRemoveHighlight(event); });
	mod.game.party.on("member_leave", event => { tryRemoveHighlight(event); });

	mod.hook("S_PARTY_MEMBER_STAT_UPDATE", 3, event => {
		if (event.alive) tryRemoveHighlight(event);
	});

	mod.hook("S_DEAD_LOCATION", 2, event => {
		if (!mod.game.party.inParty()) return;

		let member = mod.game.party.getMemberData(event.gameId);
		if (member) tryHighlightTarget({ "loc": event.loc, "playerId": member.playerId, "serverId": member.serverId, "class": member.class });
	});

	mod.hook("S_SPAWN_USER", mod.majorPatchVersion >= 99 ? 16 : 15, event => {
		if (!mod.game.party.inParty()) return;

		let member = mod.game.party.getMemberData(event.gameId);
		if (!event.alive && member) tryHighlightTarget({ "loc": event.loc, "playerId": event.playerId, "serverId": event.serverId, "class": member.class });
	});

	mod.hook("S_DESPAWN_USER", 3, event => {
		if (event.type === 1 || !mod.game.party.inParty()) return;

		let member = mod.game.party.getMemberData(event.gameId);
		if (member) tryRemoveHighlight(member);
	});

	mod.command.add("pdn", {
		$none() { 
			mod.settings.enabled = !mod.settings.enabled;
			mod.command.message(`Marking new targets were ${mod.settings.enabled ? "en" : "dis"}abled`);
		},
		clear() {
			cleanup();
			mod.command.message("All beams were forcefully removed!");
		},
		class() {
			mod.settings.classBasedBeams = !mod.settings.classBasedBeams;
			mod.command.message(`Class based beams were ${mod.settings.classBasedBeams ? "en" : "dis"}abled`);
		}
	}, this);
};