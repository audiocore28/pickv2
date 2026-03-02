let games = [];
let selected = [];
let editIndex = null;

function loadGameList() {
	// SHOW loading
	document.getElementById("loading").style.display = "block";
	document.getElementById("games-container").style.display = "none";
	document.getElementById("sort").value = "new";
	renderGames();
	
	if (isAdmin) {
		document.getElementById("saveButton").style.display = "inline-block";
	}
	
	fetch(GOOGLE_SCRIPT_URL)
		.then(response => response.json())
		.then(data => {
			console.log(data.games); // ← Tingnan mo Console kung may pickCounter talaga
			games = (data.games || []).map(g => ({
				...g,
				is2Player:
				g.is2Player === true ||
				g.is2Player === "TRUE" ||
				g.is2Player === "Yes" ||
				g.is2Player === "yes",
				pickCounter: g.pickCounter || 0
			}));
			
			selected = [];
			
			;
			document.getElementById("sort").value = "new";
			setPlatformFilter('all');  // ✅ Auto-filter para hindi mo na i-click
		})
		.catch(error => {
			console.error("Error loading games:", error);
			alert("❌ Hindi ma-load ang games mula sa Google Sheet.");
		})
		.finally(() => {
			// HIDE loading, SHOW games container
			document.getElementById("loading").style.display = "none";
			document.getElementById("games-container").style.display = "grid";
		});
}

function selectAll() {
	const search = document.getElementById("search").value.toLowerCase();
	const platform = currentPlatform;
	
	selected = [];
	games.forEach((game, realIndex) => {
		const matchesSearch = game.name.toLowerCase().includes(search);
		const isBasic = game.platform === "ps2" || (game.platform === "pc" && game.size <= 15);
		const isTwoPlayer = game.is2Player === true;
		
		let matchesPlatform = false;
		if (platform === "all") matchesPlatform = true;
		else if (platform === "basic") matchesPlatform = isBasic;
		else if (platform === "2player") matchesPlatform = isTwoPlayer;
		else matchesPlatform = game.platform === platform;
		
		if (matchesSearch && matchesPlatform) {
			selected.push(realIndex);
		}
	});
	renderGames();
	updateCounter();  // ✅ ADD THIS PARA TOTAL SIZE GUMANA ULIT
	if (isAdmin) {
		document.getElementById("saveButton").style.display = "inline-block";
	}
}

function deselectAll() {
  selected = [];
  renderGames();
}

function renderGames() {
	const container = document.getElementById("games-container");
	container.innerHTML = "";
	const search = document.getElementById("search").value.toLowerCase();
	const sort = document.getElementById("sort").value;
	const platform = currentPlatform;
	
	// Keep the real index from games[]
	let filtered = [];
	games.forEach((game, realIndex) => {
		const matchesSearch = game.name.toLowerCase().includes(search);
		const isBasic = game.platform === "ps2" || (game.platform === "pc" && game.size <= 15);
		const isTwoPlayer = game.is2Player === true;
		
		let matchesPlatform = false;
		if (platform === "all") matchesPlatform = true;
		else if (platform === "basic") matchesPlatform = isBasic;
		else if (platform === "2player") matchesPlatform = isTwoPlayer;
		else matchesPlatform = game.platform === platform;
		
		if (matchesSearch && matchesPlatform) {
			filtered.push({ game, realIndex });
		}
	});
	
	if (sort === "name") {
		filtered.sort((a, b) => a.game.name.trim().localeCompare(b.game.name.trim(), undefined, { numeric: true, sensitivity: "base" }));
	} else if (sort === "new") {
		// no sorting, default
	} else if (sort === "sizeAsc") {
		filtered.sort((a, b) => a.game.size - b.game.size);
	} else if (sort === "sizeDesc") {
		filtered.sort((a, b) => b.game.size - a.game.size);
	} else if (sort === "mostPicked") {
		filtered.sort((a, b) => (b.game.pickCounter || 0) - (a.game.pickCounter || 0));
	} else if (sort === "leastPicked") {
		filtered.sort((a, b) => (a.game.pickCounter || 0) - (b.game.pickCounter || 0));
	}


	// Update available games count
	document.getElementById("gameCountNumber").innerText = filtered.length;

	filtered.forEach(({ game, realIndex }) => {
		const div = document.createElement("div");
		div.className = "game-card";
		div.onclick = () => toggleSelect(realIndex);
		div.innerHTML = `
				<span class="platform-icon">${game.platform.toUpperCase()}</span>
				<img src="${game.image}" width="100%" />
				<div><strong>${game.name}</strong></div>
				<div>${game.size} GB</div>
				<div style="font-size:11px; color:orange;">
					🔥 Picked ${game.pickCounter || 0} times
				</div>
				${game.note1 ? `<div class="note-pill note-danger">⚠️ ${game.note1}</div>` : ""}
				${game.note2 ? `<div class="note-pill note-success">✔️ ${game.note2}</div>` : ""}
				<div style="font-size:11px;color:gold;">${game.is2Player ? "🎮 2 Player" : ""}</div>
				<button class="edit-btn" onclick="editGame(event, ${realIndex})">✏️ Edit</button>
				<button class="remove-btn" onclick="removeGame(event, ${realIndex})">❌</button>
			`;
		if (selected.includes(realIndex)) div.classList.add("selected");
		if (isAdmin) {
			div.querySelector(".remove-btn").style.display = "block";
			div.querySelector(".edit-btn").style.display = "block";
		}
		container.appendChild(div);
	});

	updateCounter();
	renderTopPicks();
}

