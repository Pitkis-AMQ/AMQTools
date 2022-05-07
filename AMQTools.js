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
let quizReadySongListTracker;
let joinLobbyListener;
let answerResultsSongTracker;
let quizOverListener;
let quizStartingTracker;
let nextVideoListener;
let gameMode;

// count songs on/off setting
let countSongs = true;
// print missed songs to chat as a system message after game
let printMissedSongsAfterGame = true;
// Song counter functionality related stuff
let playerData = {};
let scoreboardReady = false;
let playerDataReady = false;
let quizReadyCountSongsTracker;
let answerResultsCountSongsTracker;
let quizEndCountSongsTracker;
let returnToLobbyVoteCountSongsListener;
let spectateLobbyListener;


function setup() {
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
        height: 1.0
    });
    // Create song table
    listWindowTable = $(`<table id="listWindowTable" class="table" style='font-size:120%'></table>`);
    listWindow.panels[0].panel.append(listWindowTable);
    // Button to post list to chat
    const buttonFn = (buttonId, buttonClass) => `<button id="${buttonId}" class="button floatingContainer" type="button" color="black" style="margin: 5px 0px 5px 10px"><i aria-hidden="true" class="fa ${buttonClass}"></i></button>`;
    listWindow.panels[0].panel
        .append($(buttonFn('slChat', 'fa-commenting'))
            .click(() => {
                writeListToChat();
            })
        )
		.append($(buttonFn('slRandomTags', 'fa-random'))
            .click(() => {
                randomizeTags();
            })
        )
        .append($(buttonFn('amqtSortButton', 'fa-sort-numeric-asc'))
            .click((evt) => {
                AMQToolsSortSongs(evt.delegateTarget);
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
        joinLobbyListener.bindListener();
        answerResultsSongTracker.bindListener();
    });
    quizReadySongListTracker.bindListener();
	// Close window when quiz ends
    quizOverListener = new Listener("quiz over", (roomSettings) => {
        listWindow.close();
    });
    quizOverListener.bindListener()
    // Close window when returning back to lobby
    joinLobbyListener = new Listener("Join Game", (payload) => {
        listWindowTable.children().remove();
        listWindow.close();
    });
    // Mark the row if it was the correct answer
    answerResultsSongTracker = new Listener("answer results", (result) => {
        var x = document.getElementById('listWindowTable').getElementsByTagName('td');
        var y = result.songInfo.animeNames.romaji;
        var z = result.songInfo.animeNames.english;
        for(let i = 0; i < x.length; i++) {
            if (x[i].innerText === y || x[i].innerText === z) {
                x[i].style.backgroundColor = '#A9A9A9';
            }
        }
    });
	// Listeners related to tracking the number of songs and missed songs from players
	quizReadyCountSongsTracker = new Listener("quiz ready", (data) => {
		initialiseScoreboard();
		initialisePlayerData();
		answerResultsCountSongsTracker.bindListener();
		// only if printing is enabled
		if (printMissedSongsAfterGame) {
			quizEndCountSongsTracker.bindListener();
		}
		returnToLobbyVoteCountSongsListener.bindListener();
        spectateLobbyListener.bindListener();
    });
    if (countSongs) {
        quizReadyCountSongsTracker.bindListener();
    }
	// update song counts after each result
	answerResultsCountSongsTracker = new Listener("answer results", (result) => {
		if (playerDataReady) {
            for (let player of result.players) {
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

function AMQToolsSortSongs(sortButton) {

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

    let sortIcon = $(sortButton).children()[0];

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
	let poolSize = 15;
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
        let counter = $(`<span class="qpsPlayerSongCounter">0</span>`);
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
             score: 0,
             missedList: 0,
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
        }
    }
}
// print stats after game if showMissed is true
function missedListToChat() {
	for (let id in playerData) {
		gameChat.systemMessage(`${playerData[id].name} missed ${playerData[id].missedList === 1 ? playerData[id].missedList + " song" : playerData[id].missedList + " songs"} from their own list. Total songs: ${playerData[id].songs}`);
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
