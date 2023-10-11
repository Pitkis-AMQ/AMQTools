// ==UserScript==
// @name         AMQ Tools
// @version      0.1
// @description  AMQ related functionalities using TheJoseph98 scripts as the starting point. Includes song list window for battle royale and counter for songs from players' lists in results window
// @author       Pitkis-AMQ
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqWindows.js
// ==/UserScript==

// don't load on login page
if (document.getElementById("startPage")) return;

// Wait until the LOADING... screen is hidden and load script
let loadInterval = setInterval(() => {
    if (document.getElementById("loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

// Song List window related functionality
let listWindow;
let listWindowTable;
let listWindowTabs;
let listWindowSongTab;
let listWindowStatsTab;
let statWindowTable;
let quizReadySongListTracker;
let joinLobbyListener;
let answerResultsSongTracker;
let quizOverListener;
let quizStartingTracker;
let nextVideoListener;
let gameMode;

// Song counter functionality related stuff
let playerData = {};
let scoreboardReady = false;
let playerDataReady = false;
let quizReadyCountSongsTracker;
let answerResultsCountSongsTracker;
let quizEndCountSongsTracker;
let returnToLobbyVoteCountSongsListener;
let spectateLobbyListener;

// Stats related stuff
let stats = localStorage['AMQStats'] ? JSON.parse(localStorage['AMQStats']) : [];

// data for the checkboxes
let settingsData = [
    {
        containerId: "smSongCounterSettings",
        title: "Song Counter Settings",
        data: [
            {
                label: "Show Counter in Results",
                id: "smSongCounter",
                popover: "Enables or disabled song counts for players in results section",
                enables: ["smPrintCountsToChat"],
				type: "checkbox",
                offset: 0,
                default: true
            },
            {
                label: "Write song counts to chat",
                id: "smPrintCountsToChat",
                popover: "Writes song counts and missed counts to chat after game",
				type: "checkbox",
                offset: 1,
                default: true
            }
        ]
    },
    {
        containerId: "smTagRandomSettings",
        title: "Random Tags Count",
        data: [
            {
                label: "Number of Tags",
                id: "smTagRandomCount",
                popover: "Select the number of tags to be randomized",
				type: "text",
                offset: 0,
                default: "30"
            }
        ]
    },
    {
        containerId: "smStatSettings",
        title: "Stat Collection",
        data: [
            {
                label: "Collect Stats",
                id: "smCollectStats",
                popover: "Collects stats and updates them to local memory",
				type: "checkbox",
                offset: 0,
                default: true
            },
            {
                label: "Use English Names",
                id: "smEnglishNames",
                popover: "Shows anime names in English",
				type: "checkbox",
                offset: 0,
                default: false
            }
        ]
    }
];


// Create the "Script" tab in settings
$("#settingModal .tabContainer")
    .append($("<div></div>")
        .addClass("tab leftRightButtonTop clickAble")
        .attr("onClick", "options.selectTab('settingsCustomContainer', this)")
        .append($("<h5></h5>")
            .text("Script")
        )
    );

// Create the body base
$("#settingModal .modal-body")
    .append($("<div></div>")
        .attr("id", "settingsCustomContainer")
        .addClass("settingContentContainer hide")
        .append($("<div></div>")
            .addClass("row")
        )
    );


// Create the checkboxes
for (let setting of settingsData) {
    $("#settingsCustomContainer > .row")
        .append($("<div></div>")
            .addClass("col-xs-6")
            .attr("id", setting.containerId)
            .append($("<div></div>")
                .attr("style", "text-align: center")
                .append($("<label></label>")
                    .text(setting.title)
                )
            )
        );
    for (let data of setting.data) {
        $("#" + setting.containerId)
            .append($("<div></div>")
                .addClass("customSettingContainer")
                .addClass(data.offset !== 0 ? "offset" + data.offset : "")
                .addClass(data.offset !== 0 ? "disabled" : "")
                .append($("<div></div>")
                    .addClass("customCheckbox")
                    .append($("<input id='" + data.id + "' type='"+data.type+"'" + (data.type !== "checkbox" ? " size='2'" : "") +">")
                        .prop((data.type !== "checkbox" ? "value" : "checked"), data.default !== undefined ? data.default : false)
                    )
                    .append($("<label for='" + data.id + "'><i class='fa fa-check' aria-hidden='true'></i></label>"))
                )
                .append($("<label></label>")
                    .addClass(data.type !== "checkbox" ? "customSettingContainerTextLabel" : "customSettingContainerLabel")
                    .text(data.label)
                )
            );
        if (data.popover !== undefined) {
            $("#" + data.id).parent().parent().find("label:contains(" + data.label + ")")
                .attr("data-toggle", "popover")
                .attr("data-content", data.popover)
                .attr("data-trigger", "hover")
                .attr("data-html", "true")
                .attr("data-placement", "top")
                .attr("data-container", "#settingModal")
        }
    }
}

// Update the enabled and checked checkboxes
for (let setting of settingsData) {
    for (let data of setting.data) {
        updateEnabled(data.id);
        $("#" + data.id).click(function () {
            updateEnabled(data.id);
            if (data.unchecks !== undefined) {
                data.unchecks.forEach((settingId) => {
                    if ($(this).prop("checked")) {
                        $("#" + settingId).prop("checked", false);
                    }
                    else {
                        $(this).prop("checked", true);
                    }
                })
            }
        });
    }
}

// Updates the enabled checkboxes, checks each node recursively
function updateEnabled(settingId) {
    let current;
    settingsData.some((setting) => {
        current = setting.data.find((data) => {
            return data.id === settingId;
        });
        return current !== undefined;
    });
    if (current === undefined) {
        return;
    }
    if (current.enables === undefined) {
        return;
    }
    else {
        for (let enableId of current.enables) {
            if ($("#" + current.id).prop("checked") && !$("#" + current.id).parent().parent().hasClass("disabled")) {
                $("#" + enableId).parent().parent().removeClass("disabled");
            }
            else {
                $("#" + enableId).parent().parent().addClass("disabled");
            }
            updateEnabled(enableId);
        }
    }
}

// Functional things for the script
function setup() {
    options.$SETTING_TABS = $("#settingModal .tab");
    options.$SETTING_CONTAINERS = $(".settingContentContainer");
    // Initialize window
    listWindow = new AMQWindow({
        title: "Song List",
        width: 460,
        height: 800,
        minWidth: 200,
        minHeight: 200,
        zIndex: 1060,
        resizable: true,
        draggable: true,
        position: {x:1800,y:0}
    });
    listWindow.addPanel({
        id: "listWindowSongs",
        width: 1.0,
        height: 1.0,
        scrollable: {x: false, y: true}
    });

	listWindowTabs = $(`<div class="tab"> <button class="tablinks" onclick="document.getElementById('Songs').style.display='block';document.getElementById('Stats').style.display='none'" id="defaultOpen">Songs</button> <button class="tablinks" onclick="document.getElementById('Songs').style.display='none';document.getElementById('Stats').style.display='block'">Stats</button> </div>`);

    // Create song table
    listWindowTable = $(`<table id="listWindowTable" class="table" style='font-size:120%'></table>`);
	statWindowTable = $(`<table id="statWindowTable" class="table" style='font-size:120%'></table>`);
	listWindowSongTab = $(`<div id="Songs" class="tabcontent"></div>`);
	listWindowSongTab.append(listWindowTable);
	listWindowStatsTab = $(`<div id="Stats" class="tabcontent"></div>`);
	listWindowStatsTab.append(statWindowTable);
	listWindowTabs.append(listWindowSongTab);
	listWindowTabs.append(listWindowStatsTab);
    listWindow.panels[0].panel.append(listWindowTabs);
    document.getElementById("defaultOpen").click();
    statWindowTable.children().remove();
	initialiseStatList();

    const buttonFn = (buttonId, buttonClass) => `<button id="${buttonId}" class="button floatingContainer" type="button" color="black" style="margin: 5px 0px 5px 10px"><i aria-hidden="true" class="fa ${buttonClass}"></i></button>`;
    listWindow.panels[0].panel
        .append($(buttonFn('slChat', 'fa-commenting')) // Button to post list to chat
            .click(() => {
                writeListToChat();
            })
        )
		.append($(buttonFn('slRandomTags', 'fa-random')) // Button to generate random tags
            .click(() => {
                randomizeTags();
            })
        )
        .append($(buttonFn('amqtSortButton', 'fa-sort-numeric-asc')) // button to sort the song list
            .click(() => {
                AMQToolsSortSongs();
            })
        );
    // Turn on/off with "Pause/Break" button
    $(document.documentElement).keydown(function (event) {
        if (event.which === 19) {
            if (listWindow.isVisible()) {
                listWindow.close();
            }
            else {
                listWindow.open();
            }
        }
    });
    // Check the game mode
	quizStartingTracker = new Listener("Game Starting", (data) => {
		gameMode = data.showSelection;
	});
    quizStartingTracker.bindListener();
    // Initialize song list at game start and set visible
    quizReadySongListTracker = new Listener("quiz ready", (data) => {
        if (gameMode === 2) {
            listWindowTable.children().remove();
            initialiseSongList();
            listWindow.open();
        }
		// Update stats at start of game
        statWindowTable.children().remove();
		initialiseStatList();
        joinLobbyListener.bindListener();
        answerResultsSongTracker.bindListener();
    });
    quizReadySongListTracker.bindListener();
	// Close window when quiz ends
    quizOverListener = new Listener("quiz over", (roomSettings) => {
        listWindow.close();
		//push stats to local storage
		if ($("#smCollectStats").prop("checked")) {
			localStorage.setItem('AMQStats', JSON.stringify(stats));
		}
    });
    quizOverListener.bindListener()
    // Close window when returning back to lobby
    joinLobbyListener = new Listener("Join Game", (payload) => {
        listWindowTable.children().remove();
        listWindow.close();
		//push stats to local storage
		if ($("#smCollectStats").prop("checked")) {
			localStorage.setItem('AMQStats', JSON.stringify(stats));
		}
    });
    // Mark the row if it was the correct answer and update stats
    answerResultsSongTracker = new Listener("answer results", (result) => {
        var x = document.getElementById('listWindowTable').getElementsByTagName('td');
        var y = result.songInfo.animeNames.romaji;
        var z = result.songInfo.animeNames.english;
        for(let i = 0; i < x.length; i++) {
            if (x[i].innerText === y || x[i].innerText === z) {
                x[i].style.backgroundColor = '#A9A9A9';
            }
        }
		if ($("#smCollectStats").prop("checked")) {
			stats.find(o => o.romaji === y ? o.count += 1:"") ? "" : stats.push({"romaji":y,"english":z,"count":1});
		}
    });
	// Listeners related to tracking the number of songs and missed songs from players
	quizReadyCountSongsTracker = new Listener("quiz ready", (data) => {
		initialiseScoreboard();
		initialisePlayerData();
		answerResultsCountSongsTracker.bindListener();
		// only if printing is enabled
        if ($("#smPrintCountsToChat").prop("checked")) {
			quizEndCountSongsTracker.bindListener();
		} else {
			quizEndCountSongsTracker.unbindListener();
		}
		returnToLobbyVoteCountSongsListener.bindListener();
        spectateLobbyListener.bindListener();
    });
    if ($("#smSongCounter").prop("checked")) {
        quizReadyCountSongsTracker.bindListener();
    } else {
        quizReadyCountSongsTracker.unbindListener();
    }
	// update song counts after each result
	answerResultsCountSongsTracker = new Listener("answer results", (result) => {
		if (playerDataReady) {
            for (let player of result.players) {
                if (player.looted) {
                    playerData[player.gamePlayerId].looted++;
                    if (player.correct === false) {
                        playerData[player.gamePlayerId].missedLoot++;
                    }
                }
                if (player.listStatus !== null && player.listStatus !== undefined && player.listStatus !== false && player.listStatus !== 0) {
                    playerData[player.gamePlayerId].songs++;
                    if (player.correct === false) {
                        playerData[player.gamePlayerId].missedList++;
                    }
                }
                if (player.correct === true) {
                    playerData[player.gamePlayerId].score++;
                }
            }
            if (scoreboardReady) {
                updateScoreboard();
            }
        }
	});
	// print missed song counts at the end of the game
	quizEndCountSongsTracker = new Listener("quiz end result", (result) => {
		missedListToChat();
	});
	// Reset data when spectating a lobby
	returnToLobbyVoteCountSongsListener = new Listener("Join Game", (payload) => {
        clearPlayerData();
        clearScoreboard();
    });
	// Reset data when spectating a lobby
    spectateLobbyListener = new Listener("Spectate Game", (payload) => {
        clearPlayerData();
        clearScoreboard();
    });
	// CSS stuff for the song counter
	AMQ_addStyle(`
		.qpsPlayerSongCounter {
			padding-right: 5px;
			opacity: 0.3;
		}
        .qpsPlayerLootCounter {
            padding-right: 5px;
            opacity: 0.3;
            color: #FF9A16;
        }
        .customSettingContainer {
            display: flex;
        }
        .customSettingContainer > div {
            display: inline-block;
            margin: 5px 0px;
        }
        .customSettingContainer > .customCheckbox {
            color: #000;
        }
        .customSettingContainer > .customSettingContainerLabel {
            margin-left: 5px;
            margin-top: 5px;
            font-weight: normal;
        }
        .customSettingContainer > .customSettingContainerTextLabel {
            margin-left: 35px;
            margin-top: 5px;
            font-weight: normal;
        }
        .offset1 {
            margin-left: 20px;
        }
        .offset2 {
            margin-left: 40px;
        }
        .offset3 {
            margin-left: 60px;
        }
        .offset4 {
            margin-left: 80px;
        }
        .tabcontent {
            display: none;
        }
        .tablinks {
            color: #000;
        }
    `);
}
function initialiseSongList() {
    for (let [idx, item] of Array.from(document.getElementById('brCollectionContainer').getElementsByTagName('li')).entries()) {
        let newRow = $(`<tr class="songData clickAble"></tr>`)
        .data('pickuporder', idx)
        .click(function () {
            let answer = $(this)[0].textContent;
            document.getElementById("qpAnswerInput").value = answer;
            document.getElementById('qpAnswerInput').dispatchEvent(new KeyboardEvent('keypress', { keyCode: 13 }));
        });
        let songName = $(`<td class="songName" style="padding: 5px 5px 0px 10px;"></td>`).text(item.innerText.substr(2));
        newRow.append(songName);
        listWindowTable.append(newRow);
    };
}

function initialiseStatList() {
	// sort stats
	stats.sort(function(a,b) {
		return b.count-a.count
	});
    for (let item of stats) {
        let newRow = $(`<tr class="songData clickAble"></tr>`)
        .click(function () {
            let answer = $(this)[0].textContent;
            document.getElementById("qpAnswerInput").value = answer;
            document.getElementById('qpAnswerInput').dispatchEvent(new KeyboardEvent('keypress', { keyCode: 13 }));
        });
        let animeName = $(`<td class="songName" style="padding: 5px 5px 0px 10px;"></td>`).text($("#smEnglishNames").prop("checked") ? item.english : item.romaji);
		let animeCount = $(`<td class="count" style="padding: 5px 25px 0px 0px;"></td>`).text(item.count);
        newRow.append(animeName);
		newRow.append(animeCount);
        statWindowTable.append(newRow);
    };
}

// Sort song list based on current state of the sort button
function AMQToolsSortSongs() {

    const sorts = [
        {
            buttonClass: "fa-sort-numeric-asc",
            comparator: (a,b) => $(a).data("pickuporder") > $(b).data("pickuporder")
        },
        {
            buttonClass: "fa-sort-numeric-desc",
            comparator: (a,b) => $(a).data("pickuporder") < $(b).data("pickuporder")
        },
        {
            buttonClass: "fa-sort-alpha-asc",
            comparator: (a,b) => $(a).text() > $(b).text()
        },
        {
            buttonClass: "fa-sort-alpha-desc",
            comparator: (a,b) => $(a).text() < $(b).text()
        }
    ];

    // The button contains the <i> element with the font-awesome class we're interested in
    let sortIcon = $('#amqtSortButton').children()[0];

    let currSortIdx = sorts.findIndex(x => $(sortIcon).hasClass(x.buttonClass));
    let nextSort = sorts[(currSortIdx+1)%4];

    listWindowTable.children().sort(nextSort.comparator).appendTo(listWindowTable);
    $(sortIcon).removeClass(sorts[currSortIdx].buttonClass).addClass(nextSort.buttonClass);

}

// Write list to chat in 5 song blocks to fit chat well (cap to 150 char)
function writeListToChat() {
    let message = "";
    let x = document.getElementById('listWindowTable').getElementsByTagName('td');
    for(let i = 0; i < x.length; i++) {
		let temp = message + "; " + x[i].innerText;
		if (temp.length > 152) {
			gameChat.$chatInputField.val(message.substr(2));
            gameChat.sendMessage();
            message = "; " + x[i].innerText;
		} else {
			message += "; " + x[i].innerText;
		}
    }
    // leftover message after loop
    if (message != "") {
        gameChat.$chatInputField.val(message.substr(2));
        gameChat.sendMessage();
    }
}
// Randomize tags and write to chat
function randomizeTags() {
	let poolSize = $("#smTagRandomCount").prop("value");
	let chosenTags = "";
	// If update is needed, tags reside in document.getElementById('mhTagFilter').getElementsByTagName('li') in innerText in game setup
	let tags = ["4-koma","4k","Achromatic","Achronological Order","Acting","Adoption","Advertisement","Afterlife","Age Gap","Age Regression","Agriculture","Airsoft","Aliens","Alternate Universe","American Football","Amnesia","Anachronism","Angels","Animals","Anthology","Anti-Hero","Archery","Artificial Intelligence","Asexual","Assassins","Astronomy","Athletics","Augmented Reality","Autobiographical","Aviation","Badminton","Band","Bar","Baseball","Basketball","Battle Royale","Biographical","Bisexual","Body Horror","Body Swapping","Boxing","Bullying","Butler","Calligraphy","Cannibalism","Card Battle","Cars","Centaur","CGI","Cheerleading","Chibi","Chimera","Chuunibyou","Circus","Classic Literature","College","Coming of Age","Conspiracy","Cosmic Horror","Cosplay","Crime","Crossdressing","Crossover","Cult","Cultivation","Cute Boys Doing Cute Things","Cute Girls Doing Cute Things","Cyberpunk","Cyborg","Cycling","Dancing","Death Game","Delinquents","Demons","Denpa","Detective","Development","Dinosaurs","Disability","Dragons","Drawing","Drugs","Dullahan","Dungeon","Dystopian","E-Sports","Economics","Educational","Elf","Ensemble Cast","Environmental","Episodic","Ero Guro","Espionage","Fairy Tale","Family Life","Fashion","Female Protagonist","Fencing","Firefighters","Fishing","Fitness","Flash","Food","Football","Foreign","Fugitive","Full CGI","Full Colour","Gambling","Gangs","Gender Bending","Gender Neutral","Ghost","Go","Goblin","Gods","Golf","Gore","Guns","Gyaru","Harem","Henshin","Heterosexual","Hikikomori","Historical","Ice Skating","Idol","Isekai","Iyashikei","Josei","Judo","Kaiju","Karuta","Kemonomimi","Kids","Kuudere","Lacrosse","Language Barrier","LGBTQ Issues","Lost Civilisation","Love Triangle","Mafia","Magic","Mahjong","Maids","Make-up","Male Protagonist","Martial Arts","Masturbating","Medicine","Memory Manipulation","Mermaid","Meta","Miko","Military","Monster Boy","Monster Girl","Mopeds","Motorcycles","Multiple Personalities","Musical","Mythology","Necromancy","Nekomimi","Ninja","No Dialogue","Noir","Nudity","Nun","Office Lady","Oiran","Ojou-sama","Otaku Culture","Outdoor","Pandemic","Parkour","Parody","Philosophy","Photography","Pirates","Poker","Police","Politics","Post-Apocalyptic","POV","Primarily Adult Cast","Primarily Child Cast","Primarily Female Cast","Primarily Male Cast","Primarily Teen Cast","Puppetry","Rakugo","Real Robot","Rehabilitation","Reincarnation","Religion","Revenge","Reverse Harem","Robots","Rotoscoping","Rugby","Rural","Samurai","Satire","School","School Club","Scuba Diving","Seinen","Shapeshifting","Ships","Shogi","Shoujo","Shoujo Ai","Shounen","Shounen Ai","Skateboarding","Skeleton","Slapstick","Slavery","Space","Space Opera","Steampunk","Stop Motion","Succubus","Suicide","Sumo","Super Power","Super Robot","Superhero","Surfing","Surreal Comedy","Survival","Swimming","Swordplay","Table Tennis","Tada Banri","Tanks","Tanned Skin","Teacher","Teens Love","Tennis","Terrorism","Time Manipulation","Time Skip","Tokusatsu","Tomboy","Torture","Tragedy","Trains","Transgender","Triads","Tsundere","Twins","Urban","Urban Fantasy","Vampire","Video Games","Vikings","Villainess","Virtual World","Volleyball","VTuber","War","Werewolf","Witch","Work","Wrestling","Writing","Wuxia","Yakuza","Yandere","Yaoi","Youkai","Yuri","Zombie"];
	for (let i = 0; i < poolSize; i++) {
		let temp = chosenTags + "; " + tags[Math.floor(Math.random() * tags.length)];
		//in case tags get too long to post
		if (temp.length > 152) {
			gameChat.$chatInputField.val(chosenTags.substr(2));
			gameChat.sendMessage();
			chosenTags = "; " + tags[Math.floor(Math.random() * tags.length)];
		} else {
			chosenTags += "; " + tags[Math.floor(Math.random() * tags.length)];
		}
	}
    // leftover chosenTags after loop
    if (chosenTags != "") {
        gameChat.$chatInputField.val(chosenTags.substr(2));
        gameChat.sendMessage();
    }
}
// Supporting functions for counting the songs from players
// Creates the song counters on the scoreboard and sets them to 0
function initialiseScoreboard() {
    clearScoreboard();
    for (let entryId in quiz.scoreboard.playerEntries) {
        let tmp = quiz.scoreboard.playerEntries[entryId];
        let counter = $(`<span class="qpsPlayerSongCounter">0</span><span class="qpsPlayerLootCounter">0</span>`);
        tmp.$entry.find(".qpsPlayerName").before(counter);
    }
    scoreboardReady = true;
}
// Clears the song counts from scoreboard
function clearScoreboard() {
    $(".qpsPlayerSongCounter").remove();
    scoreboardReady = false;
}
// Creates the player data for counting songs (and score)
function initialisePlayerData() {
    clearPlayerData();
    for (let entryId in quiz.players) {
         playerData[entryId] = {
             songs: 0,
             looted: 0,
             score: 0,
             missedList: 0,
             missedLoot: 0,
             name: quiz.players[entryId]._name
         };
    }
    playerDataReady = true;
}
// Clears player data
function clearPlayerData() {
    playerData = {};
    playerDataReady = false;
}
// updates the current song count to scoreboard
function updateScoreboard() {
    if (playerDataReady) {
        for (let entryId in quiz.scoreboard.playerEntries) {
            let entry = quiz.scoreboard.playerEntries[entryId];
            let songCounter = entry.$entry.find(".qpsPlayerSongCounter");
            songCounter.text(playerData[entryId].songs);
            let lootCounter = entry.$entry.find(".qpsPlayerLootCounter");
            lootCounter.text(playerData[entryId].looted);
        }
    }
}
// print stats after game if showMissed is true
function missedListToChat() {
	for (let id in playerData) {
		gameChat.systemMessage(`${playerData[id].name + " missed " + playerData[id].missedLoot + " / " + playerData[id].looted + " from looted, " + playerData[id].missedList + " / " + playerData[id].songs} from list.`);
	}
}
// CSS for the song counter
function AMQ_addStyle(css) {
    let head = document.head;
    let style = document.createElement("style");
    head.appendChild(style);
    style.type = "text/css";
    style.appendChild(document.createTextNode(css));
}