function toggleSelect(index) {
	const maxCap = parseFloat(document.getElementById("capacitySelect").value);
	const gameSize = games[index].size;
	
	// If already selected → allow deselect always
	if (selected.includes(index)) {
		selected = selected.filter(i => i !== index);
		renderGames();
		return;
	}
	
	// Compute current total
	let currentTotal = selected.reduce((sum, i) => sum + games[i].size, 0);
	
	// Block if exceeds capacity
	if (currentTotal + gameSize > maxCap) {
		document.getElementById("popupDetails").innerText = `Cannot add this game.\nSelected: ${currentTotal.toFixed(1)} GB / Limit: ${maxCap} GB`;
		const popup = document.getElementById("capacityPopup");
		popup.style.display = "block";
		popup.classList.remove("shake");
		void popup.offsetWidth; // reset animation
		popup.classList.add("shake");
		return;
	}
	
	// Safe to add
	selected.push(index);
	renderGames();
}

function updateCounter() {
	const maxCap = parseFloat(document.getElementById("capacitySelect").value);
	let total = selected.reduce((sum, i) => sum + games[i].size, 0);
	
	document.getElementById("totalSize").innerText = total.toFixed(1);
	document.getElementById("totalSizeFloating").innerText = total.toFixed(1);
	document.getElementById("totalSelectedFloating").innerText = selected.length;
	
	const warningEl = document.getElementById("capacityWarning");
	
	if (total > maxCap) {
		warningEl.innerText = "⚠️ Capacity limit exceeded!";
		document.getElementById("popupDetails").innerText =
		`Selected: ${total.toFixed(1)} GB / Limit: ${maxCap} GB`;
		document.getElementById("capacityPopup").style.display = "block";
	} else {
		warningEl.innerText = "";
		document.getElementById("capacityPopup").style.display = "none";
	}
}

function formatNote(note, type) {
	if (!note) return "";
	
	// type = "note1" or "note2"
	if (type === "note1") {
		return ` <span style="color:#e53935; font-weight:bold;">⚠️ ${note}</span>`;
	}
	
	if (type === "note2") {
		return ` <span style="color:#2e7d32; font-weight:bold;">✔️ ${note}</span>`;
	}
	
	return "";
}

function viewList() {
	const grouped = {};
	const sharedNotes = {}; // for PS3 + SWITCH only
	
	selected.forEach(i => {
		const game = games[i];
		
		if (!grouped[game.platform]) {
			grouped[game.platform] = [];
		}
		
		// ✅ PC = individual notes
		if (game.platform === "pc") {
			grouped[game.platform].push(
				`• ${game.name} (${game.size} GB)
         ${game.note1 ? `<br><span style="color:#e53935;font-weight:bold;">⚠️ ${game.note1}</span>` : ""}
         ${game.note2 ? `<br><span style="color:#2e7d32;font-weight:bold;">✔️ ${game.note2}</span>` : ""}`
			);
		} else {
			// PS3 / SWITCH / OTHERS → list only
			grouped[game.platform].push(
				`• ${game.name} (${game.size} GB)`
			);
			
			// ✅ shared notes only for non-PC
			if (!sharedNotes[game.platform]) {
				sharedNotes[game.platform] = {
					note1: game.note1 || "",
					note2: game.note2 || ""
				};
			}
		}
	});
	
	let html = "<h3>🧾 Selected Game List:</h3>";
	
	for (let platform in grouped) {
		html += `<strong>${platform.toUpperCase()} GAMES:</strong><br/>`;
		html += grouped[platform].join("<br/>") + "<br/>";
		
		// ✅ SHOW SHARED NOTES ONLY FOR NON-PC
		if (platform !== "pc" && sharedNotes[platform]) {
			if (sharedNotes[platform].note1) {
				html += `<div style="color:#e53935;font-weight:bold;margin-top:6px;">
          ⚠️ ${sharedNotes[platform].note1}
        </div>`;
			}
			if (sharedNotes[platform].note2) {
				html += `<div style="color:#2e7d32;font-weight:bold;margin-top:4px;">
          ✔️ ${sharedNotes[platform].note2}
        </div>`;
			}
		}
		
		html += "<br/>";
	}
	
	let total = selected.reduce((sum, i) => sum + games[i].size, 0);
	
	html += `
    <strong>TOTAL SIZE:</strong> ${total.toFixed(1)} GB<br>
    <strong>TOTAL GAMES:</strong> ${selected.length}
  `;
	
	document.getElementById("viewListContent").innerHTML = html;
	document.getElementById("viewListModal").style.display = "block";
	
	incrementPickCounter();
}


