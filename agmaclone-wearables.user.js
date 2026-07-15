// ==UserScript==
// @name         AgmaClone Wearables
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  hat selection via the '?h' chat command, stored using invisible unicode characters in the nickname; the hat is drawn above the character only for users of this script
// @author       ClxSan & Apygou
// @match        https://agmaclone.xyz/*
// @icon         https://i.pinimg.com/1200x/15/2d/2f/152d2fceae6315a8e453fc659e3c5e31.jpg
// @run-at       document-idle
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @downloadUrl  https://github.com/Clnersi/AgmaClone-Wearables/raw/refs/heads/main/agmaclone-wearables.user.js
// @updateURL    https://github.com/Clnersi/AgmaClone-Wearables/raw/refs/heads/main/agmaclone-wearables.user.js
// ==/UserScript==


(function () {
    'use strict';

    const hasGM = typeof GM_setValue === 'function' && typeof GM_getValue === 'function';
    const store = {
        set(key, val) {
            if (hasGM) return GM_setValue(key, val);
            try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
        },
        get(key, def) {
            if (hasGM) return GM_getValue(key, def);
            try {
                const raw = localStorage.getItem(key);
                return raw == null ? def : JSON.parse(raw);
            } catch (e) { return def; }
        }
    };

    // список шапок
    const hatsList = [
        { code: 'none',       name: 'Без шапки',       img: null },
        { code: 'crown',      name: 'Crown',           img: 'http://i.imgur.com/fx0KFMS.png', sizeMultiplier: 5, verticalOffset: 1.25 },
        { code: 'irish',      name: 'Irish',           img: 'http://i.imgur.com/5kTy39Y.png', sizeMultiplier: 5, verticalOffset: 1.25 },
        { code: 'penguin',    name: 'Penguin',         img: 'http://i.imgur.com/L0dCOQb.png', sizeMultiplier: 5, verticalOffset: 1.2 },
        { code: 'santa',      name: 'Santa',           img: 'http://i.imgur.com/lw85cSt.png' },
        { code: 'pika',       name: 'Pikachu',         img: 'http://i.imgur.com/8qgs5zI.png' },
        { code: 'wizard',     name: 'Wizard',          img: 'https://i.imgur.com/QCCBfqH.png' },
        { code: 'trex',       name: 'T-Rex',           img: 'https://i.imgur.com/fmos4Vy.png' },
        { code: 'catEars',    name: 'Cat Ears',        img: 'https://agma.io/wearables/62.png', verticalOffset: 0.785 },
        { code: 'adminBadge', name: 'Admin Badge',     img: 'https://agma.io/wearables/56.png', verticalOffset: 0.4 },
        { code: 'rabbitEars', name: 'Rabbit Ears',     img: 'https://i.imgur.com/x701cEM.png', sizeMultiplier: 6 },
        { code: 'adminCrown', name: 'admin Crown',     img: 'https://agma.io/wearables/45.png', verticalOffset: 0.785 },
    ];

    // предзагрузка картинок шапок
    const hatImageCache = {};
    function getHatImage(url) {
        if (!hatImageCache[url]) {
            const img = new Image();
            img.src = url;
            hatImageCache[url] = img;
        }
        return hatImageCache[url];
    }
    hatsList.forEach(h => { if (h.img) getHatImage(h.img); });

    const invisIds = [8203, 8204, 8205, 8288, 65279, 847, 6068, 6069, 8192, 8193, 8194, 8195, 8196];
    const HAT_TAG_MARKER = String.fromCharCode(65279); // zero-width no-break space, маркер начала тега

    function encodeHatTag(hatIndex) {
        if (!hatIndex || hatIndex <= 0 || hatIndex >= hatsList.length) return '';
        const base = invisIds.length;
        const d1 = Math.floor(hatIndex / base);
        const d2 = hatIndex % base;
        return HAT_TAG_MARKER + String.fromCharCode(invisIds[d1] ?? invisIds[0]) + String.fromCharCode(invisIds[d2]);
    }

    function decodeHatTag(nick) {
        if (!nick) return 0;
        const pos = nick.indexOf(HAT_TAG_MARKER);
        if (pos === -1) return 0;
        const c1 = nick.charCodeAt(pos + 1);
        const c2 = nick.charCodeAt(pos + 2);
        const i1 = invisIds.indexOf(c1);
        const i2 = invisIds.indexOf(c2);
        if (i1 === -1 || i2 === -1) return 0;
        const base = invisIds.length;
        const index = i1 * base + i2;
        return index > 0 && index < hatsList.length ? index : 0;
    }

    function stripHatTag(nick) {
        if (!nick) return nick;
        const pos = nick.indexOf(HAT_TAG_MARKER);
        return pos === -1 ? nick : nick.slice(0, pos) + nick.slice(pos + 3);
    }

    // ждём когда нам будет все доступно
    function waitFor(checkFn, callback, interval = 150) {
        if (checkFn()) return callback();
        setTimeout(() => waitFor(checkFn, callback, interval), interval);
    }

    waitFor(
        () => typeof unsafeWindow.useNickname === 'function' && unsafeWindow.players,
        initHatSystem
    );

      // логика скрипта
    function initHatSystem() {
        let selectedHatIndex = store.get('hat_selected_index', 0);

        const _useNickname = unsafeWindow.useNickname;
        unsafeWindow.useNickname = function (s) {
            s = s || localStorage.getItem('nick') || '';
            s = stripHatTag(s) + encodeHatTag(selectedHatIndex);
            return _useNickname.call(this, s);
        };


        function showToast(msg, color = '#a3a3a3', duration = 6000) {
            const $ = unsafeWindow.jQuery || unsafeWindow.$;
            if ($ && $('#curser-msg>div').length) {
                $('#curser-msg>div').stop(true, true).hide().html(msg).css('color', color).fadeIn(200);
                setTimeout(() => $('#curser-msg>div').fadeOut(200), duration);
                return;
            }
            let box = document.getElementById('hat-script-toast');
            if (!box) {
                box = document.createElement('div');
                box.id = 'hat-script-toast';
                box.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);' +
                    'background:rgba(0,0,0,.75);color:#fff;padding:10px 18px;border-radius:8px;' +
                    'font-size:15px;z-index:99999;max-width:80vw;text-align:center;';
                document.body.appendChild(box);
            }
            box.style.color = color;
            box.innerHTML = msg;
            box.style.display = 'block';
            clearTimeout(box._hideTimeout);
            box._hideTimeout = setTimeout(() => { box.style.display = 'none'; }, duration);
        }

        setTimeout(() => {
        showToast('Welcome! Type <b>?h</b> in chat', '#8b00ff', 7000);
         }, 1500);

        // обработка команды ?h [номер|код]
        function handleHatCommand(param) {
            if (!param) {
                const list = hatsList
                    .map((h, i) => (i === 0 ? null : `${i}: ${h.name}`))
                    .filter(Boolean)
                    .join(', ');
                showToast(`Command ?h [number] - choose a hat, ?h0 - remove hat (also ?h name or ?hname - selects hat by its code name instead of a number)<br>${list}<br> Script in beta testing (Made by ClxSan & ApyGou)`, '#8b00ff', 9000);
                return;
            }
            let idx = -1;
            if (/^\d+$/.test(param)) {
                idx = parseInt(param, 10);
            } else {
                idx = hatsList.findIndex(h => h.code.toLowerCase() === param.toLowerCase());
            }
        if (idx < 0 || idx >= hatsList.length) {
                showToast('Invalid hat. Type "?h" to see the list', 'red', 5000);
                return;
            }
            selectedHatIndex = idx;
            store.set('hat_selected_index', idx);
            showToast(
                idx === 0
                    ? 'Hat removed.'
                    : `Hat selected: <b>${hatsList[idx].name}</b>. Respawn to apply(beta test)`,
                '#12ce12',
                5000
            );
            // если игрок ещё не заходил — применится и так при следующем useNickname()
            // если жив/уже в игре — переустанавливаем ник сразу
            try { unsafeWindow.useNickname(); } catch (e) {}
        }

        window.addEventListener('keydown', function (e) {
            if (e.keyCode !== 13) return;
            const chatBox = document.getElementById('chat_textbox');
            if (!chatBox || document.activeElement !== chatBox) return;
            const match = chatBox.value.trim().match(/^\?h(?:\s*(\S+))?$/i);
            if (!match) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            handleHatCommand(match[1]);
            chatBox.value = '';
            chatBox.blur();
        }, true);

        const nicknameCanvasMap = new WeakMap();
        function refreshNicknameCanvasMap() {
            const players = unsafeWindow.players;
            for (const id in players) {
                const p = players[id];
                const canvas = p?.nicknameCache?.canvas;
                if (canvas) nicknameCanvasMap.set(canvas, id);
            }
        }
        setInterval(refreshNicknameCanvasMap, 1000);
        refreshNicknameCanvasMap();

        const _drawImage = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function () {
            const result = _drawImage.apply(this, arguments);
            const img = arguments[0];
            if (img instanceof HTMLCanvasElement && nicknameCanvasMap.has(img)) {
                const pid = nicknameCanvasMap.get(img);
                const player = unsafeWindow.players[pid];
                const hatIdx = player ? decodeHatTag(player.nickname) : 0;
                if (hatIdx > 0) {
                    const hatDef = hatsList[hatIdx];
                    const hatImg = hatDef.img ? getHatImage(hatDef.img) : null;
                    if (hatImg && hatImg.complete && hatImg.naturalWidth > 0) {
                        // arguments: (image, dx, dy, dw, dh)
                        const dx = arguments[1], dy = arguments[2], dw = arguments[3], dh = arguments[4];
                        const sizeMultiplier = hatDef.sizeMultiplier || 7;
                        const verticalOffset = hatDef.verticalOffset || 1.09;
                        const hatW = dh * sizeMultiplier;
                        const hatH = hatW * (hatImg.naturalHeight / hatImg.naturalWidth);
                        const hatX = dx + dw / 2 - hatW / 2;
                        const hatY = dy - hatH * verticalOffset;
                        this.drawImage(hatImg, hatX, hatY, hatW, hatH);
                    }
                }
            }
            return result;
        };

        if (selectedHatIndex > 0) {
            try { unsafeWindow.useNickname(); } catch (e) {}
        }

        console.log('script is on, index of hat:', selectedHatIndex);
    }
})();