function addGame() {
	const name = document.getElementById("gameName").value;
	const size = parseFloat(document.getElementById("gameSize").value);
	const platform = document.getElementById("gamePlatform").value;
	const image = document.getElementById("gameImage").value;
	const note1 = document.getElementById("gameNote1").value || "";
	const note2 = document.getElementById("gameNote2").value || "";
	const is2Player = document.getElementById("game2Player").checked;
	if (!name || !size || !platform || !image) return alert("Fill all fields.");
	const newGame = { name, size, platform, image, note1, note2, is2Player };
	document.getElementById("gameName").value = "";
	document.getElementById("gameSize").value = "";
	document.getElementById("gamePlatform").value = "pc";
	document.getElementById("gameImage").value = "";
	document.getElementById("gameNote1").value = "";
	document.getElementById("gameNote2").value = "";
	document.getElementById("game2Player").checked = false;
	
	
	if (editIndex !== null) {
		games[editIndex] = newGame;
		editIndex = null;
	} else {
		games.unshift(newGame);
	}
	renderGames();
}

function editGame(event, index) {
	event.stopPropagation();
	const g = games[index];
	document.getElementById("gameName").value = g.name;
	document.getElementById("gameSize").value = g.size;
	document.getElementById("gamePlatform").value = g.platform;
	document.getElementById("gameImage").value = g.image;
	document.getElementById("gameNote1").value = g.note1 || "";
	document.getElementById("gameNote2").value = g.note2 || "";
	document.getElementById("game2Player").checked = g.is2Player ? true : false;
	editIndex = index;
}

function removeGame(event, index) {
	event.stopPropagation();
	games.splice(index, 1);
	selected = selected.filter(i => i !== index);
	renderGames();
}

function saveGameList() {
	if (!isAdmin) {
		alert("🚫 Only Admin can save the list.");
		return;
	}
	
	fetch(GOOGLE_SCRIPT_URL, {
		method: "POST",
		mode: "no-cors",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ games })
	})
	.then(() => {
		alert("✅ Na-save na ang game list sa Google Sheet!");
	})
	.catch((error) => {
		console.error("Error saving to Google Sheets:", error);
		alert("❌ Hindi na-save ang game list.");
	});
}


function downloadList() {
	const grouped = {};
	selected.forEach(i => {
		const g = games[i];
		if (!grouped[g.platform]) grouped[g.platform] = [];
		grouped[g.platform].push(`• ${g.name} (${g.size} GB)${g.note1 ? " - " + g.note1 : ""}${g.note2 ? " - " + g.note2 : ""}`);
	});
	
	let text = "Game List:\n\n";
	for (let platform in grouped) {
		text += `${platform.toUpperCase()} GAMES:\n`;
		text += grouped[platform].join("\n") + "\n\n";
	}
	
	// Compute total
	let total = selected.reduce((sum, i) => sum + games[i].size, 0);
	text += `TOTAL SIZE: ${total.toFixed(1)} GB\n`;
	
	const blob = new Blob([text], { type: "text/plain" });
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = "game-list.txt";
	link.click();
	
	incrementPickCounter(); // 🔴 ← Auto update pick counter sa Google Sheets
}

function closeViewList() {
	document.getElementById("viewListModal").style.display = "none";
}

let currentPlatform = "all";

function setPlatformFilter(value) {
	currentPlatform = value;
	
	// Highlight active button
	document.querySelectorAll("#platformFilters button").forEach(btn => {
		btn.classList.remove("active");
		if (btn.getAttribute("onclick").includes(`'${value}'`)) {
			btn.classList.add("active");
		}
	});
	
	renderGames();
}

function incrementPickCounter() {
	const selectedNames = selected.map(i => games[i].name);
	fetch(GOOGLE_SCRIPT_URL, {
		method: "POST",
		body: JSON.stringify({ selectedNames })
	})
	.then(() => {
		console.log("Pick counter updated");
	})
	.catch((err) => {
		console.error("Failed to update pick counter:", err);
	});
}

function renderTopPicks() {
	const sorted = [...games].sort((a, b) => (b.pickCounter || 0) - (a.pickCounter || 0));
	const top10 = sorted.filter(g => g.pickCounter > 0).slice(0, 10);
	
	const listEl = document.getElementById("topPicksList");
	listEl.innerHTML = "";
	
	if (top10.length === 0) {
		listEl.innerHTML = "<li style='color:#999;'>No picks yet.</li>";
		return;
	}
	
	top10.forEach((g, index) => {
		const li = document.createElement("li");
		li.innerHTML = `${index + 1}. ${g.name} <span style="color:yellow;">(${g.pickCounter || 0} picks)</span>`;
		listEl.appendChild(li);
	});
}

loadGameList();

if (isAdmin) {
	document.getElementById("admin-panel").style.display = "block";
	document.getElementById("saveButton").style.display = "inline-block";
}
  